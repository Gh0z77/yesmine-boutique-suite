-- Real payments, switched on from the admin panel.
--
-- The shop stays in demo mode until the owner saves a Payme merchant id and
-- key in Admin -> Payments. The moment those exist and the provider is set to
-- 'payme', checkout stops simulating and sends the customer to Payme.
--
-- The whole Payme Merchant API lives here as one SECURITY DEFINER function
-- rather than in the web server, for a specific reason: Payme authenticates
-- with the merchant key, and that key must never leave the database. The HTTP
-- route is a thin proxy that forwards the Authorization header and the body —
-- this function checks the credentials itself before doing anything.

-- ---------------------------------------------------------------------------
-- 1. Settings + order columns
-- ---------------------------------------------------------------------------
INSERT INTO public.app_settings (key, value) VALUES (
  'payments',
  '{"provider":"demo","payme":{"merchant_id":"","key":"","test_mode":true},"click":{"merchant_id":"","service_id":"","secret":""}}'::jsonb
) ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'demo';

-- ---------------------------------------------------------------------------
-- 2. Payme transaction ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payme_transactions (
  id text PRIMARY KEY,                       -- Payme's transaction id
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount bigint NOT NULL,                    -- tiyin (so'm × 100)
  state int NOT NULL DEFAULT 1,              -- 1 created · 2 performed · -1/-2 cancelled
  reason int,
  create_time bigint NOT NULL,
  perform_time bigint NOT NULL DEFAULT 0,
  cancel_time bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payme_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payme_transactions FROM anon;
GRANT SELECT ON public.payme_transactions TO authenticated;
GRANT ALL ON public.payme_transactions TO service_role;

DROP POLICY IF EXISTS "payme admin read" ON public.payme_transactions;
CREATE POLICY "payme admin read" ON public.payme_transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS payme_transactions_order_idx
  ON public.payme_transactions (order_id, state);

-- ---------------------------------------------------------------------------
-- 3. Is a real provider configured? (public — the checkout needs to know)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_config()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  SELECT value INTO v FROM public.app_settings WHERE key = 'payments';
  IF v IS NULL THEN
    RETURN jsonb_build_object('provider', 'demo', 'live', false);
  END IF;

  -- Only the merchant id leaves the database. The key never does.
  IF coalesce(v->>'provider', 'demo') = 'payme'
     AND coalesce(v#>>'{payme,merchant_id}', '') <> ''
     AND coalesce(v#>>'{payme,key}', '') <> '' THEN
    RETURN jsonb_build_object(
      'provider', 'payme',
      'live', true,
      'merchant_id', v#>>'{payme,merchant_id}',
      'test_mode', coalesce((v#>>'{payme,test_mode}')::boolean, true)
    );
  END IF;

  RETURN jsonb_build_object('provider', 'demo', 'live', false);
END; $$;
REVOKE EXECUTE ON FUNCTION public.payment_config() FROM public;
GRANT EXECUTE ON FUNCTION public.payment_config() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The Payme Merchant API
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payme_rpc(p_auth text, p_body jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings jsonb;
  v_key text;
  v_expected text;
  v_method text;
  v_params jsonb;
  v_id jsonb;
  v_account text;
  v_amount bigint;
  v_order public.orders%ROWTYPE;
  v_tx public.payme_transactions%ROWTYPE;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_reason int;
  v_rows jsonb;
BEGIN
  v_id := coalesce(p_body->'id', 'null'::jsonb);
  v_method := p_body->>'method';
  v_params := coalesce(p_body->'params', '{}'::jsonb);

  SELECT value INTO v_settings FROM public.app_settings WHERE key = 'payments';
  v_key := coalesce(v_settings#>>'{payme,key}', '');

  -- Payme signs every call with Basic Paycom:<key>. No key configured means the
  -- shop is still in demo mode and must refuse everything.
  IF v_key = '' OR coalesce(v_settings->>'provider', 'demo') <> 'payme' THEN
    RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
      'code', -32504,
      'message', jsonb_build_object('uz', 'To''lov tizimi yoqilmagan', 'ru', 'Платежи не настроены', 'en', 'Payments are not configured')));
  END IF;

  v_expected := 'Basic ' || encode(('Paycom:' || v_key)::bytea, 'base64');
  IF coalesce(p_auth, '') <> v_expected THEN
    RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
      'code', -32504,
      'message', jsonb_build_object('uz', 'Ruxsat yo''q', 'ru', 'Недостаточно прав', 'en', 'Insufficient privileges')));
  END IF;

  -- ---- account lookup shared by most methods -------------------------------
  v_account := coalesce(v_params#>>'{account,order_id}', v_params#>>'{account,order}');
  IF v_account IS NOT NULL THEN
    SELECT * INTO v_order FROM public.orders
     WHERE upper(order_number) = upper(btrim(v_account));
    IF NOT FOUND THEN
      BEGIN
        SELECT * INTO v_order FROM public.orders WHERE id = v_account::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_order := NULL;
      END;
    END IF;
  END IF;

  -- =========================================================================
  IF v_method = 'CheckPerformTransaction' THEN
    v_amount := (v_params->>'amount')::bigint;
    IF v_order.id IS NULL THEN
      RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
        'code', -31050,
        'message', jsonb_build_object('uz', 'Buyurtma topilmadi', 'ru', 'Заказ не найден', 'en', 'Order not found')));
    END IF;
    IF v_order.status = 'cancelled' THEN
      RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
        'code', -31050,
        'message', jsonb_build_object('uz', 'Buyurtma bekor qilingan', 'ru', 'Заказ отменён', 'en', 'Order is cancelled')));
    END IF;
    IF (v_order.total * 100)::bigint <> v_amount THEN
      RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
        'code', -31001,
        'message', jsonb_build_object('uz', 'Summa noto''g''ri', 'ru', 'Неверная сумма', 'en', 'Wrong amount')));
    END IF;
    RETURN jsonb_build_object('id', v_id, 'result', jsonb_build_object('allow', true));

  -- =========================================================================
  ELSIF v_method = 'CreateTransaction' THEN
    v_amount := (v_params->>'amount')::bigint;

    SELECT * INTO v_tx FROM public.payme_transactions WHERE id = v_params->>'id';
    IF FOUND THEN
      IF v_tx.state <> 1 THEN
        RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
          'code', -31008,
          'message', jsonb_build_object('uz', 'Tranzaksiya holati mos emas', 'ru', 'Неверное состояние', 'en', 'Invalid state')));
      END IF;
      RETURN jsonb_build_object('id', v_id, 'result', jsonb_build_object(
        'create_time', v_tx.create_time, 'transaction', v_tx.id, 'state', v_tx.state));
    END IF;

    IF v_order.id IS NULL THEN
      RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
        'code', -31050,
        'message', jsonb_build_object('uz', 'Buyurtma topilmadi', 'ru', 'Заказ не найден', 'en', 'Order not found')));
    END IF;
    IF (v_order.total * 100)::bigint <> v_amount THEN
      RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
        'code', -31001,
        'message', jsonb_build_object('uz', 'Summa noto''g''ri', 'ru', 'Неверная сумма', 'en', 'Wrong amount')));
    END IF;
    -- One live transaction per order, as the protocol requires.
    IF EXISTS (SELECT 1 FROM public.payme_transactions
                WHERE order_id = v_order.id AND state IN (1, 2)) THEN
      RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
        'code', -31008,
        'message', jsonb_build_object('uz', 'Buyurtma band', 'ru', 'Заказ занят', 'en', 'Order is busy')));
    END IF;

    INSERT INTO public.payme_transactions (id, order_id, amount, state, create_time)
    VALUES (v_params->>'id', v_order.id, v_amount, 1,
            coalesce((v_params->>'time')::bigint, v_now));

    UPDATE public.orders
       SET payment_status = 'pending', payment_provider = 'payme',
           payment_ref = v_params->>'id'
     WHERE id = v_order.id;

    RETURN jsonb_build_object('id', v_id, 'result', jsonb_build_object(
      'create_time', coalesce((v_params->>'time')::bigint, v_now),
      'transaction', v_params->>'id',
      'state', 1));

  -- =========================================================================
  ELSIF v_method = 'PerformTransaction' THEN
    SELECT * INTO v_tx FROM public.payme_transactions WHERE id = v_params->>'id' FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
        'code', -31003,
        'message', jsonb_build_object('uz', 'Tranzaksiya topilmadi', 'ru', 'Транзакция не найдена', 'en', 'Transaction not found')));
    END IF;
    IF v_tx.state = 2 THEN
      RETURN jsonb_build_object('id', v_id, 'result', jsonb_build_object(
        'transaction', v_tx.id, 'perform_time', v_tx.perform_time, 'state', 2));
    END IF;
    IF v_tx.state <> 1 THEN
      RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
        'code', -31008,
        'message', jsonb_build_object('uz', 'Tranzaksiya bekor qilingan', 'ru', 'Транзакция отменена', 'en', 'Transaction cancelled')));
    END IF;

    UPDATE public.payme_transactions
       SET state = 2, perform_time = v_now WHERE id = v_tx.id;
    -- Money has actually arrived: this is the only place the shop marks paid.
    UPDATE public.orders
       SET payment_status = 'paid', payment_provider = 'payme'
     WHERE id = v_tx.order_id;

    RETURN jsonb_build_object('id', v_id, 'result', jsonb_build_object(
      'transaction', v_tx.id, 'perform_time', v_now, 'state', 2));

  -- =========================================================================
  ELSIF v_method = 'CancelTransaction' THEN
    SELECT * INTO v_tx FROM public.payme_transactions WHERE id = v_params->>'id' FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
        'code', -31003,
        'message', jsonb_build_object('uz', 'Tranzaksiya topilmadi', 'ru', 'Транзакция не найдена', 'en', 'Transaction not found')));
    END IF;
    v_reason := coalesce((v_params->>'reason')::int, 0);

    IF v_tx.state IN (-1, -2) THEN
      RETURN jsonb_build_object('id', v_id, 'result', jsonb_build_object(
        'transaction', v_tx.id, 'cancel_time', v_tx.cancel_time, 'state', v_tx.state));
    END IF;

    UPDATE public.payme_transactions
       SET state = CASE WHEN v_tx.state = 2 THEN -2 ELSE -1 END,
           cancel_time = v_now, reason = v_reason
     WHERE id = v_tx.id;

    -- Cancelling the order also returns every reserved size to stock, through
    -- the restock trigger that already exists.
    UPDATE public.orders
       SET payment_status = 'cancelled', status = 'cancelled'
     WHERE id = v_tx.order_id;

    RETURN jsonb_build_object('id', v_id, 'result', jsonb_build_object(
      'transaction', v_tx.id, 'cancel_time', v_now,
      'state', CASE WHEN v_tx.state = 2 THEN -2 ELSE -1 END));

  -- =========================================================================
  ELSIF v_method = 'CheckTransaction' THEN
    SELECT * INTO v_tx FROM public.payme_transactions WHERE id = v_params->>'id';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
        'code', -31003,
        'message', jsonb_build_object('uz', 'Tranzaksiya topilmadi', 'ru', 'Транзакция не найдена', 'en', 'Transaction not found')));
    END IF;
    RETURN jsonb_build_object('id', v_id, 'result', jsonb_build_object(
      'create_time', v_tx.create_time,
      'perform_time', v_tx.perform_time,
      'cancel_time', v_tx.cancel_time,
      'transaction', v_tx.id,
      'state', v_tx.state,
      'reason', v_tx.reason));

  -- =========================================================================
  ELSIF v_method = 'GetStatement' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'id', t.id,
             'time', t.create_time,
             'amount', t.amount,
             'account', jsonb_build_object('order_id', o.order_number),
             'create_time', t.create_time,
             'perform_time', t.perform_time,
             'cancel_time', t.cancel_time,
             'transaction', t.id,
             'state', t.state,
             'reason', t.reason
           ) ORDER BY t.create_time), '[]'::jsonb)
      INTO v_rows
      FROM public.payme_transactions t
      JOIN public.orders o ON o.id = t.order_id
     WHERE t.create_time BETWEEN (v_params->>'from')::bigint AND (v_params->>'to')::bigint;

    RETURN jsonb_build_object('id', v_id, 'result', jsonb_build_object('transactions', v_rows));
  END IF;

  RETURN jsonb_build_object('id', v_id, 'error', jsonb_build_object(
    'code', -32601,
    'message', jsonb_build_object('uz', 'Metod topilmadi', 'ru', 'Метод не найден', 'en', 'Method not found')));
END; $$;

REVOKE EXECUTE ON FUNCTION public.payme_rpc(text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.payme_rpc(text, jsonb) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Strings
-- ---------------------------------------------------------------------------
INSERT INTO public.translations (key, en, ru, uz) VALUES
  ('checkout.methodPayme','Payme','Payme','Payme'),
  ('checkout.paymeNote','Pay by card through Payme.','Оплата картой через Payme.','Payme orqali karta bilan to''lash.'),
  ('checkout.redirecting','Taking you to Payme…','Переходим в Payme…','Payme''ga o''tilmoqda…')
ON CONFLICT (key) DO NOTHING;
