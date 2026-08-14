-- One admin, and only one.
--
-- Until now any allow-listed email could claim the seat, and an existing admin
-- could promote a second one. The owner wants the studio to have exactly one
-- admin for its lifetime: once the seat is taken, nobody else can take it.
--
-- Recovery, if the studio account is ever lost: an owner with database access
-- can clear the seat with
--   DELETE FROM public.user_roles WHERE role = 'admin';
-- and then claim it again from the studio login.

CREATE OR REPLACE FUNCTION public.claim_admin() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  -- The seat is taken. Even the person sitting in it gets a plain "true"
  -- rather than a second grant.
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN public.has_role(v_uid, 'admin');
  END IF;

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

-- Granting the admin role to a second account is refused outright; staff stays
-- available for anyone who only needs to sign in.
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
    IF p_role = 'admin' THEN
      SELECT count(*) INTO v_admins FROM public.user_roles WHERE role = 'admin';
      -- Already an admin somewhere, and it isn't this account: refuse.
      IF v_admins >= 1 AND NOT public.has_role(v_target, 'admin') THEN
        RAISE EXCEPTION 'ADMIN_EXISTS';
      END IF;
    END IF;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_target, p_role)
    ON CONFLICT DO NOTHING;
  ELSE
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

-- A belt-and-braces guard: even a direct INSERT into user_roles can't create
-- a second admin if something ever bypasses the functions above.
CREATE OR REPLACE FUNCTION public.enforce_single_admin() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.role = 'admin'
     AND EXISTS (
       SELECT 1 FROM public.user_roles
        WHERE role = 'admin' AND user_id <> NEW.user_id
     ) THEN
    RAISE EXCEPTION 'ADMIN_EXISTS: the studio already has its admin';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS user_roles_single_admin ON public.user_roles;
CREATE TRIGGER user_roles_single_admin
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_admin();
