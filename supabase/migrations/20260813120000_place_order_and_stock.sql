-- Yesmine hardening pass.
--   1. Orders can no longer be written straight from the browser — the client used to
--      send its own subtotal/total, so any visitor could have priced their own order.
--   2. public.place_order() is now the single entry point: it prices the basket from
--      the products table, generates the order number from the sequence, moves stock
--      and bumps sold_count, all in one transaction.
--   3. Landing "about" block gets RU/UZ copy so the story section respects the language
--      switcher like every other block does.

-- ---------------------------------------------------------------------------
-- 1. Close the direct-insert door
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "orders guest insert" ON public.orders;
DROP POLICY IF EXISTS "order items guest insert" ON public.order_items;
REVOKE INSERT ON public.orders FROM anon;
REVOKE INSERT ON public.order_items FROM anon;
REVOKE INSERT ON public.orders FROM authenticated;
REVOKE INSERT ON public.order_items FROM authenticated;

-- ---------------------------------------------------------------------------
-- 2. Server-side order placement
-- ---------------------------------------------------------------------------
-- p_items: [{ "product_id": uuid, "quantity": int, "size": text, "color": text }, ...]
-- Returns: { "order_number": text, "subtotal": num, "shipping": num, "total": num }
CREATE OR REPLACE FUNCTION public.place_order(
  p_customer_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_note text,
  p_lat double precision,
  p_lng double precision,
  p_card_last4 text,
  p_items jsonb
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
  v_quantity int;
  v_size text;
  v_color text;
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

  v_number := public.next_order_number();

  INSERT INTO public.orders (
    order_number, customer_name, phone, email, address, note, lat, lng,
    subtotal, shipping, total, status, payment_status, payment_ref
  ) VALUES (
    v_number,
    left(btrim(p_customer_name), 100),
    left(btrim(p_phone), 30),
    nullif(left(btrim(coalesce(p_email, '')), 255), ''),
    left(btrim(p_address), 300),
    nullif(left(btrim(coalesce(p_note, '')), 500), ''),
    p_lat,
    p_lng,
    0, 0, 0,
    'pending',
    'paid',
    CASE WHEN p_card_last4 ~ '^[0-9]{4}$' THEN 'DEMO-' || p_card_last4 ELSE 'DEMO' END
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_quantity := coalesce((v_item->>'quantity')::int, 0);
    IF v_quantity < 1 OR v_quantity > 20 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY';
    END IF;

    -- FOR UPDATE keeps two shoppers from overselling the last piece.
    SELECT * INTO v_product
      FROM public.products
     WHERE id = (v_item->>'product_id')::uuid
       AND active
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE';
    END IF;
    IF v_product.stock < v_quantity THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%', v_product.name;
    END IF;

    v_size := nullif(btrim(coalesce(v_item->>'size', '')), '');
    v_color := nullif(btrim(coalesce(v_item->>'color', '')), '');

    -- Only accept a variant the product actually offers.
    IF v_size IS NOT NULL AND array_length(v_product.sizes, 1) IS NOT NULL
       AND NOT (v_size = ANY (v_product.sizes)) THEN
      RAISE EXCEPTION 'INVALID_VARIANT';
    END IF;
    IF v_color IS NOT NULL AND array_length(v_product.colors, 1) IS NOT NULL
       AND NOT (v_color = ANY (v_product.colors)) THEN
      RAISE EXCEPTION 'INVALID_VARIANT';
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, image_url, price, quantity, size, color
    ) VALUES (
      v_order_id, v_product.id, v_product.name, v_product.images[1],
      v_product.price, v_quantity, v_size, v_color
    );

    UPDATE public.products
       SET stock = stock - v_quantity,
           sold_count = sold_count + v_quantity
     WHERE id = v_product.id;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  END LOOP;

  v_shipping := CASE WHEN v_subtotal > 200 THEN 0 ELSE 15 END;
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
    'total', v_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order(
  text, text, text, text, text, double precision, double precision, text, jsonb
) FROM public;
GRANT EXECUTE ON FUNCTION public.place_order(
  text, text, text, text, text, double precision, double precision, text, jsonb
) TO anon, authenticated;

-- Cancelling an order puts the pieces back on the shelf; un-cancelling takes them
-- out again. Lines are summed first, because one order can hold the same product
-- in two sizes.
CREATE OR REPLACE FUNCTION public.restock_cancelled_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_direction int;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    v_direction := 1;   -- back into stock
  ELSIF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    v_direction := -1;  -- reinstated, take it back out
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.products p
     SET stock = greatest(0, p.stock + (v_direction * agg.qty)),
         sold_count = greatest(0, p.sold_count - (v_direction * agg.qty))
    FROM (
      SELECT product_id, sum(quantity)::int AS qty
        FROM public.order_items
       WHERE order_id = NEW.id
         AND product_id IS NOT NULL
       GROUP BY product_id
    ) agg
   WHERE agg.product_id = p.id;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS orders_restock_on_cancel ON public.orders;
CREATE TRIGGER orders_restock_on_cancel
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.restock_cancelled_order();

-- ---------------------------------------------------------------------------
-- 3. Localized landing copy
-- ---------------------------------------------------------------------------
UPDATE public.site_content
   SET value = value || jsonb_build_object(
         'title_ru', 'История Yesmine',
         'title_uz', 'Yesmine hikoyasi',
         'body_ru', 'Yesmine вырос из веры в то, что женственность — это форма силы. Всё началось с одного платья из розового шёлка, скроенного на кухонном столе в Ташкенте. Сегодня каждая вещь по-прежнему шьётся малыми партиями — женщинами и для женщин.',
         'body_uz', 'Yesmine ayollik kuchning bir ko''rinishi degan ishonchdan boshlandi. Hammasi Toshkentdagi oshxona stolida bichilgan bitta pushti ipak ko''ylakdan boshlangan. Bugun ham har bir buyum kichik partiyalarda, ayollar tomonidan, ayollar uchun tikiladi.'
       ),
       updated_at = now()
 WHERE key = 'about';

-- ---------------------------------------------------------------------------
-- 4. Indexes for the admin views
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products (category_id);
