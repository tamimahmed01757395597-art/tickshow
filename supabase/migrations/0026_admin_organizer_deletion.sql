-- Allow administrators to permanently remove an organizer only when no
-- operational, showcase, staff, or financial records depend on it.

CREATE OR REPLACE FUNCTION public.delete_organizer(p_organizer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can delete organizers';
  END IF;

  PERFORM 1
  FROM public.organizers
  WHERE id = p_organizer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organizer not found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.events WHERE organizer_id = p_organizer_id)
     OR EXISTS (SELECT 1 FROM public.storefront_events WHERE organizer_id = p_organizer_id)
     OR EXISTS (SELECT 1 FROM public.organizer_staff WHERE organizer_id = p_organizer_id)
     OR EXISTS (SELECT 1 FROM public.organizer_payouts WHERE organizer_id = p_organizer_id)
     OR EXISTS (SELECT 1 FROM public.organizer_commissions WHERE organizer_id = p_organizer_id) THEN
    RAISE EXCEPTION
      'Cannot delete an organizer with linked events, showcase entries, staff assignments, payouts, or commissions';
  END IF;

  DELETE FROM public.organizers WHERE id = p_organizer_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_organizer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_organizer(uuid) TO authenticated;
