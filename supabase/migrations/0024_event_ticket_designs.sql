-- Store an event-specific ticket style and optional artwork, and snapshot both
-- onto bookings so later event edits do not change already-issued tickets.

ALTER TABLE public.storefront_events
  ADD COLUMN IF NOT EXISTS ticket_design_style text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS ticket_design_image_path text;

ALTER TABLE public.storefront_bookings
  ADD COLUMN IF NOT EXISTS ticket_design_style text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS ticket_design_image_path text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'storefront_events_ticket_design_style_check'
      AND conrelid = 'public.storefront_events'::regclass
  ) THEN
    ALTER TABLE public.storefront_events
      ADD CONSTRAINT storefront_events_ticket_design_style_check
      CHECK (ticket_design_style IN ('classic', 'midnight', 'festival', 'neon'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'storefront_bookings_ticket_design_style_check'
      AND conrelid = 'public.storefront_bookings'::regclass
  ) THEN
    ALTER TABLE public.storefront_bookings
      ADD CONSTRAINT storefront_bookings_ticket_design_style_check
      CHECK (ticket_design_style IN ('classic', 'midnight', 'festival', 'neon'));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.snapshot_storefront_ticket_design()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.storefront_event_id IS NOT NULL THEN
    SELECT ticket_design_style, ticket_design_image_path
    INTO NEW.ticket_design_style, NEW.ticket_design_image_path
    FROM public.storefront_events
    WHERE id = NEW.storefront_event_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_storefront_ticket_design
  ON public.storefront_bookings;
CREATE TRIGGER trg_snapshot_storefront_ticket_design
BEFORE INSERT ON public.storefront_bookings
FOR EACH ROW EXECUTE FUNCTION public.snapshot_storefront_ticket_design();
