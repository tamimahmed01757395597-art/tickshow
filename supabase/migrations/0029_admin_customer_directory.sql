-- Keep the admin customer directory complete even if an Auth profile trigger
-- was absent or failed for an account.

CREATE OR REPLACE FUNCTION public.admin_list_customers()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  status public.account_status,
  roles text[],
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can list customers'
      USING ERRCODE = '42501';
  END IF;

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
  ON CONFLICT ON CONSTRAINT profiles_pkey DO NOTHING;

  RETURN QUERY
  SELECT
    profile.id,
    coalesce(
      profile.full_name,
      nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(auth_user.email, '@', 1), '')
    ),
    coalesce(nullif(profile.email, ''), auth_user.email),
    profile.phone,
    profile.status,
    coalesce(
      array_agg(DISTINCT role.name::text ORDER BY role.name::text)
        FILTER (WHERE role.name IS NOT NULL),
      ARRAY[]::text[]
    ),
    profile.created_at
  FROM public.profiles profile
  JOIN auth.users auth_user ON auth_user.id = profile.id
  LEFT JOIN public.user_roles assignment ON assignment.user_id = profile.id
  LEFT JOIN public.roles role ON role.id = assignment.role_id
  GROUP BY profile.id, auth_user.email, auth_user.raw_user_meta_data
  ORDER BY profile.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_customers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_customers() TO authenticated;
