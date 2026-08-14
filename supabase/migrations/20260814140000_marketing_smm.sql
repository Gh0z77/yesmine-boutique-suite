-- Marketing bo'limi: SMM, mobilograf, targetolog va AI yordamchisi.
--
-- Uchta lavozim bitta panelda ishlaydi va bir xil kontent rejasiga qaraydi:
--   · mobilograf   — suratga oladi, media yuklaydi
--   · onlayn SMM   — matn yozadi, e'lon qiladi
--   · targetolog   — reklama byudjetini boshqaradi
-- Ular bir-birining ishini ko'radi (kontent reja umumiy), lekin faqat o'z
-- huquqi doirasida o'zgartira oladi.

-- ---------------------------------------------------------------- --
--  Yangi huquqlar                                                    --
-- ---------------------------------------------------------------- --

-- Mavjud lavozimlarga qo'shamiz. Huquqlar matn massivi bo'lgani uchun
-- takrorlanmasligiga o'zimiz qaraymiz.
UPDATE public.positions
   SET permissions = ARRAY(
     SELECT DISTINCT unnest(permissions || ARRAY['smm.read','smm.write','ai.use'])
   )
 WHERE code = 'smm_mobile';

UPDATE public.positions
   SET permissions = ARRAY(
     SELECT DISTINCT unnest(
       permissions || ARRAY['smm.read','smm.write','ai.use','social.publish','reports.read']
     )
   )
 WHERE code = 'smm_online';

UPDATE public.positions
   SET permissions = ARRAY(
     SELECT DISTINCT unnest(
       permissions || ARRAY['smm.read','ads.manage','ai.use','dashboard.view']
     )
   )
 WHERE code = 'targetolog';

-- Marketing rahbari va ijrochi direktor kuzatib turadi.
UPDATE public.positions
   SET permissions = ARRAY(
     SELECT DISTINCT unnest(permissions || ARRAY['smm.read','ads.manage'])
   )
 WHERE code IN ('rop', 'exec_director');

-- ---------------------------------------------------------------- --
--  Ulangan ijtimoiy tarmoqlar                                        --
-- ---------------------------------------------------------------- --

CREATE TABLE IF NOT EXISTS public.smm_accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform       text NOT NULL CHECK (platform IN
                   ('instagram','telegram','youtube','tiktok','facebook')),
  handle         text NOT NULL,
  display_name   text,
  followers      integer NOT NULL DEFAULT 0,
  connected      boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, handle)
);

-- ---------------------------------------------------------------- --
--  Kontent reja                                                      --
-- ---------------------------------------------------------------- --

CREATE TABLE IF NOT EXISTS public.content_plan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      text NOT NULL CHECK (platform IN
                  ('instagram','telegram','youtube','tiktok','facebook')),
  format        text NOT NULL DEFAULT 'post' CHECK (format IN
                  ('post','reel','story','video','carousel')),
  title         text NOT NULL,
  caption       text,
  scenario      text,
  hashtags      text,
  scheduled_at  timestamptz,
  -- Ish zanjiri: g'oya → ssenariy → suratga olish → montaj → tayyor → e'lon
  status        text NOT NULL DEFAULT 'idea' CHECK (status IN
                  ('idea','scripted','filming','editing','ready','scheduled',
                   'published','cancelled')),
  assignee      uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  product_id    uuid REFERENCES public.products(id) ON DELETE SET NULL,
  published_at  timestamptz,
  external_url  text,
  reach         integer NOT NULL DEFAULT 0,
  likes         integer NOT NULL DEFAULT 0,
  comments      integer NOT NULL DEFAULT 0,
  created_by    uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_plan_scheduled_idx
  ON public.content_plan (scheduled_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS content_plan_status_idx ON public.content_plan (status);

-- ---------------------------------------------------------------- --
--  Mobilograf yuklagan media                                         --
-- ---------------------------------------------------------------- --

CREATE TABLE IF NOT EXISTS public.content_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid REFERENCES public.content_plan(id) ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'image' CHECK (kind IN ('image','video')),
  path        text NOT NULL,          -- 'media' bucket ichidagi yo'l
  note        text,
  uploaded_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_assets_plan_idx ON public.content_assets (plan_id);

-- ---------------------------------------------------------------- --
--  AI so'rovlari tarixi                                              --
-- ---------------------------------------------------------------- --

-- Har bir AI natijasi saqlanadi: kim so'radi, nima chiqdi, qancha turdi.
-- Bu ham hisobot uchun, ham bir xil so'rovni ikki marta to'lamaslik uchun.
CREATE TABLE IF NOT EXISTS public.ai_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind IN
                 ('caption','scenario','analysis','image','hashtags','idea')),
  prompt       text NOT NULL,
  output       text,
  image_path   text,
  model        text,
  status       text NOT NULL DEFAULT 'done' CHECK (status IN ('done','failed')),
  error        text,
  plan_id      uuid REFERENCES public.content_plan(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_requests_created_idx ON public.ai_requests (created_at DESC);

-- ---------------------------------------------------------------- --
--  Targetolog: reklama kampaniyalari                                 --
-- ---------------------------------------------------------------- --

CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform    text NOT NULL CHECK (platform IN
                ('instagram','facebook','telegram','youtube','tiktok','google')),
  name        text NOT NULL,
  objective   text,
  budget      numeric(14,2) NOT NULL DEFAULT 0 CHECK (budget >= 0),
  spend       numeric(14,2) NOT NULL DEFAULT 0 CHECK (spend >= 0),
  impressions bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks      bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  leads       integer NOT NULL DEFAULT 0 CHECK (leads >= 0),
  started_on  date,
  ended_on    date,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN
                ('draft','active','paused','finished')),
  managed_by  uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- --
--  updated_at                                                        --
-- ---------------------------------------------------------------- --

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_plan_touch ON public.content_plan;
CREATE TRIGGER content_plan_touch BEFORE UPDATE ON public.content_plan
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS ad_campaigns_touch ON public.ad_campaigns;
CREATE TRIGGER ad_campaigns_touch BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------- --
--  Kirish huquqi                                                     --
-- ---------------------------------------------------------------- --

ALTER TABLE public.smm_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_plan   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns   ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.smm_accounts, public.content_plan, public.content_assets,
              public.ai_requests, public.ad_campaigns FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.smm_accounts, public.content_plan, public.content_assets,
     public.ai_requests, public.ad_campaigns
  TO authenticated;

DROP POLICY IF EXISTS smm_accounts_read ON public.smm_accounts;
CREATE POLICY smm_accounts_read ON public.smm_accounts
  FOR SELECT TO authenticated USING (public.has_permission('smm.read'));

DROP POLICY IF EXISTS smm_accounts_write ON public.smm_accounts;
CREATE POLICY smm_accounts_write ON public.smm_accounts
  FOR ALL TO authenticated
  USING (public.has_permission('social.publish'))
  WITH CHECK (public.has_permission('social.publish'));

DROP POLICY IF EXISTS content_plan_read ON public.content_plan;
CREATE POLICY content_plan_read ON public.content_plan
  FOR SELECT TO authenticated USING (public.has_permission('smm.read'));

DROP POLICY IF EXISTS content_plan_write ON public.content_plan;
CREATE POLICY content_plan_write ON public.content_plan
  FOR ALL TO authenticated
  USING (public.has_permission('smm.write'))
  WITH CHECK (public.has_permission('smm.write'));

DROP POLICY IF EXISTS content_assets_read ON public.content_assets;
CREATE POLICY content_assets_read ON public.content_assets
  FOR SELECT TO authenticated USING (public.has_permission('smm.read'));

DROP POLICY IF EXISTS content_assets_write ON public.content_assets;
CREATE POLICY content_assets_write ON public.content_assets
  FOR ALL TO authenticated
  USING (public.has_permission('media.upload'))
  WITH CHECK (public.has_permission('media.upload'));

-- AI tarixini bo'lim ko'radi, lekin faqat AI ishlata oladigan odam yozadi.
DROP POLICY IF EXISTS ai_requests_read ON public.ai_requests;
CREATE POLICY ai_requests_read ON public.ai_requests
  FOR SELECT TO authenticated USING (public.has_permission('smm.read'));

DROP POLICY IF EXISTS ai_requests_write ON public.ai_requests;
CREATE POLICY ai_requests_write ON public.ai_requests
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('ai.use'));

DROP POLICY IF EXISTS ad_campaigns_read ON public.ad_campaigns;
CREATE POLICY ad_campaigns_read ON public.ad_campaigns
  FOR SELECT TO authenticated USING (public.has_permission('smm.read'));

DROP POLICY IF EXISTS ad_campaigns_write ON public.ad_campaigns;
CREATE POLICY ad_campaigns_write ON public.ad_campaigns
  FOR ALL TO authenticated
  USING (public.has_permission('ads.manage'))
  WITH CHECK (public.has_permission('ads.manage'));

-- ---------------------------------------------------------------- --
--  Bo'lim hisoboti                                                   --
-- ---------------------------------------------------------------- --

CREATE OR REPLACE FUNCTION public.smm_overview(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from timestamptz := now() - make_interval(days => GREATEST(p_days, 1));
  v_result jsonb;
BEGIN
  IF NOT public.has_permission('smm.read') THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  SELECT jsonb_build_object(
    'published',  (SELECT count(*) FROM content_plan
                    WHERE status = 'published' AND published_at >= v_from),
    'scheduled',  (SELECT count(*) FROM content_plan
                    WHERE status IN ('ready','scheduled')),
    'in_work',    (SELECT count(*) FROM content_plan
                    WHERE status IN ('idea','scripted','filming','editing')),
    'reach',      (SELECT COALESCE(sum(reach), 0) FROM content_plan
                    WHERE published_at >= v_from),
    'ad_spend',   (SELECT COALESCE(sum(spend), 0) FROM ad_campaigns
                    WHERE status IN ('active','finished')),
    'ad_leads',   (SELECT COALESCE(sum(leads), 0) FROM ad_campaigns
                    WHERE status IN ('active','finished')),
    'ai_calls',   (SELECT count(*) FROM ai_requests WHERE created_at >= v_from),
    'followers',  (SELECT COALESCE(sum(followers), 0) FROM smm_accounts)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.smm_overview(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.smm_overview(integer) TO authenticated;
