-- Intentionally empty: Phase 1 does not create fake or production business data.
-- Reference rows for roles and event categories are inserted by migrations 0002 and 0003.

-- Bootstrap the first administrator manually after auth.users exists. Replace the UUID:
-- INSERT INTO public.user_roles (user_id, role_id, assigned_by)
-- SELECT '00000000-0000-0000-0000-000000000000', id, NULL
-- FROM public.roles WHERE name = 'admin';
