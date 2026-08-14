-- Marketing: uchta lavozim o'rniga bitta. Va yangi lavozim — HR xodimi.
--
-- SMM/mobilograf, Onlayn SMM va Targetolog aslida bir odamning ishi edi:
-- suratga oladi, matn yozadi, e'lon qiladi, reklamani kuzatadi. Uchta
-- lavozim o'rniga bitta bo'lgani real holatga to'g'ri keladi.

-- ---------------------------------------------------------------- --
--  1. Uchta SMM lavozimini bittaga birlashtirish                     --
-- ---------------------------------------------------------------- --

INSERT INTO public.positions (department_id, code, title_uz, title_ru, headcount, permissions, sort_order)
SELECT d.id, 'smm', 'SMM menejeri', 'SMM-менеджер', 1,
       ARRAY['dashboard.view','smm.read','smm.write','ai.use','media.upload',
             'social.publish','ads.manage','content.read','content.write',
             'products.read','reports.read'],
       4
  FROM public.departments d
 WHERE d.code = 'marketing'
ON CONFLICT DO NOTHING;

-- Agar kimdir eski lavozimda ishlayotgan bo'lsa, yangisiga ko'chiriladi.
UPDATE public.employees e
   SET position_id = (SELECT id FROM public.positions WHERE code = 'smm')
 WHERE e.position_id IN (
   SELECT id FROM public.positions WHERE code IN ('smm_mobile','smm_online','targetolog')
 );

DELETE FROM public.positions WHERE code IN ('smm_mobile','smm_online','targetolog');

-- ---------------------------------------------------------------- --
--  2. HR xodimi                                                      --
-- ---------------------------------------------------------------- --

-- HR odamlar bilan ishlaydi: kim ishga olindi, kim qaysi lavozimda, kim
-- smenada. Pulga ham, tovarga ham, mijozga ham tegmaydi.
INSERT INTO public.positions (department_id, code, title_uz, title_ru, headcount, permissions, sort_order)
SELECT d.id, 'hr', 'HR xodimi', 'HR-менеджер', 1,
       ARRAY['dashboard.view','staff.read','staff.manage','shift.read'],
       4
  FROM public.departments d
 WHERE d.code = 'director'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------- --
--  3. HR xodimlarni boshqara olsin                                   --
-- ---------------------------------------------------------------- --

DROP POLICY IF EXISTS "employees hr read" ON public.employees;
CREATE POLICY "employees hr read" ON public.employees
  FOR SELECT TO authenticated USING (public.has_permission('staff.read'));

DROP POLICY IF EXISTS "employees hr write" ON public.employees;
CREATE POLICY "employees hr write" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('staff.manage'));

DROP POLICY IF EXISTS "employees hr update" ON public.employees;
CREATE POLICY "employees hr update" ON public.employees
  FOR UPDATE TO authenticated
  USING (public.has_permission('staff.manage'))
  WITH CHECK (public.has_permission('staff.manage'));

-- HR o'chirmaydi — ketgan xodim "faol emas" qilinadi, tarixi saqlanadi.

-- ---------------------------------------------------------------- --
--  4. Huquqni oshirib yuborishning oldini olish                      --
-- ---------------------------------------------------------------- --

-- HR odam qo'sha oladi, lekin uni direktor qila olmaydi. Aks holda HR
-- o'zini yoki do'stini '*' huquqli lavozimga o'tkazib, butun tizimni
-- egallab olardi. Faqat admin shunday lavozim biriktira oladi.
CREATE OR REPLACE FUNCTION public.guard_position_grant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perms text[];
BEGIN
  IF NEW.position_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT permissions INTO v_perms FROM public.positions WHERE id = NEW.position_id;

  IF v_perms @> ARRAY['*'] THEN
    RAISE EXCEPTION 'FORBIDDEN_POSITION';
  END IF;

  -- HR o'ziga ham, boshqaga ham xodim boshqarish huquqini bera olmaydi.
  IF v_perms @> ARRAY['staff.manage'] AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN_POSITION';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_guard_position ON public.employees;
CREATE TRIGGER employees_guard_position
  BEFORE INSERT OR UPDATE OF position_id ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.guard_position_grant();
