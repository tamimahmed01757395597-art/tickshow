-- Backfill profiles for Auth users created before the profile trigger was installed.
-- Existing profile data is left unchanged.

INSERT INTO public.profiles (id, email, full_name, created_at)
SELECT
  users.id,
  users.email,
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(users.email, '@', 1), '')
  ),
  coalesce(users.created_at, now())
FROM auth.users users
LEFT JOIN public.profiles profiles ON profiles.id = users.id
WHERE profiles.id IS NULL
ON CONFLICT (id) DO NOTHING;
