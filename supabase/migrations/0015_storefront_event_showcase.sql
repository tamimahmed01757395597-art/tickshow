-- Phase 2 / 0015: admin-managed storefront event showcase.
--
-- The normalized `events` table remains the source of truth for inventory,
-- orders and finance. This table owns only the presentation data used by the
-- storefront: upcoming/ongoing/past grouping, carousel selection and the
-- display fields shown on event cards and detail pages.

-- Helpers from 0010 are repeated here with CREATE OR REPLACE so this
-- migration can also be applied on its own without failing with
-- "function public.set_updated_at() does not exist" or
-- "function public.is_admin() does not exist".

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_service_role() OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  );
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'storefront_event_group' AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.storefront_event_group AS ENUM ('past', 'upcoming', 'ongoing');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.storefront_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL,
  event_group public.storefront_event_group NOT NULL DEFAULT 'upcoming',
  display_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  status_label text NOT NULL DEFAULT 'On sale now',
  date_label text NOT NULL,
  date_value date NOT NULL,
  time_label text,
  venue text,
  location text,
  city text,
  price_amount numeric(14, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BDT',
  image_url text,
  image_alt text,
  about text,
  lineup jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_carousel boolean NOT NULL DEFAULT false,
  carousel_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storefront_events_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT storefront_events_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT storefront_events_category_not_blank CHECK (length(btrim(category)) > 0),
  CONSTRAINT storefront_events_status_not_blank CHECK (length(btrim(status_label)) > 0),
  CONSTRAINT storefront_events_date_not_blank CHECK (length(btrim(date_label)) > 0),
  CONSTRAINT storefront_events_price_nonnegative CHECK (price_amount >= 0),
  CONSTRAINT storefront_events_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT storefront_events_lineup_array CHECK (jsonb_typeof(lineup) = 'array'),
  CONSTRAINT storefront_events_display_order_nonnegative CHECK (display_order >= 0),
  CONSTRAINT storefront_events_carousel_order_nonnegative CHECK (carousel_order >= 0)
);

COMMENT ON TABLE public.storefront_events IS 'Admin-managed presentation records for the storefront. Not used for inventory, orders or payments.';
COMMENT ON COLUMN public.storefront_events.event_group IS 'Where the event appears on the storefront: upcoming, ongoing or past archive.';
COMMENT ON COLUMN public.storefront_events.is_carousel IS 'Include this event in the storefront coverflow carousel.';

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.storefront_events;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.storefront_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS storefront_events_group_order_idx
  ON public.storefront_events (event_group, display_order)
  WHERE is_visible;

CREATE INDEX IF NOT EXISTS storefront_events_carousel_idx
  ON public.storefront_events (carousel_order)
  WHERE is_visible AND is_carousel;

ALTER TABLE public.storefront_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storefront_events_public_select ON public.storefront_events;
CREATE POLICY storefront_events_public_select ON public.storefront_events
FOR SELECT TO anon, authenticated
USING (is_visible);

DROP POLICY IF EXISTS storefront_events_admin_all ON public.storefront_events;
CREATE POLICY storefront_events_admin_all ON public.storefront_events
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Seed the current storefront showcase exactly once. Administrator edits are
-- preserved across migrations because rows are matched by slug.
INSERT INTO public.storefront_events (
  slug, title, category, event_group, display_order, is_visible, status_label,
  date_label, date_value, time_label, venue, location, city,
  price_amount, currency, image_url, image_alt, about, lineup,
  is_carousel, carousel_order
)
VALUES
  (
    'neon-monsoon', 'Neon Monsoon', 'Concerts & Music', 'past', 1, true, 'Sold out',
    'Saturday, June 13, 2026', '2026-06-13', 'Doors at 7:00 PM',
    'Manikganj Town Hall', 'Manikganj, Dhaka', 'Manikganj', 1000, 'BDT',
    'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'Concertgoers raising their hands toward a brightly lit stage',
    'A rain-soaked night at Manikganj Town Hall with three live acts and a closing DJ set that ran well past midnight.',
    '[{"name":"Aurora Lane","role":"Headliner"},{"name":"The Nightshift","role":"Support"},{"name":"DJ Rumi","role":"Closing set"}]'::jsonb,
    true, 1
  ),
  (
    'manikganj-marathon', 'Manikganj Marathon 2026', 'Sports', 'past', 2, true, 'Sold out',
    'Sunday, May 24, 2026', '2026-05-24', 'Start at 6:00 AM',
    'Shibaloy Sports Ground', 'Manikganj, Dhaka', 'Manikganj', 400, 'BDT',
    'https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'Runners smiling as they make their way through a city marathon',
    'A city-wide race morning that started at Shibaloy Sports Ground and finished along the Manikganj riverside.',
    '[{"name":"Open 10K","role":"Race category"},{"name":"Half marathon","role":"Race category"},{"name":"Kids dash","role":"Race category"}]'::jsonb,
    true, 2
  ),
  (
    'boishakh-bazaar', 'Pohela Boishakh Bazaar', 'Festivals', 'past', 3, true, 'Sold out',
    'Tuesday, April 14, 2026', '2026-04-14', 'Gates open at 10:00 AM',
    'Manikganj Riverside Grounds', 'Manikganj, Dhaka', 'Manikganj', 250, 'BDT',
    'https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'A festival stage lit by pyrotechnics above a packed crowd',
    'Pohela Boishakh celebrated with folk performers, food stalls and a full day of programming by the river.',
    '[{"name":"Baul Collective","role":"Folk ensemble"},{"name":"Shonar Bangla Dhol","role":"Percussion"},{"name":"Rongin Nach","role":"Dance troupe"},{"name":"Street Food Row","role":"Vendors"}]'::jsonb,
    true, 3
  ),
  (
    'glass-menagerie', 'The Glass Menagerie', 'Theatre', 'past', 4, true, 'Past event',
    'Friday, March 20, 2026', '2026-03-20', 'Curtain at 7:30 PM',
    'District Cultural Hall', 'Manikganj, Dhaka', 'Manikganj', 450, 'BDT',
    'https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'A theatre audience seated in rows under blue stage lighting',
    'Tennessee Williams'' memory play, staged in the round at District Cultural Hall for two sold-out nights.',
    '[{"name":"Nusrat Jahan","role":"Amanda Wingfield"},{"name":"Arif Hossain","role":"Tom Wingfield"},{"name":"Mila Rahman","role":"Laura Wingfield"},{"name":"Tanvir Alam","role":"Jim O''Connor"}]'::jsonb,
    true, 4
  ),
  (
    'build-night', 'Build Night Dhaka', 'Technology', 'past', 5, true, 'Past event',
    'Saturday, February 21, 2026', '2026-02-21', 'Doors at 6:00 PM',
    'Manikganj Tech Hub', 'Manikganj, Dhaka', 'Manikganj', 700, 'BDT',
    'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'Team members stacking hands over plans and a laptop',
    'An evening of short demos and open build tables for Manikganj''s makers, designers and developers.',
    '[{"name":"Sadia Karim","role":"Host"},{"name":"Rakib Hasan","role":"Demo: local-first apps"},{"name":"Farah Nower","role":"Demo: hardware for farms"}]'::jsonb,
    true, 5
  ),
  (
    'creative-table', 'Creative Table Meetup', 'Workshops', 'past', 6, true, 'Past event',
    'Saturday, January 17, 2026', '2026-01-17', 'Meetup began at 6:00 PM',
    'Manikganj Art Studio', 'Manikganj, Dhaka', 'Manikganj', 850, 'BDT',
    'https://images.pexels.com/photos/1267697/pexels-photo-1267697.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'A small group chatting around a cafe table',
    'A relaxed meetup for designers, writers and makers to share what they were working on over coffee.',
    '[{"name":"Imran Chowdhury","role":"Host"},{"name":"Priya Sen","role":"Guest: zine making"},{"name":"Open table","role":"Show and tell"}]'::jsonb,
    true, 6
  ),
  (
    'rooftop-frequencies', 'Rooftop Frequencies', 'Concerts & Music', 'upcoming', 1, true, 'Selling fast',
    'Saturday, July 25, 2026', '2026-07-25', 'Doors at 7:00 PM',
    'Manikganj Town Hall', 'Manikganj, Dhaka', 'Manikganj', 1200, 'BDT',
    'https://images.pexels.com/photos/14870726/pexels-photo-14870726.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'A huge festival crowd facing a live stage at night',
    'Three acts, one rooftop and the Manikganj skyline behind the stage. Doors open an hour before the first set.',
    '[{"name":"Aurora Lane","role":"Headliner"},{"name":"Meghdol Road","role":"Support"},{"name":"DJ Rumi","role":"Closing set"}]'::jsonb,
    false, 0
  ),
  (
    'liberty-aces', 'Manikganj XI vs. Dhaka United', 'Sports', 'upcoming', 2, true, 'Tickets moving',
    'Friday, August 7, 2026', '2026-08-07', 'Tip-off at 7:00 PM',
    'Shibaloy Sports Ground', 'Manikganj, Dhaka', 'Manikganj', 600, 'BDT',
    'https://images.pexels.com/photos/31169234/pexels-photo-31169234.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'A basketball player rising for a dunk under arena lights',
    'A cross-city exhibition game under the lights at Shibaloy Sports Ground, with courtside seating on all four sides.',
    '[{"name":"Manikganj XI","role":"Home side"},{"name":"Dhaka United","role":"Away side"},{"name":"Courtside Crew","role":"Halftime show"}]'::jsonb,
    false, 0
  ),
  (
    'afterglow-festival', 'Afterglow City Festival', 'Festivals', 'upcoming', 3, true, 'Early bird',
    'August 14-16, 2026', '2026-08-14', 'Gates open at 2:00 PM',
    'Manikganj Riverside Grounds', 'Manikganj, Dhaka', 'Manikganj', 800, 'BDT',
    'https://images.pexels.com/photos/40755879/pexels-photo-40755879.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'A busy night street festival glowing with food and market stalls',
    'Three days of music, food and late-night markets on the Manikganj riverside, with a different headliner each night.',
    '[{"name":"Neon Monsoon","role":"Friday headliner"},{"name":"The Nightshift","role":"Saturday headliner"},{"name":"Riverside Collective","role":"Sunday headliner"},{"name":"Night Market Row","role":"Food and stalls"}]'::jsonb,
    false, 0
  ),
  (
    'midsummer-night', 'A Midsummer Night''s Dream', 'Theatre', 'upcoming', 4, true, 'On sale now',
    'Thursday, August 20, 2026', '2026-08-20', 'Curtain at 7:30 PM',
    'District Cultural Hall', 'Manikganj, Dhaka', 'Manikganj', 500, 'BDT',
    'https://images.pexels.com/photos/8820330/pexels-photo-8820330.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'A dancer performing under a focused stage spotlight',
    'Shakespeare''s forest comedy played under open sky, with a live string score and a cast of twelve.',
    '[{"name":"Mila Rahman","role":"Puck"},{"name":"Arif Hossain","role":"Oberon"},{"name":"Nusrat Jahan","role":"Titania"},{"name":"Tanvir Alam","role":"Bottom"},{"name":"Dhaka String Quartet","role":"Live score"}]'::jsonb,
    false, 0
  ),
  (
    'future-form', 'Future / Form 2026', 'Technology', 'upcoming', 5, true, 'Limited tickets',
    'Saturday, September 5, 2026', '2026-09-05', 'Doors at 10:00 AM',
    'Manikganj Tech Hub', 'Manikganj, Dhaka', 'Manikganj', 1500, 'BDT',
    'https://images.pexels.com/photos/9275222/pexels-photo-9275222.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'An audience watching a speaker at a large indoor conference',
    'A one-day conference on products, AI and the tools being built across Bangladesh, with demos between talks.',
    '[{"name":"Sadia Karim","role":"Opening keynote"},{"name":"Rakib Hasan","role":"Building local-first software"},{"name":"Farah Nower","role":"Hardware, farms and data"},{"name":"Closing panel","role":"The next five years"}]'::jsonb,
    false, 0
  ),
  (
    'clay-after-hours', 'Clay After Hours', 'Workshops', 'upcoming', 6, true, 'A few places left',
    'Saturday, September 12, 2026', '2026-09-12', 'Workshop begins at 6:00 PM',
    'Manikganj Art Studio', 'Manikganj, Dhaka', 'Manikganj', 900, 'BDT',
    'https://images.pexels.com/photos/6023597/pexels-photo-6023597.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'People shaping pottery together in a hands-on workshop',
    'A hands-on evening of wheel throwing and hand-building. Clay, tools and firing are all included in the ticket.',
    '[{"name":"Priya Sen","role":"Studio lead"},{"name":"Imran Chowdhury","role":"Hand-building table"}]'::jsonb,
    false, 0
  ),
  (
    'good-city-summit', 'Good City Summit', 'Business Events', 'upcoming', 7, true, 'On sale now',
    'Thursday, September 17, 2026', '2026-09-17', 'Doors at 9:00 AM',
    'Manikganj Convention Center', 'Manikganj, Dhaka', 'Manikganj', 2000, 'BDT',
    'https://images.pexels.com/photos/15448073/pexels-photo-15448073.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'A packed conference hall listening to a live presentation',
    'Founders, planners and civic teams on what makes a city work, from transport to public space.',
    '[{"name":"Farah Nower","role":"Keynote"},{"name":"Sadia Karim","role":"Panel: transport"},{"name":"Rakib Hasan","role":"Workshop: civic data"}]'::jsonb,
    false, 0
  ),
  (
    'sunday-plates', 'Sunday Plates: Night Market', 'Other Experiences', 'upcoming', 8, true, 'On sale now',
    'Sunday, October 4, 2026', '2026-10-04', 'Market opens at 2:00 PM',
    'Manikganj Night Market', 'Manikganj, Dhaka', 'Manikganj', 300, 'BDT',
    'https://images.pexels.com/photos/41156914/pexels-photo-41156914.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    'An overhead view of a lively market with food stalls and visitors',
    'An evening market of home cooks, grill stalls and sweet shops, spread through the lanes of Manikganj Night Market.',
    '[{"name":"Home Cooks Row","role":"Stalls"},{"name":"Charcoal & Co.","role":"Grill"},{"name":"Mishti Corner","role":"Sweets"}]'::jsonb,
    false, 0
  )
ON CONFLICT (slug) DO NOTHING;
