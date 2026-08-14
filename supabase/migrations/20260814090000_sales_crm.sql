-- Stage 2 of the sales desk: the lead pipeline.
--
-- The storefront sells to strangers who never log in, so "who is talking to
-- whom" has nowhere to live. These tables are that missing half: the people
-- who sell (operators), the people being sold to (leads), where they came
-- from (sources) and everything that happened in between (events).
--
-- Calls and meetings share one `lead_events` table rather than two nearly
-- identical ones — a lead's history reads as a single timeline, and the Calls
-- and Meetings screens are just filters over it.

-- ---------------------------------------------------------------------------
-- 1. Who sells
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  color text NOT NULL DEFAULT '#C4145A',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Where leads come from
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.lead_sources (name, sort_order) VALUES
  ('Instagram', 1),
  ('Telegram', 2),
  ('Sayt', 3),
  ('Tavsiya', 4),
  ('Do''konga kelgan', 5)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. The leads themselves
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
    CREATE TYPE public.lead_status AS ENUM ('new', 'in_work', 'callback', 'won', 'lost');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  status public.lead_status NOT NULL DEFAULT 'new',
  source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  operator_id uuid REFERENCES public.sales_operators(id) ON DELETE SET NULL,
  -- What the deal is worth: expected while open, actual once won.
  amount numeric(12,2) NOT NULL DEFAULT 0,
  -- A won lead points at the order it turned into, closing the loop with the shop.
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  loss_reason text,
  note text,
  next_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_status_idx ON public.leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_operator_idx ON public.leads (operator_id);
CREATE INDEX IF NOT EXISTS leads_phone_idx ON public.leads (phone);

-- ---------------------------------------------------------------------------
-- 4. One timeline for calls, meetings and notes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('call', 'meeting', 'note')),
  outcome text,
  note text,
  duration_sec int,
  operator_id uuid REFERENCES public.sales_operators(id) ON DELETE SET NULL,
  happened_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_events_lead_idx ON public.lead_events (lead_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS lead_events_kind_idx ON public.lead_events (kind, happened_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Timestamps
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS sales_operators_touch ON public.sales_operators;
CREATE TRIGGER sales_operators_touch BEFORE UPDATE ON public.sales_operators
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS leads_touch ON public.leads;
CREATE TRIGGER leads_touch BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Internal data — admins only, never the storefront
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales_operators', 'lead_sources', 'leads', 'lead_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s admin only" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s admin only" ON public.%I FOR ALL TO authenticated '
      'USING (public.has_role(auth.uid(), ''admin'')) '
      'WITH CHECK (public.has_role(auth.uid(), ''admin''))', t, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Turning a won lead into a real order is the one link back to the shop
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lead_funnel()
RETURNS TABLE (status text, leads int, amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  RETURN QUERY
    SELECT l.status::text, count(*)::int, coalesce(sum(l.amount), 0)
      FROM public.leads l
     GROUP BY l.status;
END; $$;
REVOKE EXECUTE ON FUNCTION public.lead_funnel() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.lead_funnel() TO authenticated;
