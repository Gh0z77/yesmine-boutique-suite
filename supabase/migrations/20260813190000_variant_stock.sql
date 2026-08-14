-- Stock per size and colour.
--
-- Until now a dress had one stock number, so a shopper could buy XS when only
-- XL was left. Stock now lives on the (product, size, colour) combination.
--
-- products.stock stays, but becomes a derived total kept up to date by a
-- trigger — every existing screen that reads it (shop cards, dashboard low
-- stock, admin table) keeps working untouched.

-- ---------------------------------------------------------------------------
-- 1. The variants themselves
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- '' rather than NULL, so the unique index actually catches duplicates.
  size text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  stock int NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, size, color)
);

GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "variants public read" ON public.product_variants;
CREATE POLICY "variants public read" ON public.product_variants FOR SELECT USING (true);
DROP POLICY IF EXISTS "variants admin write" ON public.product_variants;
CREATE POLICY "variants admin write" ON public.product_variants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS product_variants_touch ON public.product_variants;
CREATE TRIGGER product_variants_touch BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS product_variants_product_idx
  ON public.product_variants (product_id);

-- ---------------------------------------------------------------------------
-- 2. products.stock becomes the sum of its variants
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_product_stock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_product uuid := coalesce(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE public.products p
     SET stock = coalesce((
           SELECT sum(v.stock)::int FROM public.product_variants v
            WHERE v.product_id = v_product
         ), 0)
   WHERE p.id = v_product;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS product_variants_sync_stock ON public.product_variants;
CREATE TRIGGER product_variants_sync_stock
  AFTER INSERT OR UPDATE OF stock OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_stock();

-- ---------------------------------------------------------------------------
-- 3. Order lines remember which variant they took
-- ---------------------------------------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 4. Backfill: spread today's stock across each product's combinations
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  p RECORD;
  v_sizes text[];
  v_colors text[];
  v_size text;
  v_color text;
  v_count int;
  v_each int;
  v_rest int;
  v_index int;
BEGIN
  -- Only run while no variants exist, so re-applying is harmless.
  IF EXISTS (SELECT 1 FROM public.product_variants) THEN RETURN; END IF;

  FOR p IN SELECT * FROM public.products LOOP
    v_sizes := CASE WHEN coalesce(array_length(p.sizes, 1), 0) = 0 THEN ARRAY['']::text[] ELSE p.sizes END;
    v_colors := CASE WHEN coalesce(array_length(p.colors, 1), 0) = 0 THEN ARRAY['']::text[] ELSE p.colors END;

    v_count := array_length(v_sizes, 1) * array_length(v_colors, 1);
    v_each := p.stock / v_count;
    v_rest := p.stock % v_count;
    v_index := 0;

    FOREACH v_size IN ARRAY v_sizes LOOP
      FOREACH v_color IN ARRAY v_colors LOOP
        -- Round-robin the remainder instead of dumping it on one row, so a
        -- product with 14 pieces across 15 combinations reads as a real rail
        -- rather than "everything is in XS/Blush".
        INSERT INTO public.product_variants (product_id, size, color, stock)
        VALUES (p.id, v_size, v_color, v_each + CASE WHEN v_index < v_rest THEN 1 ELSE 0 END)
        ON CONFLICT (product_id, size, color) DO NOTHING;
        v_index := v_index + 1;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Link historical order lines to their variant where the pair still exists.
UPDATE public.order_items i
   SET variant_id = v.id
  FROM public.product_variants v
 WHERE i.variant_id IS NULL
   AND v.product_id = i.product_id
   AND v.size = coalesce(i.size, '')
   AND v.color = coalesce(i.color, '');

-- ---------------------------------------------------------------------------
-- 5. place_order now reserves the exact variant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_order(
  p_customer_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_note text,
  p_lat double precision,
  p_lng double precision,
  p_card_last4 text,
  p_items jsonb,
  p_payment_method text DEFAULT 'card'
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_number text;
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_variant public.product_variants%ROWTYPE;
  v_quantity int;
  v_size text;
  v_color text;
  v_phone text;
  v_recent int;
  v_method text;
  v_payment_status text;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'TOO_MANY_ITEMS';
  END IF;
  IF length(coalesce(btrim(p_customer_name), '')) < 2 THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;
  IF length(coalesce(btrim(p_phone), '')) < 7 THEN RAISE EXCEPTION 'INVALID_PHONE'; END IF;
  IF length(coalesce(btrim(p_address), '')) < 6 THEN RAISE EXCEPTION 'INVALID_ADDRESS'; END IF;

  v_method := lower(coalesce(btrim(p_payment_method), 'card'));
  IF v_method NOT IN ('card', 'cod') THEN RAISE EXCEPTION 'INVALID_PAYMENT_METHOD'; END IF;
  v_payment_status := CASE WHEN v_method = 'cod' THEN 'unpaid' ELSE 'paid' END;

  v_phone := left(btrim(p_phone), 30);

  SELECT count(*) INTO v_recent
    FROM public.orders
   WHERE phone = v_phone
     AND created_at > now() - interval '10 minutes';
  IF v_recent >= 3 THEN RAISE EXCEPTION 'TOO_MANY_ORDERS'; END IF;

  v_number := public.next_order_number();

  INSERT INTO public.orders (
    order_number, customer_name, phone, email, address, note, lat, lng,
    subtotal, shipping, total, status, payment_status, payment_method, payment_ref
  ) VALUES (
    v_number,
    left(btrim(p_customer_name), 100),
    v_phone,
    nullif(left(btrim(coalesce(p_email, '')), 255), ''),
    left(btrim(p_address), 300),
    nullif(left(btrim(coalesce(p_note, '')), 500), ''),
    p_lat,
    p_lng,
    0, 0, 0,
    'pending',
    v_payment_status,
    v_method,
    CASE
      WHEN v_method = 'cod' THEN 'CASH-ON-DELIVERY'
      WHEN p_card_last4 ~ '^[0-9]{4}$' THEN 'DEMO-' || p_card_last4
      ELSE 'DEMO'
    END
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_quantity := coalesce((v_item->>'quantity')::int, 0);
    IF v_quantity < 1 OR v_quantity > 20 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY';
    END IF;

    SELECT * INTO v_product
      FROM public.products
     WHERE id = (v_item->>'product_id')::uuid
       AND active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE';
    END IF;

    v_size := coalesce(nullif(btrim(coalesce(v_item->>'size', '')), ''), '');
    v_color := coalesce(nullif(btrim(coalesce(v_item->>'color', '')), ''), '');

    -- The row lock is on the variant now, so two shoppers racing for the last
    -- XL don't both win while an XS sits untouched.
    SELECT * INTO v_variant
      FROM public.product_variants
     WHERE product_id = v_product.id
       AND size = v_size
       AND color = v_color
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_VARIANT';
    END IF;
    IF v_variant.stock < v_quantity THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%', v_product.name;
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, image_url, price, quantity, size, color
    ) VALUES (
      v_order_id, v_product.id, v_variant.id, v_product.name, v_product.images[1],
      v_product.price, v_quantity, nullif(v_size, ''), nullif(v_color, '')
    );

    UPDATE public.product_variants
       SET stock = stock - v_quantity
     WHERE id = v_variant.id;

    UPDATE public.products
       SET sold_count = sold_count + v_quantity
     WHERE id = v_product.id;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  END LOOP;

  v_shipping := public.shipping_for(v_subtotal);
  v_total := v_subtotal + v_shipping;

  UPDATE public.orders
     SET subtotal = v_subtotal,
         shipping = v_shipping,
         total = v_total
   WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'order_number', v_number,
    'subtotal', v_subtotal,
    'shipping', v_shipping,
    'total', v_total,
    'payment_method', v_method,
    'payment_status', v_payment_status
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order(
  text, text, text, text, text, double precision, double precision, text, jsonb, text
) FROM public;
GRANT EXECUTE ON FUNCTION public.place_order(
  text, text, text, text, text, double precision, double precision, text, jsonb, text
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Cancelling returns stock to the right variant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restock_cancelled_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_direction int;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    v_direction := 1;
  ELSIF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    v_direction := -1;
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.product_variants v
     SET stock = greatest(0, v.stock + (v_direction * agg.qty))
    FROM (
      SELECT variant_id, sum(quantity)::int AS qty
        FROM public.order_items
       WHERE order_id = NEW.id AND variant_id IS NOT NULL
       GROUP BY variant_id
    ) agg
   WHERE agg.variant_id = v.id;

  UPDATE public.products p
     SET sold_count = greatest(0, p.sold_count - (v_direction * agg.qty))
    FROM (
      SELECT product_id, sum(quantity)::int AS qty
        FROM public.order_items
       WHERE order_id = NEW.id AND product_id IS NOT NULL
       GROUP BY product_id
    ) agg
   WHERE agg.product_id = p.id;

  RETURN NEW;
END; $$;

-- ---------------------------------------------------------------------------
-- 7. Admin helper: replace a product's whole variant grid in one call
-- ---------------------------------------------------------------------------
-- p_variants: [{ "size": "M", "color": "Rose", "stock": 4 }, ...]
CREATE OR REPLACE FUNCTION public.set_product_variants(p_product_id uuid, p_variants jsonb)
RETURNS int
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_keep uuid[] := '{}';
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  IF p_variants IS NULL OR jsonb_typeof(p_variants) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_variants) LOOP
    INSERT INTO public.product_variants (product_id, size, color, stock)
    VALUES (
      p_product_id,
      coalesce(btrim(v_item->>'size'), ''),
      coalesce(btrim(v_item->>'color'), ''),
      greatest(0, coalesce((v_item->>'stock')::int, 0))
    )
    ON CONFLICT (product_id, size, color)
      DO UPDATE SET stock = EXCLUDED.stock
    RETURNING id INTO v_id;
    v_keep := array_append(v_keep, v_id);
  END LOOP;

  -- Combinations the admin removed from the grid disappear with their stock.
  DELETE FROM public.product_variants
   WHERE product_id = p_product_id
     AND NOT (id = ANY (v_keep));

  RETURN coalesce(array_length(v_keep, 1), 0);
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_product_variants(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_product_variants(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Strings
-- ---------------------------------------------------------------------------
INSERT INTO public.translations (key, en, ru, uz) VALUES
  ('shop.pickSize','Choose a size','Выберите размер','O''lchamni tanlang'),
  ('shop.pickColor','Choose a colour','Выберите цвет','Rangni tanlang'),
  ('shop.variantOut','This combination is sold out','Эта комбинация распродана','Bu variant tugagan'),
  ('shop.left','left','осталось','qoldi')
ON CONFLICT (key) DO NOTHING;
