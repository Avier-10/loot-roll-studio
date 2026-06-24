
-- ========== Phase 1: Security hardening ==========

-- 1) Account status
CREATE TYPE public.account_status AS ENUM ('pendiente','activo','suspendido','deshabilitado');

ALTER TABLE public.profiles
  ADD COLUMN account_status public.account_status NOT NULL DEFAULT 'activo',
  ADD COLUMN active_spin_id UUID,
  ADD COLUMN pending_spin_id UUID,
  ADD COLUMN active_spin_started_at TIMESTAMPTZ;

-- spins: track view state for pending-result persistence
ALTER TABLE public.spins
  ADD COLUMN viewed_at TIMESTAMPTZ;

-- 2) handle_new_user: default active, first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, username, display_name, account_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    'activo'
  );
  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'streamer');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'streamer');
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Prevent non-admin from changing privileged fields on their own profile
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change account_status';
  END IF;
  IF NEW.username IS DISTINCT FROM OLD.username
     AND NOT public.has_role(auth.uid(), 'admin')
     AND auth.uid() <> OLD.id THEN
    RAISE EXCEPTION 'Cannot change username of another user';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_profiles_guard BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- 4) Helper: account status check (security definer)
CREATE OR REPLACE FUNCTION public.get_account_status(_uid UUID)
RETURNS public.account_status LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT account_status FROM public.profiles WHERE id = _uid
$$;

CREATE OR REPLACE FUNCTION public.is_account_active(_uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND account_status = 'activo')
$$;

-- 5) Atomic spin lock acquire / release
CREATE OR REPLACE FUNCTION public.acquire_spin_lock(_uid UUID, _spin_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated INT;
BEGIN
  UPDATE public.profiles
    SET active_spin_id = _spin_id,
        active_spin_started_at = now()
  WHERE id = _uid
    AND (active_spin_id IS NULL OR active_spin_started_at < now() - interval '30 seconds');
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_spin_lock(_uid UUID, _pending_spin_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles
    SET active_spin_id = NULL,
        active_spin_started_at = NULL,
        pending_spin_id = _pending_spin_id
  WHERE id = _uid
$$;

CREATE OR REPLACE FUNCTION public.clear_pending_spin(_uid UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid UUID;
BEGIN
  SELECT pending_spin_id INTO pid FROM public.profiles WHERE id = _uid;
  IF pid IS NOT NULL THEN
    UPDATE public.spins SET viewed_at = now() WHERE id = pid AND viewed_at IS NULL;
    UPDATE public.profiles SET pending_spin_id = NULL WHERE id = _uid;
  END IF;
END;
$$;

-- 6) Stricter user_roles SELECT (admins see all, users see own)
-- already present; no change

-- 7) Reset existing accounts to 'activo' so current users keep working
UPDATE public.profiles SET account_status = 'activo' WHERE account_status IS NULL;
