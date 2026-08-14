-- Studio access lockdown.
--
-- Before this migration anyone could sign up and press "Claim admin access" —
-- whoever got there first owned the shop. Now:
--   * only an allow-listed email can create an account at all
--   * only an allow-listed email can claim the admin seat
--   * existing admins grant/revoke roles from Admin -> Team
--   * the last admin cannot be removed, so nobody can lock the owner out
--
-- NOTE: the sign-up block covers every account, because this storefront uses
-- guest checkout and has no customer logins. If you later add customer
-- accounts, drop the trigger `auth_signup_allowlist_only` on auth.users.

-- ---------------------------------------------------------------------------
-- 1. Who is allowed in
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_allowlist FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_allowlist TO authenticated;
GRANT ALL ON public.admin_allowlist TO service_role;

DROP POLICY IF EXISTS "allowlist admin only" ON public.admin_allowlist;
CREATE POLICY "allowlist admin only" ON public.admin_allowlist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed the store owner. Change this address (or add rows) before anyone signs up.
INSERT INTO public.admin_allowlist (email, note)
VALUES ('rustamasaka1991@gmail.com', 'Store owner')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.email_is_allowed(p_email text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_allowlist WHERE lower(email) = lower(btrim(p_email))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.email_is_allowed(text) FROM public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Close sign-up to everyone else
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_unlisted_signup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.email_is_allowed(NEW.email) THEN
    RAISE EXCEPTION 'SIGNUP_CLOSED: this email is not on the studio allow list';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS auth_signup_allowlist_only ON auth.users;
CREATE TRIGGER auth_signup_allowlist_only
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.block_unlisted_signup();

-- ---------------------------------------------------------------------------
-- 3. Profiles follow accounts, so the Team page has names to show
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "profiles admin read" ON public.profiles;
CREATE POLICY "profiles admin read" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 4. Claiming the seat now requires being on the list
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_admin() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL OR NOT public.email_is_allowed(v_email) THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public.claim_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Admins manage the team
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_team()
RETURNS TABLE (id uuid, email text, joined_at timestamptz, roles text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  RETURN QUERY
    SELECT u.id,
           u.email::text,
           u.created_at,
           coalesce(array_agg(r.role::text) FILTER (WHERE r.role IS NOT NULL), '{}'::text[])
      FROM auth.users u
      LEFT JOIN public.user_roles r ON r.user_id = u.id
     GROUP BY u.id, u.email, u.created_at
     ORDER BY u.created_at;
END; $$;
REVOKE EXECUTE ON FUNCTION public.list_team() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_team() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_role(
  p_email text,
  p_role public.app_role,
  p_enabled boolean
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target uuid;
  v_admins int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  SELECT u.id INTO v_target FROM auth.users u WHERE lower(u.email) = lower(btrim(p_email));
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'NO_SUCH_USER';
  END IF;

  IF p_enabled THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_target, p_role)
    ON CONFLICT DO NOTHING;
  ELSE
    -- Refuse to remove the final admin; that would lock everyone out of the studio.
    IF p_role = 'admin' THEN
      SELECT count(*) INTO v_admins FROM public.user_roles WHERE role = 'admin';
      IF v_admins <= 1 THEN
        RAISE EXCEPTION 'LAST_ADMIN';
      END IF;
    END IF;
    DELETE FROM public.user_roles WHERE user_id = v_target AND role = p_role;
  END IF;

  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_user_role(text, public.app_role, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(text, public.app_role, boolean) TO authenticated;
