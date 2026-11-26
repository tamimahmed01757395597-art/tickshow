-- Phase 1 / 0009: query and foreign-key indexes.
-- All indexes are CREATE IF NOT EXISTS; no data is modified.

-- Identity / permissions
CREATE INDEX IF NOT EXISTS profiles_email_lower_idx ON public.profiles (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_roles_user_idx ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_idx ON public.user_roles (role_id);
CREATE INDEX IF NOT EXISTS organizer_staff_user_idx ON public.organizer_staff (user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS organizer_staff_organizer_idx ON public.organizer_staff (organizer_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS organizers_owner_idx ON public.organizers (owner_id);
CREATE INDEX IF NOT EXISTS organizers_public_idx ON public.organizers (status, approval_status) WHERE status = 'active' AND approval_status = 'approved';

-- Events
CREATE INDEX IF NOT EXISTS events_organizer_idx ON public.events (organizer_id);
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events (category_id);
CREATE INDEX IF NOT EXISTS events_public_idx ON public.events (starts_at, id)
  WHERE status = 'published' AND approval_status = 'approved' AND cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS events_status_idx ON public.events (status, approval_status, starts_at);
CREATE INDEX IF NOT EXISTS event_lineup_items_event_idx ON public.event_lineup_items (event_id, sort_order);
CREATE INDEX IF NOT EXISTS event_staff_user_idx ON public.event_staff (user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS event_staff_event_idx ON public.event_staff (event_id) WHERE status = 'active';

-- Tickets / inventory
CREATE INDEX IF NOT EXISTS ticket_types_event_idx ON public.ticket_types (event_id, status);
CREATE INDEX IF NOT EXISTS ticket_types_sales_window_idx ON public.ticket_types (sales_start_at, sales_end_at) WHERE is_active;
CREATE INDEX IF NOT EXISTS ticket_inventory_ticket_type_idx ON public.ticket_inventory (ticket_type_id);
CREATE INDEX IF NOT EXISTS ticket_reservations_status_expiry_idx
  ON public.ticket_inventory_reservations (status, expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ticket_reservations_order_idx ON public.ticket_inventory_reservations (order_id);

-- Orders / payments
CREATE INDEX IF NOT EXISTS orders_customer_idx ON public.orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_event_idx ON public.orders (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_buyer_email_idx ON public.orders (lower(buyer_email));
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_ticket_type_idx ON public.order_items (ticket_type_id);
CREATE INDEX IF NOT EXISTS payments_order_idx ON public.payments (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status, verified_at);
CREATE INDEX IF NOT EXISTS payment_webhook_events_processed_idx
  ON public.payment_webhook_events (processed_at) WHERE processed_at IS NULL;

-- Issued tickets / verification
CREATE INDEX IF NOT EXISTS tickets_order_idx ON public.tickets (order_id);
CREATE INDEX IF NOT EXISTS tickets_order_item_idx ON public.tickets (order_item_id);
CREATE INDEX IF NOT EXISTS tickets_customer_idx ON public.tickets (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tickets_event_idx ON public.tickets (event_id, status);
CREATE INDEX IF NOT EXISTS tickets_ticket_type_idx ON public.tickets (ticket_type_id);
CREATE INDEX IF NOT EXISTS ticket_checkins_ticket_idx ON public.ticket_checkins (ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_checkins_event_idx ON public.ticket_checkins (event_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ticket_checkins_one_success_idx
  ON public.ticket_checkins (ticket_id) WHERE result = 'success';

-- Finance
CREATE INDEX IF NOT EXISTS refunds_payment_idx ON public.refunds (payment_id);
CREATE INDEX IF NOT EXISTS refunds_order_idx ON public.refunds (order_id);
CREATE INDEX IF NOT EXISTS refunds_status_idx ON public.refunds (status, processed_at);
CREATE INDEX IF NOT EXISTS organizer_commissions_organizer_idx ON public.organizer_commissions (organizer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS organizer_commissions_event_idx ON public.organizer_commissions (event_id);
CREATE INDEX IF NOT EXISTS organizer_commissions_order_idx ON public.organizer_commissions (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS organizer_commissions_payout_idx ON public.organizer_commissions (payout_id) WHERE payout_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS organizer_commissions_one_per_order_idx
  ON public.organizer_commissions (organizer_id, order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS organizer_payouts_organizer_idx ON public.organizer_payouts (organizer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS organizer_payouts_status_idx ON public.organizer_payouts (status, requested_at);

-- Engagement / audit
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS reviews_event_status_idx ON public.reviews (event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_customer_idx ON public.reviews (customer_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);
