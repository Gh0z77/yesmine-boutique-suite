-- Lavozim biriktirish himoyasini aniqlashtirish.
--
-- Birinchi variant haddan tashqari qattiq chiqdi: u JWT umuman bo'lmagan
-- holatni ham (migratsiya, service_role, ma'lumot ko'chirish) huquq oshirish
-- deb hisoblab, bloklab qo'ydi.
--
-- To'g'ri chegara shu: kim yozayotganini RLS allaqachon hal qilgan bo'ladi —
-- anon odam employees jadvaliga umuman yoza olmaydi. Bu trigger esa faqat
-- bitta savolga javob beradi: "kirgan foydalanuvchi o'zidan baland lavozim
-- biriktirmoqchimi?" JWT yo'q bo'lsa, bu savolning ma'nosi yo'q.
CREATE OR REPLACE FUNCTION public.guard_position_grant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perms text[];
BEGIN
  IF NEW.position_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Server tomonidagi ish (migratsiya, service_role): RLS gate'idan o'tgan.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Do'kon egasiga cheklov yo'q.
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT permissions INTO v_perms FROM public.positions WHERE id = NEW.position_id;

  -- Hamma huquqli lavozim, yoki xodim boshqarish huquqi — faqat egasi beradi.
  -- Aks holda HR o'zini yoki tanishini direktor qilib qo'yardi.
  IF v_perms @> ARRAY['*'] OR v_perms @> ARRAY['staff.manage'] THEN
    RAISE EXCEPTION 'FORBIDDEN_POSITION';
  END IF;

  RETURN NEW;
END;
$$;
