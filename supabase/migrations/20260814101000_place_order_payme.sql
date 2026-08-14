-- Placing an order that will be paid through Payme.
--
-- place_order stays the single place that prices a basket and moves stock; this
-- wrapper only changes what "paid" means. Card-through-Payme money has not
-- arrived when the order is created — it arrives when Payme calls
-- PerformTransaction — so the order starts pending and only payme_rpc marks it
-- paid. That distinction is the whole point of a real gateway.
CREATE OR REPLACE FUNCTION public.place_order_payme(
  p_customer_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_note text,
  p_lat double precision,
  p_lng double precision,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
  v_number text;
  v_cfg jsonb;
BEGIN
  v_cfg := public.payment_config();
  IF coalesce((v_cfg->>'live')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'PAYMENTS_NOT_LIVE';
  END IF;

  v_result := public.place_order(
    p_customer_name, p_phone, p_email, p_address, p_note,
    p_lat, p_lng, '', p_items, 'card'
  );

  v_number := v_result->>'order_number';
  UPDATE public.orders
     SET payment_status = 'pending',
         payment_provider = 'payme',
         payment_ref = NULL
   WHERE order_number = v_number;

  RETURN v_result
    || jsonb_build_object('payment_status', 'pending', 'payment_method', 'payme');
END; $$;

REVOKE EXECUTE ON FUNCTION public.place_order_payme(
  text, text, text, text, text, double precision, double precision, jsonb
) FROM public;
GRANT EXECUTE ON FUNCTION public.place_order_payme(
  text, text, text, text, text, double precision, double precision, jsonb
) TO anon, authenticated;
