-- Telegram xabarnomasi umuman ishlamayotgan edi. Ikki xato bor edi.
--
-- BIRINCHISI: chaqiruv `extensions.net.http_post(...)` deb yozilgan. pg_net
-- kengaytmasi `extensions` sxemasiga o'rnatilgan bo'lsa ham, uning funksiyalari
-- doim `net` sxemasida turadi. Uch bo'lakli nom Postgres uchun
-- "baza.sxema.funksiya" degani, shuning uchun u
-- "cross-database references are not implemented" xatosini beradi.
--
-- IKKINCHISI, va yomonrog'i: `EXCEPTION WHEN OTHERS THEN RETURN NEW` xatoni
-- yutib yuborardi. Ya'ni do'kon egasi tokenni qo'yadi, buyurtma tushadi,
-- xabar kelmaydi — va sabab hech qayerda ko'rinmaydi. Buyurtma to'xtamasligi
-- kerak, bu to'g'ri; lekin nosozlik jimgina yo'qolmasligi ham kerak.

CREATE TABLE IF NOT EXISTS public.notification_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel    text NOT NULL DEFAULT 'telegram',
  order_id   uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ok         boolean NOT NULL,
  error      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_log_created_idx
  ON public.notification_log (created_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_log FROM anon;
GRANT SELECT ON public.notification_log TO authenticated;

DROP POLICY IF EXISTS "notification log admin read" ON public.notification_log;
CREATE POLICY "notification log admin read" ON public.notification_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------- --

CREATE OR REPLACE FUNCTION public.notify_new_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg jsonb;
  v_text text;
  v_items text;
BEGIN
  SELECT value INTO v_cfg FROM public.app_settings WHERE key = 'telegram';
  IF v_cfg IS NULL
     OR coalesce((v_cfg->>'enabled')::boolean, false) IS NOT TRUE
     OR coalesce(v_cfg->>'bot_token', '') = ''
     OR coalesce(v_cfg->>'chat_id', '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT string_agg(format('• %s ×%s', i.product_name, i.quantity), E'\n')
    INTO v_items
    FROM public.order_items i WHERE i.order_id = NEW.id;

  v_text := format(
    E'🌸 <b>Yangi buyurtma %s</b>\n\n%s\n\n<b>Jami:</b> %s so''m\n<b>To''lov:</b> %s\n<b>Mijoz:</b> %s\n<b>Telefon:</b> %s\n<b>Manzil:</b> %s',
    NEW.order_number,
    coalesce(v_items, '—'),
    to_char(NEW.total, 'FM999G999G999'),
    CASE WHEN NEW.payment_method = 'cod' THEN 'Yetkazib berganda naqd' ELSE 'Karta' END,
    NEW.customer_name,
    NEW.phone,
    NEW.address
  );

  -- Fire-and-forget: a Telegram outage must never fail the customer's order.
  PERFORM net.http_post(
    url := 'https://api.telegram.org/bot' || (v_cfg->>'bot_token') || '/sendMessage',
    body := jsonb_build_object(
      'chat_id', v_cfg->>'chat_id',
      'text', v_text,
      'parse_mode', 'HTML'
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  INSERT INTO public.notification_log (order_id, ok) VALUES (NEW.id, true);
  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- The order still goes through, but the failure is written down so the
  -- owner can see why no message arrived.
  BEGIN
    INSERT INTO public.notification_log (order_id, ok, error) VALUES (NEW.id, false, SQLERRM);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END; $$;

-- ---------------------------------------------------------------- --

-- Sinov tugmasi endi haqiqiy sababni qaytaradi, "nimadir bo'ldi" emas.
CREATE OR REPLACE FUNCTION public.telegram_test() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cfg jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;

  SELECT value INTO v_cfg FROM public.app_settings WHERE key = 'telegram';
  IF coalesce(v_cfg->>'bot_token', '') = '' OR coalesce(v_cfg->>'chat_id', '') = '' THEN
    RETURN jsonb_build_object('ok', false,
      'message', 'Bot token va chat id kiritilishi shart.');
  END IF;

  PERFORM net.http_post(
    url := 'https://api.telegram.org/bot' || (v_cfg->>'bot_token') || '/sendMessage',
    body := jsonb_build_object(
      'chat_id', v_cfg->>'chat_id',
      'text', E'🌸 Yesmine — sinov xabari. Xabarnoma ishlayapti.',
      'parse_mode', 'HTML'
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN jsonb_build_object('ok', true,
    'message', 'Xabar yuborildi. Bir necha soniyada kanalga yetib boradi.');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
END; $$;

REVOKE ALL ON FUNCTION public.telegram_test() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.telegram_test() TO authenticated;
