-- Provide administrators a catalog read path that does not silently omit rows
-- due to stale or incomplete event SELECT policies.

CREATE OR REPLACE FUNCTION public.admin_list_events()
RETURNS SETOF public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can list catalog events'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT catalog_event.*
  FROM public.events catalog_event
  ORDER BY catalog_event.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_events() TO authenticated;
