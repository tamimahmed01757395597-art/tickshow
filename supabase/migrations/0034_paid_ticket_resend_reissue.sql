CREATE OR REPLACE FUNCTION public.claim_order_ticket_assets_for_resend(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.is_admin() OR public.owns_order(p_order_id)
  ) THEN
    RAISE EXCEPTION 'You are not allowed to reissue tickets for this order.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND OR NOT public.is_verified_paid_order(p_order_id) THEN
    RAISE EXCEPTION 'Tickets are reissued only after verified payment.'
      USING ERRCODE = '42501';
  END IF;
  IF v_order.ticket_assets_status = 'generating'
     AND v_order.updated_at > now() - interval '10 minutes' THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.ticket_delivery_update', p_order_id::text, true);
  UPDATE public.orders
  SET ticket_assets_status = 'generating'
  WHERE id = p_order_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_ticket_assets_for_resend(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_order_ticket_assets_for_resend(uuid)
  TO authenticated, service_role;
