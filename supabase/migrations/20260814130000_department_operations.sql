-- What the six cabinets actually record.
--
-- Until now the panels could only read what the shop already had. These are the
-- tables each department writes to, so the cabinets stop being dashboards and
-- start being tools:
--   Savdo zali -> shifts + cash sessions + cash movements
--   Moliya     -> finance entries (the ledger the director's numbers come from)
--   Ta'minot   -> supply orders and their lines
--   Direktor   -> reads all of it; Marketing already has leads.
--
-- Access follows position permissions via has_permission(), so a cashier can
-- open a till but not sign off a supply order.

-- ---------------------------------------------------------------------------
-- 1. Shifts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shifts_employee_idx ON public.shifts (employee_id, started_at DESC);
-- One open shift per person: a second check-in without a check-out is a mistake.
CREATE UNIQUE INDEX IF NOT EXISTS shifts_one_open_per_employee
  ON public.shifts (employee_id) WHERE ended_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Cash register
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_float numeric(12,2) NOT NULL DEFAULT 0,
  counted_cash numeric(12,2),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open
  ON public.cash_sessions (employee_id) WHERE closed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('sale', 'refund', 'expense', 'deposit', 'withdrawal')),
  amount numeric(12,2) NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cash_movements_session_idx ON public.cash_movements (session_id);

-- Expected drawer contents, so the close screen can show the difference.
CREATE OR REPLACE FUNCTION public.cash_expected(p_session uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT coalesce((SELECT opening_float FROM public.cash_sessions WHERE id = p_session), 0)
       + coalesce((
           SELECT sum(CASE WHEN kind IN ('sale', 'deposit') THEN amount ELSE -amount END)
             FROM public.cash_movements WHERE session_id = p_session
         ), 0)
$fn$;
REVOKE EXECUTE ON FUNCTION public.cash_expected(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cash_expected(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Finance ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('income', 'expense')),
  category text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  happened_on date NOT NULL DEFAULT current_date,
  note text,
  created_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finance_entries_date_idx
  ON public.finance_entries (happened_on DESC, kind);

-- ---------------------------------------------------------------------------
-- 4. Supply
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supply_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
  expected_on date,
  received_on date,
  total numeric(12,2) NOT NULL DEFAULT 0,
  note text,
  created_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS supply_orders_touch ON public.supply_orders;
CREATE TRIGGER supply_orders_touch BEFORE UPDATE ON public.supply_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.supply_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_order_id uuid NOT NULL REFERENCES public.supply_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  title text NOT NULL,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supply_items_order_idx ON public.supply_items (supply_order_id);

-- Receiving a delivery puts the goods on the shelf and books the cost in one
-- step — the two things that were always done by hand and always drifted apart.
CREATE OR REPLACE FUNCTION public.receive_supply_order(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_order public.supply_orders%ROWTYPE;
  v_total numeric(12,2);
  v_lines int;
BEGIN
  IF NOT public.has_permission('supply.manage') THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;

  SELECT * INTO v_order FROM public.supply_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_order.status = 'received' THEN RAISE EXCEPTION 'ALREADY_RECEIVED'; END IF;

  UPDATE public.product_variants v
     SET stock = v.stock + agg.qty
    FROM (
      SELECT variant_id, sum(quantity)::int AS qty
        FROM public.supply_items
       WHERE supply_order_id = p_id AND variant_id IS NOT NULL
       GROUP BY variant_id
    ) agg
   WHERE agg.variant_id = v.id;

  SELECT coalesce(sum(quantity * unit_cost), 0), count(*)
    INTO v_total, v_lines
    FROM public.supply_items WHERE supply_order_id = p_id;

  UPDATE public.supply_orders
     SET status = 'received', received_on = current_date, total = v_total
   WHERE id = p_id;

  INSERT INTO public.finance_entries (kind, category, amount, note, created_by)
  VALUES ('expense', 'Tovar sotib olish', v_total, 'Ta''minot: ' || v_order.supplier,
          v_order.created_by);

  RETURN jsonb_build_object('lines', v_lines, 'total', v_total);
END; $fn$;
REVOKE EXECUTE ON FUNCTION public.receive_supply_order(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.receive_supply_order(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Access — by permission, never by anon
-- ---------------------------------------------------------------------------
DO $do$
DECLARE
  t text;
  pairs text[][] := ARRAY[
    ARRAY['shifts', 'shift.read', 'shift.manage'],
    ARRAY['cash_sessions', 'cash.register', 'cash.register'],
    ARRAY['cash_movements', 'cash.register', 'cash.register'],
    ARRAY['finance_entries', 'finance.read', 'finance.write'],
    ARRAY['supply_orders', 'products.read', 'supply.manage'],
    ARRAY['supply_items', 'products.read', 'supply.manage']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(pairs, 1) LOOP
    t := pairs[i][1];
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);

    EXECUTE format('DROP POLICY IF EXISTS "%s read" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s read" ON public.%I FOR SELECT TO authenticated USING (public.has_permission(%L))',
      t, t, pairs[i][2]);

    EXECUTE format('DROP POLICY IF EXISTS "%s write" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s write" ON public.%I FOR ALL TO authenticated '
      'USING (public.has_permission(%L)) WITH CHECK (public.has_permission(%L))',
      t, t, pairs[i][3], pairs[i][3]);
  END LOOP;
END $do$;

-- Everyone may open and close their own shift even without shift.read.
DROP POLICY IF EXISTS "shifts own" ON public.shifts;
CREATE POLICY "shifts own" ON public.shifts FOR ALL TO authenticated
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
