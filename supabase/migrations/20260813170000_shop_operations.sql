-- Turning the demo into a shop that can actually take orders in Uzbekistan:
--   * contact messages and newsletter signups are stored instead of thrown away
--   * cash on delivery, so there is one payment path that is real today
--   * shipping prices and currency move out of the code into editable settings
--   * order spam is throttled, because every order now moves real stock
--   * a private settings table for secrets (Telegram bot token)

-- ---------------------------------------------------------------------------
-- 1. Private settings (admin-only, never exposed to anon)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

DROP POLICY IF EXISTS "settings admin only" ON public.app_settings;
CREATE POLICY "settings admin only" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (key, value) VALUES
  ('telegram', '{"bot_token":"","chat_id":"","enabled":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Public shop settings (currency + delivery), editable from Admin -> Content
-- ---------------------------------------------------------------------------
INSERT INTO public.site_content (key, value) VALUES
  ('shop_settings', '{"currency":"UZS","flat_shipping":25000,"free_shipping_over":1000000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.shipping_for(p_subtotal numeric) RETURNS numeric
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_subtotal <= 0 THEN 0
    WHEN p_subtotal >= coalesce((value->>'free_shipping_over')::numeric, 1000000) THEN 0
    ELSE coalesce((value->>'flat_shipping')::numeric, 25000)
  END
  FROM public.site_content WHERE key = 'shop_settings'
$$;

-- ---------------------------------------------------------------------------
-- 3. Prices move from USD to UZS (rounded to the nearest 1 000 so'm)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Only convert once: a dress costing 189 is clearly still in dollars.
  IF EXISTS (SELECT 1 FROM public.products WHERE price < 10000) THEN
    UPDATE public.products
       SET price = round(price * 12600 / 1000) * 1000,
           compare_price = CASE
             WHEN compare_price IS NULL THEN NULL
             ELSE round(compare_price * 12600 / 1000) * 1000
           END;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Contact messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_messages FROM anon;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;

DROP POLICY IF EXISTS "messages admin read" ON public.contact_messages;
CREATE POLICY "messages admin read" ON public.contact_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "messages admin write" ON public.contact_messages;
CREATE POLICY "messages admin write" ON public.contact_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "messages admin delete" ON public.contact_messages;
CREATE POLICY "messages admin delete" ON public.contact_messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS contact_messages_created_idx
  ON public.contact_messages (created_at DESC);

-- Visitors write only through this function, so validation and throttling
-- cannot be skipped by talking to the table directly.
CREATE OR REPLACE FUNCTION public.submit_contact_message(
  p_name text, p_email text, p_message text
) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_recent int;
BEGIN
  IF length(coalesce(btrim(p_name), '')) < 2 THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;
  IF coalesce(btrim(p_email), '') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;
  IF length(coalesce(btrim(p_message), '')) < 10 THEN RAISE EXCEPTION 'MESSAGE_TOO_SHORT'; END IF;

  SELECT count(*) INTO v_recent
    FROM public.contact_messages
   WHERE lower(email) = lower(btrim(p_email))
     AND created_at > now() - interval '1 hour';
  IF v_recent >= 3 THEN RAISE EXCEPTION 'TOO_MANY_MESSAGES'; END IF;

  INSERT INTO public.contact_messages (name, email, message)
  VALUES (left(btrim(p_name), 100), lower(left(btrim(p_email), 255)), left(btrim(p_message), 2000));
  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public.submit_contact_message(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_contact_message(text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Newsletter
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  email text PRIMARY KEY,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.newsletter_subscribers FROM anon;
GRANT SELECT, UPDATE, DELETE ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;

DROP POLICY IF EXISTS "subscribers admin all" ON public.newsletter_subscribers;
CREATE POLICY "subscribers admin all" ON public.newsletter_subscribers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.subscribe_newsletter(p_email text) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(btrim(p_email), '') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;
  INSERT INTO public.newsletter_subscribers (email)
  VALUES (lower(left(btrim(p_email), 255)))
  ON CONFLICT (email) DO UPDATE SET active = true;
  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public.subscribe_newsletter(text) FROM public;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Orders: payment method + throttling + settings-driven shipping
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'card';

CREATE INDEX IF NOT EXISTS orders_phone_created_idx ON public.orders (phone, created_at DESC);

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
  -- Cash is collected by the courier, so the order starts unpaid on purpose.
  v_payment_status := CASE WHEN v_method = 'cod' THEN 'unpaid' ELSE 'paid' END;

  v_phone := left(btrim(p_phone), 30);

  -- Every order reserves stock, so a script hammering this function could empty
  -- the shop. Three orders per phone per ten minutes is plenty for a real buyer.
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

-- The 9-argument version is replaced by the 10-argument one above.
DROP FUNCTION IF EXISTS public.place_order(
  text, text, text, text, text, double precision, double precision, text, jsonb
);

REVOKE EXECUTE ON FUNCTION public.place_order(
  text, text, text, text, text, double precision, double precision, text, jsonb, text
) FROM public;
GRANT EXECUTE ON FUNCTION public.place_order(
  text, text, text, text, text, double precision, double precision, text, jsonb, text
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Let an admin sweep away abandoned orders (stock returns via the trigger)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_stale_orders(p_older_than_hours int DEFAULT 48)
RETURNS int
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;

  WITH stale AS (
    UPDATE public.orders
       SET status = 'cancelled'
     WHERE status = 'pending'
       AND payment_status <> 'paid'
       AND created_at < now() - make_interval(hours => greatest(1, p_older_than_hours))
     RETURNING 1
  )
  SELECT count(*) INTO v_count FROM stale;

  RETURN v_count;
END; $$;
REVOKE EXECUTE ON FUNCTION public.cancel_stale_orders(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_stale_orders(int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Customers look up their own order without an account
-- ---------------------------------------------------------------------------
-- Both the order number and the matching phone are required, so knowing one
-- sequential number is not enough to read somebody else's details.
CREATE OR REPLACE FUNCTION public.track_order(p_order_number text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
BEGIN
  IF length(v_digits) < 7 OR length(coalesce(btrim(p_order_number), '')) < 5 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_order
    FROM public.orders
   WHERE upper(order_number) = upper(btrim(p_order_number))
     -- Compare digits only: "+998 90 123" and "998901 23" are the same person.
     AND regexp_replace(phone, '[^0-9]', '', 'g') = v_digits;

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'order_number', v_order.order_number,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'total', v_order.total,
    'created_at', v_order.created_at,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'product_name', i.product_name,
        'quantity', i.quantity,
        'size', i.size,
        'color', i.color
      ) ORDER BY i.created_at)
      FROM public.order_items i WHERE i.order_id = v_order.id
    ), '[]'::jsonb)
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.track_order(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.track_order(text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Interface strings for the new UI
-- ---------------------------------------------------------------------------
INSERT INTO public.translations (key, en, ru, uz) VALUES
  ('checkout.method','Payment method','Способ оплаты','To''lov usuli'),
  ('checkout.methodCard','Card (demo)','Карта (демо)','Karta (demo)'),
  ('checkout.methodCod','Cash on delivery','Наличными при получении','Yetkazib berganda naqd'),
  ('checkout.codNote','Pay the courier in cash when your order arrives.','Оплатите курьеру наличными при получении заказа.','Buyurtma yetib kelganda kuryerga naqd to''laysiz.'),
  ('checkout.placeOrder','Place order','Оформить заказ','Buyurtma berish'),
  ('track.title','Track your order','Отследить заказ','Buyurtmani kuzatish'),
  ('track.body','Enter your order number and phone to see where it is.','Введите номер заказа и телефон, чтобы узнать статус.','Holatini bilish uchun buyurtma raqami va telefonni kiriting.'),
  ('track.orderNumber','Order number','Номер заказа','Buyurtma raqami'),
  ('track.check','Check','Проверить','Tekshirish'),
  ('track.notFound','No order matches that number and phone.','Заказ с такими данными не найден.','Bunday raqam va telefon bo''yicha buyurtma topilmadi.'),
  ('status.pending','Pending','В обработке','Kutilmoqda'),
  ('status.processing','Processing','Собирается','Tayyorlanmoqda'),
  ('status.shipped','Shipped','Отправлен','Yo''lga chiqdi'),
  ('status.delivered','Delivered','Доставлен','Yetkazildi'),
  ('status.cancelled','Cancelled','Отменён','Bekor qilindi')
ON CONFLICT (key) DO NOTHING;
