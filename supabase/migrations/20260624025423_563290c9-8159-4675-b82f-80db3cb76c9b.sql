
CREATE OR REPLACE FUNCTION public.block_public_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing INT;
BEGIN
  SELECT count(*) INTO existing FROM auth.users;
  -- Allow the very first user (bootstrap admin) and any insert performed by service_role
  IF existing = 0 THEN
    RETURN NEW;
  END IF;
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Public signup is disabled. Contact an administrator.' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_block_public ON auth.users;
CREATE TRIGGER on_auth_user_block_public
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.block_public_signup();

REVOKE EXECUTE ON FUNCTION public.block_public_signup() FROM PUBLIC, anon, authenticated;
