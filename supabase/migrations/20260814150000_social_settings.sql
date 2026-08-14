-- Ijtimoiy tarmoq va AI kalitlari admin panelidan kiritiladi.
--
-- Payme qanday ishlasa, bu ham xuddi shunday: kalit kiritilmaguncha tizim
-- "sozlanmagan" deb turadi, kiritilgan zahoti ishlay boshlaydi. Kalitlar
-- app_settings ichida saqlanadi — u faqat admin uchun ochiq, xodimlar ham,
-- tashqi so'rovlar ham uni ko'ra olmaydi.

INSERT INTO public.app_settings (key, value) VALUES (
  'social',
  jsonb_build_object(
    'telegram_bot_token', '',
    'telegram_channel',   '',
    'facebook_app_id',    '',
    'facebook_app_secret','',
    'google_client_id',   '',
    'google_client_secret','',
    'gemini_api_key',     ''
  )
) ON CONFLICT (key) DO NOTHING;

-- Panel "qaysi tarmoq tayyor" ekanini bilishi kerak, lekin kalitlarning
-- o'zini ko'rmasligi kerak. Shuning uchun faqat "bor / yo'q" qaytariladi.
CREATE OR REPLACE FUNCTION public.social_status() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.has_permission('smm.read') THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  SELECT value INTO v FROM public.app_settings WHERE key = 'social';
  v := COALESCE(v, '{}'::jsonb);

  RETURN jsonb_build_object(
    'telegram', COALESCE(v->>'telegram_bot_token', '') <> ''
                AND COALESCE(v->>'telegram_channel', '') <> '',
    'instagram', COALESCE(v->>'facebook_app_id', '') <> ''
                AND COALESCE(v->>'facebook_app_secret', '') <> '',
    'youtube',  COALESCE(v->>'google_client_id', '') <> ''
                AND COALESCE(v->>'google_client_secret', '') <> '',
    'ai',       COALESCE(v->>'gemini_api_key', '') <> ''
  );
END;
$$;

REVOKE ALL ON FUNCTION public.social_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.social_status() TO authenticated;
