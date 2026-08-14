-- Three things the owner asked for:
--   1. One studio password instead of per-person accounts
--   2. Legal pages (public offer, privacy, returns) stored as editable content
--   3. A Telegram ping when an order lands
--
-- The legal copy below is a working draft written for a small Uzbek online
-- clothing shop. Every <SQUARE BRACKET> is a blank the owner must fill in, and
-- a lawyer should read it once before the shop takes real money.

-- ---------------------------------------------------------------------------
-- 1. The single studio account
-- ---------------------------------------------------------------------------
INSERT INTO public.admin_allowlist (email, note)
VALUES ('studio@yesmine.uz', 'Studio login — one shared password')
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Legal documents
-- ---------------------------------------------------------------------------
INSERT INTO public.site_content (key, value) VALUES
('legal_offer', jsonb_build_object(
  'title_uz', 'Ommaviy oferta shartnomasi',
  'title_ru', 'Договор публичной оферты',
  'title_en', 'Public offer agreement',
  'updated', '2026-08-13',
  'body_uz', E'1. UMUMIY QOIDALAR\n'
    || E'1.1. Ushbu hujjat — <YURIDIK NOM> (keyingi o''rinlarda "Sotuvchi", STIR: <STIR RAQAMI>, manzil: <YURIDIK MANZIL>) tomonidan yesmine.uz saytida joylashtirilgan ommaviy oferta hisoblanadi.\n'
    || E'1.2. Saytda buyurtma rasmiylashtirgan har qanday jismoniy shaxs (keyingi o''rinlarda "Xaridor") ushbu shartnoma shartlarini to''liq qabul qilgan hisoblanadi.\n'
    || E'1.3. Sotuvchi shartnoma shartlarini bir tomonlama o''zgartirish huquqini saqlab qoladi. Yangi tahrir saytda e''lon qilingan paytdan kuchga kiradi va undan keyin berilgan buyurtmalarga nisbatan qo''llaniladi.\n\n'
    || E'2. SHARTNOMA PREDMETI\n'
    || E'2.1. Sotuvchi saytda ko''rsatilgan tovarlarni (ayollar kiyimi va aksessuarlari) Xaridorga sotish, Xaridor esa ularni qabul qilib to''lash majburiyatini oladi.\n'
    || E'2.2. Tovar tavsifi, o''lchami, rangi va narxi tovar sahifasida ko''rsatiladi. Rasmdagi rang monitor sozlamalariga qarab ozgina farq qilishi mumkin.\n\n'
    || E'3. BUYURTMA VA NARX\n'
    || E'3.1. Buyurtma sayt orqali rasmiylashtiriladi. Xaridor ism-familiya, telefon raqami va yetkazib berish manzilini to''g''ri ko''rsatishi shart.\n'
    || E'3.2. Barcha narxlar O''zbekiston so''mida ko''rsatilgan. Buyurtma yakuniy summasi buyurtma tasdiqlangan paytdagi narx bo''yicha belgilanadi va keyin o''zgarmaydi.\n'
    || E'3.3. Yetkazib berish narxi buyurtma summasiga qarab hisoblanadi va savatda alohida ko''rsatiladi.\n'
    || E'3.4. Sotuvchi tovar omborda qolmagan taqdirda buyurtmani bekor qilish huquqiga ega. Bunday holda to''langan summa to''liq qaytariladi.\n\n'
    || E'4. TO''LOV\n'
    || E'4.1. To''lov usullari: kuryerga naqd pul orqali yoki saytda ko''rsatilgan boshqa usullar bilan.\n'
    || E'4.2. Naqd to''lovda summa tovar topshirilayotgan paytda kuryerga to''lanadi.\n\n'
    || E'5. YETKAZIB BERISH\n'
    || E'5.1. Yetkazib berish Toshkent shahri bo''ylab <MUDDAT> ish kuni ichida, viloyatlarga <MUDDAT> ish kuni ichida amalga oshiriladi.\n'
    || E'5.2. Xaridor buyurtma berayotganda xaritada yetkazib berish nuqtasini belgilaydi. Noto''g''ri ko''rsatilgan manzil sababli yuzaga kelgan kechikish uchun Sotuvchi javobgar emas.\n'
    || E'5.3. Tovarni qabul qilishda Xaridor uning tashqi ko''rinishi va to''liqligini tekshirib olishi tavsiya etiladi.\n\n'
    || E'6. QAYTARISH\n'
    || E'6.1. Qaytarish tartibi saytdagi "Tovarni qaytarish" hujjatida belgilangan va ushbu shartnomaning ajralmas qismi hisoblanadi.\n\n'
    || E'7. TOMONLARNING JAVOBGARLIGI\n'
    || E'7.1. Tomonlar O''zbekiston Respublikasi qonunchiligiga muvofiq javobgar bo''ladilar.\n'
    || E'7.2. Sotuvchi yengib bo''lmas kuch holatlari (force majeure) tufayli majburiyatlarni bajara olmaganligi uchun javobgar emas.\n\n'
    || E'8. NIZOLARNI HAL QILISH\n'
    || E'8.1. Nizolar muzokaralar yo''li bilan hal etiladi. Kelishuvga erishilmasa, nizo O''zbekiston Respublikasi qonunchiligiga muvofiq sud tartibida ko''riladi.\n\n'
    || E'9. REKVIZITLAR\n'
    || E'Nomi: <YURIDIK NOM>\nSTIR: <STIR RAQAMI>\nManzil: <YURIDIK MANZIL>\nTelefon: <TELEFON>\nEmail: <EMAIL>\nBank: <BANK NOMI>, h/r <HISOB RAQAMI>, MFO <MFO>'
))
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_content (key, value) VALUES
('legal_privacy', jsonb_build_object(
  'title_uz', 'Maxfiylik siyosati',
  'title_ru', 'Политика конфиденциальности',
  'title_en', 'Privacy policy',
  'updated', '2026-08-13',
  'body_uz', E'1. BIZ QANDAY MA''LUMOTLARNI YIG''AMIZ\n'
    || E'1.1. Buyurtma berishda: ism-familiya, telefon raqami, elektron pochta (ixtiyoriy), yetkazib berish manzili va xaritada belgilangan koordinatalar.\n'
    || E'1.2. Aloqa formasi orqali: ism, elektron pochta va xabar matni.\n'
    || E'1.3. Yangiliklarga obuna bo''lganda: elektron pochta manzili.\n'
    || E'1.4. Biz karta ma''lumotlarini (karta raqami, amal qilish muddati, CVV) saqlamaymiz.\n\n'
    || E'2. MA''LUMOTLARDAN QANDAY FOYDALANAMIZ\n'
    || E'2.1. Buyurtmani rasmiylashtirish, tayyorlash va yetkazib berish uchun.\n'
    || E'2.2. Buyurtma bo''yicha siz bilan bog''lanish uchun.\n'
    || E'2.3. Siz roziligingizni bergan bo''lsangiz — yangiliklar va aksiyalar haqida xabar berish uchun.\n'
    || E'2.4. Biz ma''lumotlaringizni uchinchi shaxslarga sotmaymiz.\n\n'
    || E'3. MA''LUMOTLARNI UZATISH\n'
    || E'3.1. Yetkazib berish uchun zarur bo''lgan ma''lumotlar (ism, telefon, manzil) kuryerlik xizmatiga uzatiladi.\n'
    || E'3.2. Ma''lumotlar Supabase bulut xizmatida saqlanadi.\n'
    || E'3.3. Qonun talab qilgan hollarda vakolatli davlat organlariga taqdim etilishi mumkin.\n\n'
    || E'4. SAQLASH MUDDATI\n'
    || E'4.1. Buyurtma ma''lumotlari buxgalteriya hisobi uchun zarur muddat davomida saqlanadi.\n'
    || E'4.2. Obuna ma''lumotlari siz obunani bekor qilguningizga qadar saqlanadi.\n\n'
    || E'5. SIZNING HUQUQLARINGIZ\n'
    || E'5.1. Siz o''zingiz haqingizdagi ma''lumotlarni so''rash, tuzatish yoki o''chirishni talab qilish huquqiga egasiz.\n'
    || E'5.2. Buning uchun <EMAIL> manziliga murojaat qiling — so''rovingiz 10 ish kuni ichida ko''rib chiqiladi.\n\n'
    || E'6. COOKIE FAYLLARI\n'
    || E'6.1. Sayt savat tarkibi va tanlangan tilni brauzeringizning lokal xotirasida saqlaydi. Bu ma''lumot serverga yuborilmaydi.\n\n'
    || E'7. BOG''LANISH\n'
    || E'Savollar bo''yicha: <EMAIL>, <TELEFON>'
))
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_content (key, value) VALUES
('legal_returns', jsonb_build_object(
  'title_uz', 'Tovarni qaytarish va almashtirish',
  'title_ru', 'Возврат и обмен товара',
  'title_en', 'Returns and exchanges',
  'updated', '2026-08-13',
  'body_uz', E'1. QAYTARISH MUDDATI\n'
    || E'1.1. Sifatli tovarni tovar qabul qilingan kundan boshlab 14 (o''n to''rt) kun ichida qaytarish yoki almashtirish mumkin.\n'
    || E'1.2. Sifatsiz yoki nuqsonli tovar aniqlanganda darhol <TELEFON> raqamiga xabar bering.\n\n'
    || E'2. QAYTARISH SHARTLARI\n'
    || E'2.1. Tovar kiyilmagan, yuvilmagan va ishlatilmagan bo''lishi kerak.\n'
    || E'2.2. Zavod yorliqlari va butligi saqlangan bo''lishi shart.\n'
    || E'2.3. Tovar o''zining original qadog''ida qaytarilishi kerak.\n'
    || E'2.4. Buyurtma raqami yoki to''lovni tasdiqlovchi hujjat taqdim etilishi lozim.\n\n'
    || E'3. QAYTARIB BO''LMAYDIGAN TOVARLAR\n'
    || E'3.1. Gigiyena talablari sababli ichki kiyim va cho''milish kiyimlari qaytarilmaydi.\n'
    || E'3.2. Xaridorning individual o''lchovi bo''yicha tikilgan tovarlar qaytarilmaydi.\n'
    || E'3.3. Aksiya doirasida sotilgan va bu haqda alohida ogohlantirilgan tovarlar.\n\n'
    || E'4. QAYTARISH TARTIBI\n'
    || E'4.1. <TELEFON> raqamiga qo''ng''iroq qiling yoki <EMAIL> manziliga yozing va buyurtma raqamini ayting.\n'
    || E'4.2. Biz qaytarish usulini kelishib olamiz.\n'
    || E'4.3. Tovar bizga yetib kelgach, u shartlarga mos ekanligi tekshiriladi.\n\n'
    || E'5. PULNI QAYTARISH\n'
    || E'5.1. Tovar tekshiruvdan o''tgach, pul <MUDDAT> ish kuni ichida qaytariladi.\n'
    || E'5.2. Pul to''lov amalga oshirilgan usulda qaytariladi.\n'
    || E'5.3. Tovar nuqsonli bo''lgan hollarda yetkazib berish xarajati ham qaytariladi. Boshqa hollarda qaytarish xarajati Xaridor zimmasida.\n\n'
    || E'6. ALMASHTIRISH\n'
    || E'6.1. O''lcham yoki rangni almashtirish omborda mos variant mavjud bo''lsa amalga oshiriladi.\n'
    || E'6.2. Almashtirish uchun ham yuqoridagi 2-bandda ko''rsatilgan shartlar amal qiladi.'
))
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Telegram notification on a new order
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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
  PERFORM extensions.net.http_post(
    url := 'https://api.telegram.org/bot' || (v_cfg->>'bot_token') || '/sendMessage',
    body := jsonb_build_object(
      'chat_id', v_cfg->>'chat_id',
      'text', v_text,
      'parse_mode', 'HTML'
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END; $$;

-- place_order inserts the row with zero totals and fills them in a moment
-- later, so the notification fires on that update, not on the insert.
DROP TRIGGER IF EXISTS orders_notify_telegram ON public.orders;
CREATE TRIGGER orders_notify_telegram
  AFTER UPDATE OF total ON public.orders
  FOR EACH ROW
  WHEN (OLD.total = 0 AND NEW.total > 0)
  EXECUTE FUNCTION public.notify_new_order();

-- Lets the admin panel prove the token works without placing a real order.
CREATE OR REPLACE FUNCTION public.telegram_test() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cfg jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;

  SELECT value INTO v_cfg FROM public.app_settings WHERE key = 'telegram';
  IF coalesce(v_cfg->>'bot_token', '') = '' OR coalesce(v_cfg->>'chat_id', '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Bot token and chat id are required.');
  END IF;

  PERFORM extensions.net.http_post(
    url := 'https://api.telegram.org/bot' || (v_cfg->>'bot_token') || '/sendMessage',
    body := jsonb_build_object(
      'chat_id', v_cfg->>'chat_id',
      'text', '✅ Yesmine studio is connected to this chat.'
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN jsonb_build_object('ok', true, 'message', 'Test message queued — check your chat.');
END; $$;
REVOKE EXECUTE ON FUNCTION public.telegram_test() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.telegram_test() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Strings for the legal pages
-- ---------------------------------------------------------------------------
INSERT INTO public.translations (key, en, ru, uz) VALUES
  ('legal.offer','Public offer','Публичная оферта','Ommaviy oferta'),
  ('legal.privacy','Privacy policy','Политика конфиденциальности','Maxfiylik siyosati'),
  ('legal.returns','Returns','Возврат товара','Tovarni qaytarish'),
  ('legal.updated','Last updated','Обновлено','Yangilangan'),
  ('legal.heading','Legal','Правовая информация','Huquqiy ma''lumot'),
  ('auth.studioPassword','Studio password','Пароль студии','Studio paroli'),
  ('auth.studioHint','Enter the shop password to open the studio.','Введите пароль магазина, чтобы войти в студию.','Studioga kirish uchun do''kon parolini kiriting.')
ON CONFLICT (key) DO NOTHING;
