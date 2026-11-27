-- Phase 3 / 0019: remove the bundled showcase samples and their demo bookings.
-- These were placeholder listings from migration 0015, not customer-created data.

DELETE FROM public.storefront_bookings
WHERE event_slug IN (
  'neon-monsoon',
  'manikganj-marathon',
  'boishakh-bazaar',
  'glass-menagerie',
  'build-night',
  'creative-table',
  'rooftop-frequencies',
  'liberty-aces',
  'afterglow-festival',
  'midsummer-night',
  'future-form',
  'clay-after-hours',
  'good-city-summit',
  'sunday-plates'
);

DELETE FROM public.storefront_events
WHERE slug IN (
  'neon-monsoon',
  'manikganj-marathon',
  'boishakh-bazaar',
  'glass-menagerie',
  'build-night',
  'creative-table',
  'rooftop-frequencies',
  'liberty-aces',
  'afterglow-festival',
  'midsummer-night',
  'future-form',
  'clay-after-hours',
  'good-city-summit',
  'sunday-plates'
);
