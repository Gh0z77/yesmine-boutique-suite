-- Yesmine org chart: departments, positions and staff.
--
-- Until now the whole business shared one login. This is the structure that
-- replaces it: six departments, the real job list with real headcounts, and a
-- permission set per position rather than per person — so hiring a third
-- cashier means adding an employee, not inventing new rules.
--
-- Passwords are deliberately NOT handled here. An employee row exists first
-- with no account; the owner invites them, they set their own password, and
-- only then does user_id get filled in. Nobody, including whoever runs this
-- migration, ever types another person's password.

-- ---------------------------------------------------------------------------
-- 1. Departments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_uz text NOT NULL,
  name_ru text NOT NULL DEFAULT '',
  name_en text NOT NULL DEFAULT '',
  panel text NOT NULL,              -- which cabinet its staff land in
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.departments (code, name_uz, name_ru, name_en, panel, sort_order) VALUES
  ('director',  'Direktor bo''limi',   'Дирекция',            'Directorate',   'director',  1),
  ('marketing', 'Marketing bo''limi',  'Отдел маркетинга',    'Marketing',     'marketing', 2),
  ('sales1',    'Savdo zali 1',        'Торговый зал 1',      'Sales floor 1', 'sales',     3),
  ('sales2',    'Savdo zali 2',        'Торговый зал 2',      'Sales floor 2', 'sales',     4),
  ('finance',   'Moliya bo''limi',     'Финансовый отдел',    'Finance',       'finance',   5),
  ('supply',    'Ta''minot bo''limi',  'Отдел снабжения',     'Supply',        'supply',    6)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Positions — the job list, with how many of each the shop runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  title_uz text NOT NULL,
  title_ru text NOT NULL DEFAULT '',
  headcount int NOT NULL DEFAULT 1,   -- planned number of people
  -- What this job may do. Checked by has_permission(); '*' means everything.
  permissions text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.positions (department_id, code, title_uz, title_ru, headcount, permissions, sort_order)
SELECT d.id, p.code, p.title_uz, p.title_ru, p.headcount, p.perms, p.sort_order
FROM (VALUES
  -- Direktor bo'limi
  ('director','director','Direktor','Директор',1,
     ARRAY['*'],1),
  ('director','exec_director','Ijrochi direktor','Исполнительный директор',1,
     ARRAY['dashboard.view','orders.read','orders.update','products.read','products.write',
           'staff.read','finance.read','leads.read','reports.read'],2),
  ('director','cctv','Kamera nazoratchisi','Оператор видеонаблюдения',1,
     ARRAY['dashboard.view','cctv.view'],3),

  -- Marketing bo'limi
  ('marketing','rop','ROP (sotuv rahbari)','РОП',1,
     ARRAY['dashboard.view','leads.read','leads.write','leads.assign','operators.manage',
           'orders.read','reports.read'],1),
  ('marketing','operator','Operator','Оператор',5,
     ARRAY['leads.read','leads.write','orders.read'],2),
  ('marketing','model','Model','Модель',3,
     ARRAY['content.read'],3),
  ('marketing','smm_mobile','SMM / mobilograf','SMM / мобилограф',1,
     ARRAY['content.read','content.write','media.upload'],4),
  ('marketing','smm_online','Onlayn SMM','Онлайн SMM',1,
     ARRAY['content.read','content.write','media.upload','products.read'],5),
  ('marketing','targetolog','Onlayn targetolog','Таргетолог',1,
     ARRAY['reports.read','leads.read','content.read'],6),

  -- Savdo zali 1
  ('sales1','sales_manager_1','Savdo zal menejeri','Менеджер торгового зала',1,
     ARRAY['dashboard.view','orders.read','orders.update','products.read','stock.write',
           'staff.read','shift.manage'],1),
  ('sales1','cashier_1','Kassir','Кассир',2,
     ARRAY['orders.read','orders.update','cash.register'],2),
  ('sales1','seller_1','Sotuvchi','Продавец',4,
     ARRAY['products.read','orders.read','stock.read'],3),
  ('sales1','merch_lingerie','Nijnee belyo bo''limi merchandayzeri','Мерчендайзер отдела белья',1,
     ARRAY['products.read','stock.read','stock.write'],4),
  ('sales1','merch_scarves','Ro''mol bo''limi merchandayzeri','Мерчендайзер отдела платков',1,
     ARRAY['products.read','stock.read','stock.write'],5),

  -- Savdo zali 2
  ('sales2','sales_manager_2','Savdo zal menejeri','Менеджер торгового зала',1,
     ARRAY['dashboard.view','orders.read','orders.update','products.read','stock.write',
           'staff.read','shift.manage'],1),
  ('sales2','cashier_2','Kassir','Кассир',1,
     ARRAY['orders.read','orders.update','cash.register'],2),
  ('sales2','seller_2','Sotuvchi','Продавец',4,
     ARRAY['products.read','orders.read','stock.read'],3),
  ('sales2','cleaner','Tozalik xodimi','Уборщица',1,
     ARRAY['shift.read'],4),
  ('sales2','ironer','Dazmolchi','Гладильщица',1,
     ARRAY['shift.read'],5),

  -- Moliya bo'limi
  ('finance','financier','Moliyachi','Финансист',1,
     ARRAY['dashboard.view','finance.read','finance.write','orders.read','reports.read'],1),

  -- Ta'minot bo'limi
  ('supply','supplier','Ta''minotchi','Снабженец',1,
     ARRAY['dashboard.view','products.read','products.write','stock.read','stock.write',
           'supply.manage'],1)
) AS p(dept, code, title_uz, title_ru, headcount, perms, sort_order)
JOIN public.departments d ON d.code = p.dept
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Employees — a person, optionally linked to a login
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL until the person accepts an invite and creates their own password.
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text,
  email text UNIQUE,
  hired_at date NOT NULL DEFAULT current_date,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS employees_touch ON public.employees;
CREATE TRIGGER employees_touch BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS employees_position_idx ON public.employees (position_id);

-- ---------------------------------------------------------------------------
-- 4. Permissions
-- ---------------------------------------------------------------------------
-- The admin keeps everything; everyone else gets exactly what their job grants.
CREATE OR REPLACE FUNCTION public.has_permission(p_code text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
        FROM public.employees e
        JOIN public.positions p ON p.id = e.position_id
       WHERE e.user_id = auth.uid()
         AND e.active
         AND p.active
         AND (p.permissions @> ARRAY['*'] OR p.permissions @> ARRAY[p_code])
    )
$$;
REVOKE EXECUTE ON FUNCTION public.has_permission(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

/** What the signed-in person is: their employee row, job, department and rights. */
CREATE OR REPLACE FUNCTION public.my_profile() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
           'employee_id', e.id,
           'full_name', e.full_name,
           'position', p.code,
           'position_title', p.title_uz,
           'department', d.code,
           'department_name', d.name_uz,
           'panel', d.panel,
           'permissions', to_jsonb(p.permissions),
           'is_admin', public.has_role(auth.uid(), 'admin')
         )
    INTO v
    FROM public.employees e
    LEFT JOIN public.positions p ON p.id = e.position_id
    LEFT JOIN public.departments d ON d.id = p.department_id
   WHERE e.user_id = auth.uid() AND e.active;

  -- The owner has no employee row but still needs a profile.
  IF v IS NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object(
      'full_name', 'Studio', 'position', 'director', 'panel', 'director',
      'permissions', to_jsonb(ARRAY['*']), 'is_admin', true);
  END IF;

  RETURN v;
END; $$;
REVOKE EXECUTE ON FUNCTION public.my_profile() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Row level security
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['departments', 'positions', 'employees'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s admin write" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s admin write" ON public.%I FOR ALL TO authenticated '
      'USING (public.has_role(auth.uid(), ''admin'')) '
      'WITH CHECK (public.has_role(auth.uid(), ''admin''))', t, t);
  END LOOP;
END $$;

-- Staff may read the structure they work inside, and their own record.
DROP POLICY IF EXISTS "departments staff read" ON public.departments;
CREATE POLICY "departments staff read" ON public.departments FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "positions staff read" ON public.positions;
CREATE POLICY "positions staff read" ON public.positions FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "employees self read" ON public.employees;
CREATE POLICY "employees self read" ON public.employees FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission('staff.read'));

-- ---------------------------------------------------------------------------
-- 6. Linking a login to an employee, without ever touching a password
-- ---------------------------------------------------------------------------
-- The owner adds the person's email to the allow list and creates the employee
-- row; the person signs up themselves and this claims the matching row.
CREATE OR REPLACE FUNCTION public.link_employee_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.employees
     SET user_id = NEW.id
   WHERE lower(email) = lower(NEW.email)
     AND user_id IS NULL;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_link_employee ON auth.users;
CREATE TRIGGER on_auth_user_link_employee
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_employee_account();

-- Adding an employee also opens the door for exactly that address.
CREATE OR REPLACE FUNCTION public.allow_employee_signup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    INSERT INTO public.admin_allowlist (email, note)
    VALUES (lower(btrim(NEW.email)), 'Xodim: ' || NEW.full_name)
    ON CONFLICT (email) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS employees_allow_signup ON public.employees;
CREATE TRIGGER employees_allow_signup
  AFTER INSERT OR UPDATE OF email ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.allow_employee_signup();
