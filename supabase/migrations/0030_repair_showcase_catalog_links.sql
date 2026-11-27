-- Allow complete but previously unlinked showcase rows to be linked by a no-op
-- save, and backfill those rows into the admin event catalog.

CREATE OR REPLACE FUNCTION public.sync_storefront_event_to_catalog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_category_id uuid;
  v_event_id uuid;
  v_rows_updated integer;
  v_operational_fields_present boolean;
BEGIN
  IF TG_OP = 'UPDATE'
    AND (
      NEW.normalized_event_id IS NOT NULL
      OR OLD.normalized_event_id IS NOT NULL
    )
    AND ROW(
      NEW.title, NEW.slug, NEW.category, NEW.about, NEW.image_url, NEW.venue,
      NEW.location, NEW.city, NEW.price_amount, NEW.currency, NEW.organizer_name,
      NEW.starts_at, NEW.ends_at, NEW.capacity
    ) IS NOT DISTINCT FROM ROW(
      OLD.title, OLD.slug, OLD.category, OLD.about, OLD.image_url, OLD.venue,
      OLD.location, OLD.city, OLD.price_amount, OLD.currency, OLD.organizer_name,
      OLD.starts_at, OLD.ends_at, OLD.capacity
    )
  THEN
    RETURN NEW;
  END IF;

  v_operational_fields_present :=
    NEW.starts_at IS NOT NULL
    OR NEW.ends_at IS NOT NULL
    OR NEW.capacity IS NOT NULL;

  IF NOT v_operational_fields_present AND NEW.normalized_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF nullif(btrim(coalesce(NEW.organizer_name, '')), '') IS NULL
    OR NEW.starts_at IS NULL
    OR NEW.ends_at IS NULL
    OR NEW.capacity IS NULL
    OR NEW.ends_at <= NEW.starts_at
    OR NEW.capacity <= 0
  THEN
    RAISE EXCEPTION
      'Enter an organizer name, valid event start/end times, and a positive ticket capacity.';
  END IF;

  SELECT id
  INTO v_category_id
  FROM public.event_categories
  WHERE lower(name) = lower(NEW.category)
  LIMIT 1;
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'No event catalog category matches showcase category "%".', NEW.category;
  END IF;

  IF NEW.normalized_event_id IS NULL THEN
    INSERT INTO public.events (
      organizer_name, category_id, created_by, title, slug, description,
      cover_image_url, venue_name, venue_address, venue_city, starts_at,
      ends_at, status, approval_status, capacity
    )
    VALUES (
      btrim(NEW.organizer_name), v_category_id, auth.uid(), NEW.title, NEW.slug,
      NEW.about, NEW.image_url, NEW.venue, NEW.location, NEW.city,
      NEW.starts_at, NEW.ends_at, 'draft', 'pending', NEW.capacity
    )
    RETURNING id INTO v_event_id;

    INSERT INTO public.ticket_types (
      event_id, name, price_amount, currency, quantity_total, max_per_order,
      sales_start_at, sales_end_at
    )
    VALUES (
      v_event_id, 'General Admission', NEW.price_amount, NEW.currency,
      NEW.capacity, least(8, NEW.capacity),
      least(now(), NEW.starts_at - interval '1 minute'), NEW.starts_at
    );

    NEW.normalized_event_id := v_event_id;
    RETURN NEW;
  END IF;

  UPDATE public.events
  SET organizer_name = btrim(NEW.organizer_name),
      category_id = v_category_id,
      title = NEW.title,
      slug = NEW.slug,
      description = NEW.about,
      cover_image_url = NEW.image_url,
      venue_name = NEW.venue,
      venue_address = NEW.location,
      venue_city = NEW.city,
      starts_at = NEW.starts_at,
      ends_at = NEW.ends_at,
      capacity = NEW.capacity
  WHERE id = NEW.normalized_event_id;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'The linked catalog event no longer exists.';
  END IF;

  UPDATE public.ticket_types
  SET price_amount = NEW.price_amount,
      currency = NEW.currency,
      quantity_total = NEW.capacity,
      max_per_order = least(8, NEW.capacity),
      sales_start_at = least(now(), NEW.starts_at - interval '1 minute'),
      sales_end_at = NEW.starts_at
  WHERE event_id = NEW.normalized_event_id
    AND name = 'General Admission';
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'The linked General Admission ticket type no longer exists.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_storefront_event_to_catalog ON public.storefront_events;
CREATE TRIGGER trg_sync_storefront_event_to_catalog
BEFORE INSERT OR UPDATE ON public.storefront_events
FOR EACH ROW EXECUTE FUNCTION public.sync_storefront_event_to_catalog();

UPDATE public.storefront_events showcase
SET title = showcase.title
WHERE showcase.normalized_event_id IS NULL
  AND nullif(btrim(coalesce(showcase.organizer_name, '')), '') IS NOT NULL
  AND showcase.starts_at IS NOT NULL
  AND showcase.ends_at > showcase.starts_at
  AND showcase.capacity > 0
  AND EXISTS (
    SELECT 1
    FROM public.event_categories category
    WHERE lower(category.name) = lower(showcase.category)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.events event
    WHERE event.slug = showcase.slug
  );
