
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_user_recurring(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_user_recurring(uuid) TO authenticated;
