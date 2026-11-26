-- Phase 1 / 0016: explicit table and function privileges.
--
-- RLS decides which rows a caller may see or change. Table-level GRANTs are a
-- separate PostgreSQL check. Migrations applied through the Supabase SQL
-- Editor do not always inherit the project's default privileges, which causes
-- "permission denied for table profiles" even when the RLS policy is correct.
-- This migration makes those grants explicit and is safe to re-run.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- The service role bypasses RLS but still needs ordinary table privileges.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Signed-in and anonymous clients may attempt reads; RLS filters the rows.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Writes that authenticated users and admins actually perform. Each of these
-- tables still has RLS policies, moderation triggers and immutability guards,
-- so these grants do not bypass business rules.

GRANT UPDATE ON public.profiles TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.organizers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.organizer_staff TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.event_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_lineup_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_staff TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.ticket_types TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ticket_inventory TO authenticated;

GRANT INSERT, UPDATE ON public.orders TO authenticated;
GRANT INSERT ON public.order_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ticket_inventory_reservations TO authenticated;
GRANT UPDATE ON public.tickets TO authenticated;
GRANT INSERT ON public.ticket_checkins TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT UPDATE ON public.platform_settings TO authenticated;

-- Admin-only showcase records: RLS restricts all of this to public.is_admin().
GRANT INSERT, UPDATE, DELETE ON public.storefront_events TO authenticated;

-- Payout status is admin-editable, but amount/currency remain immutable via
-- the trigger in 0014.
GRANT UPDATE ON public.organizer_payouts TO authenticated;

-- Payments, refunds, webhook events, commissions, audit logs, role assignments
-- and invitations are intentionally read-only to clients. Writes happen through
-- SECURITY DEFINER functions or server-side webhooks.

-- RPCs and RLS helper functions must be callable by the client roles. Internal
-- checks inside each SECURITY DEFINER function still enforce authorization.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
