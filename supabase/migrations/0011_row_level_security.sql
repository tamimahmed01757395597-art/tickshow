-- Phase 1 / 0011: row level security.
-- Default deny: only the policies below grant access. Service role bypasses RLS by design
-- and must remain server-side only.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_lineup_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- profiles: private by default; users may edit their own non-status fields.
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- roles: reference data readable by signed-in users, writable only by service role.
DROP POLICY IF EXISTS roles_select ON public.roles;
CREATE POLICY roles_select ON public.roles FOR SELECT TO authenticated USING (true);

-- user_roles: readable by the user/admin, writable only through security-definer functions.
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- organizers: public directory only for active approved organizers.
DROP POLICY IF EXISTS organizers_public_select ON public.organizers;
CREATE POLICY organizers_public_select ON public.organizers
  FOR SELECT TO public USING (status = 'active' AND approval_status = 'approved');
DROP POLICY IF EXISTS organizers_member_select ON public.organizers;
CREATE POLICY organizers_member_select ON public.organizers
  FOR SELECT TO authenticated USING (
    public.is_admin()
    OR public.owns_organizer(id)
    OR EXISTS (
      SELECT 1 FROM public.organizer_staff os
      WHERE os.organizer_id = organizers.id
        AND os.user_id = auth.uid()
        AND os.status = 'active'
    )
  );
DROP POLICY IF EXISTS organizers_insert ON public.organizers;
CREATE POLICY organizers_insert ON public.organizers
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
    OR (
      public.has_role('organizer')
      AND owner_id = auth.uid()
      AND status = 'pending'
      AND approval_status = 'pending'
      AND approved_at IS NULL
    )
  );
DROP POLICY IF EXISTS organizers_update ON public.organizers;
CREATE POLICY organizers_update ON public.organizers
  FOR UPDATE TO authenticated
  USING (public.can_manage_organizer(id))
  WITH CHECK (public.can_manage_organizer(id));
DROP POLICY IF EXISTS organizers_delete ON public.organizers;
CREATE POLICY organizers_delete ON public.organizers
  FOR DELETE TO authenticated USING (public.is_admin());

-- organizer_staff: members see their own assignment; owners/admins manage assignments.
DROP POLICY IF EXISTS organizer_staff_select ON public.organizer_staff;
CREATE POLICY organizer_staff_select ON public.organizer_staff
  FOR SELECT TO authenticated USING (
    public.is_admin() OR public.owns_organizer(organizer_id) OR user_id = auth.uid()
  );
DROP POLICY IF EXISTS organizer_staff_insert ON public.organizer_staff;
CREATE POLICY organizer_staff_insert ON public.organizer_staff
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_organizer(organizer_id));
DROP POLICY IF EXISTS organizer_staff_update ON public.organizer_staff;
CREATE POLICY organizer_staff_update ON public.organizer_staff
  FOR UPDATE TO authenticated
  USING (public.can_manage_organizer(organizer_id))
  WITH CHECK (public.can_manage_organizer(organizer_id));
DROP POLICY IF EXISTS organizer_staff_delete ON public.organizer_staff;
CREATE POLICY organizer_staff_delete ON public.organizer_staff
  FOR DELETE TO authenticated USING (public.can_manage_organizer(organizer_id));

-- event_categories: active categories are public; inactive ones are admin-only.
DROP POLICY IF EXISTS event_categories_select ON public.event_categories;
CREATE POLICY event_categories_select ON public.event_categories
  FOR SELECT TO public USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS event_categories_write ON public.event_categories;
CREATE POLICY event_categories_write ON public.event_categories
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- events: the core public rule is status=published AND approval_status=approved.
DROP POLICY IF EXISTS events_public_select ON public.events;
CREATE POLICY events_public_select ON public.events
  FOR SELECT TO public USING (public.is_event_public(id));
DROP POLICY IF EXISTS events_member_select ON public.events;
CREATE POLICY events_member_select ON public.events
  FOR SELECT TO authenticated USING (public.can_access_event(id));
DROP POLICY IF EXISTS events_insert ON public.events;
CREATE POLICY events_insert ON public.events
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
    OR (
      public.owns_active_organizer(organizer_id)
      AND status IN ('draft', 'pending')
      AND approval_status = 'pending'
      AND approved_at IS NULL
      AND published_at IS NULL
      AND cancelled_at IS NULL
    )
  );
DROP POLICY IF EXISTS events_update ON public.events;
CREATE POLICY events_update ON public.events
  FOR UPDATE TO authenticated
  USING (public.can_manage_event(id)) WITH CHECK (public.can_manage_event(id));
DROP POLICY IF EXISTS events_delete ON public.events;
CREATE POLICY events_delete ON public.events FOR DELETE TO authenticated USING (public.is_admin());

-- event_lineup_items: follows the parent event's visibility/access.
DROP POLICY IF EXISTS event_lineup_public_select ON public.event_lineup_items;
CREATE POLICY event_lineup_public_select ON public.event_lineup_items
  FOR SELECT TO public USING (public.is_event_public(event_id));
DROP POLICY IF EXISTS event_lineup_member_select ON public.event_lineup_items;
CREATE POLICY event_lineup_member_select ON public.event_lineup_items
  FOR SELECT TO authenticated USING (public.can_access_event(event_id));
DROP POLICY IF EXISTS event_lineup_write ON public.event_lineup_items;
CREATE POLICY event_lineup_write ON public.event_lineup_items
  FOR ALL TO authenticated
  USING (public.can_manage_event(event_id)) WITH CHECK (public.can_manage_event(event_id));

-- event_staff: explicit per-event assignments only.
DROP POLICY IF EXISTS event_staff_select ON public.event_staff;
CREATE POLICY event_staff_select ON public.event_staff
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.owns_organizer((SELECT e.organizer_id FROM public.events e WHERE e.id = event_staff.event_id))
  );
DROP POLICY IF EXISTS event_staff_write ON public.event_staff;
CREATE POLICY event_staff_write ON public.event_staff
  FOR ALL TO authenticated
  USING (public.can_manage_event(event_id)) WITH CHECK (public.can_manage_event(event_id));

-- ticket_types and inventory: public buyers see active sale data for public events only.
DROP POLICY IF EXISTS ticket_types_public_select ON public.ticket_types;
CREATE POLICY ticket_types_public_select ON public.ticket_types
  FOR SELECT TO public USING (
    public.is_event_public(event_id) AND is_active AND status = 'active'
  );
DROP POLICY IF EXISTS ticket_types_member_select ON public.ticket_types;
CREATE POLICY ticket_types_member_select ON public.ticket_types
  FOR SELECT TO authenticated USING (public.can_access_event(event_id));
DROP POLICY IF EXISTS ticket_types_write ON public.ticket_types;
CREATE POLICY ticket_types_write ON public.ticket_types
  FOR ALL TO authenticated
  USING (public.can_manage_event(event_id)) WITH CHECK (public.can_manage_event(event_id));

DROP POLICY IF EXISTS ticket_inventory_public_select ON public.ticket_inventory;
CREATE POLICY ticket_inventory_public_select ON public.ticket_inventory
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.ticket_types tt
      WHERE tt.id = ticket_inventory.ticket_type_id
        AND tt.is_active
        AND tt.status = 'active'
        AND public.is_event_public(tt.event_id)
    )
  );
DROP POLICY IF EXISTS ticket_inventory_member_select ON public.ticket_inventory;
CREATE POLICY ticket_inventory_member_select ON public.ticket_inventory
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ticket_types tt
      WHERE tt.id = ticket_inventory.ticket_type_id
        AND public.can_access_event(tt.event_id)
    )
  );

-- Reservations are read-only to clients; checkout code will use a server-side role later.
DROP POLICY IF EXISTS reservations_select ON public.ticket_inventory_reservations;
CREATE POLICY reservations_select ON public.ticket_inventory_reservations
  FOR SELECT TO authenticated USING (public.can_access_reservation(id));
DROP POLICY IF EXISTS reservations_admin_write ON public.ticket_inventory_reservations;
CREATE POLICY reservations_admin_write ON public.ticket_inventory_reservations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Orders and order items: customer-only, organizer-event-only, admin-only.
DROP POLICY IF EXISTS orders_select ON public.orders;
CREATE POLICY orders_select ON public.orders
  FOR SELECT TO authenticated USING (public.can_access_order(id));
DROP POLICY IF EXISTS order_items_select ON public.order_items;
CREATE POLICY order_items_select ON public.order_items
  FOR SELECT TO authenticated USING (public.can_access_order(order_id));

-- Payments: buyers and event owners/staff assigned to the event may see status metadata.
DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments
  FOR SELECT TO authenticated USING (public.can_access_order(order_id));
DROP POLICY IF EXISTS webhooks_admin_select ON public.payment_webhook_events;
CREATE POLICY webhooks_admin_select ON public.payment_webhook_events
  FOR SELECT TO authenticated USING (public.is_admin());

-- Tickets: only the customer, event owner/staff, or admin.
DROP POLICY IF EXISTS tickets_select ON public.tickets;
CREATE POLICY tickets_select ON public.tickets
  FOR SELECT TO authenticated USING (public.can_view_ticket(id));
DROP POLICY IF EXISTS checkins_select ON public.ticket_checkins;
CREATE POLICY checkins_select ON public.ticket_checkins
  FOR SELECT TO authenticated USING (
    public.can_view_ticket(ticket_id) OR public.can_checkin_event(event_id)
  );
DROP POLICY IF EXISTS checkins_insert ON public.ticket_checkins;
CREATE POLICY checkins_insert ON public.ticket_checkins
  FOR INSERT TO authenticated WITH CHECK (
    scanned_by = auth.uid() AND public.can_checkin_event(event_id)
  );
DROP POLICY IF EXISTS checkins_update ON public.ticket_checkins;
CREATE POLICY checkins_update ON public.ticket_checkins
  FOR UPDATE TO authenticated
  USING (public.can_checkin_event(event_id) AND scanned_by = auth.uid())
  WITH CHECK (public.can_checkin_event(event_id) AND scanned_by = auth.uid());
DROP POLICY IF EXISTS checkins_delete ON public.ticket_checkins;
CREATE POLICY checkins_delete ON public.ticket_checkins
  FOR DELETE TO authenticated USING (public.is_admin());

-- Finance: refunds are admin-only; organizers can view their own commission/payout records.
DROP POLICY IF EXISTS refunds_admin_select ON public.refunds;
CREATE POLICY refunds_admin_select ON public.refunds
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS commissions_select ON public.organizer_commissions;
CREATE POLICY commissions_select ON public.organizer_commissions
  FOR SELECT TO authenticated USING (public.is_admin() OR public.owns_organizer(organizer_id));
DROP POLICY IF EXISTS payouts_select ON public.organizer_payouts;
CREATE POLICY payouts_select ON public.organizer_payouts
  FOR SELECT TO authenticated USING (public.is_admin() OR public.owns_organizer(organizer_id));

-- Notifications: strictly per-user, no cross-customer reads.
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS notifications_delete ON public.notifications;
CREATE POLICY notifications_delete ON public.notifications
  FOR DELETE TO authenticated USING (public.is_admin());

-- Reviews: public only when approved; authors see their own pending review.
DROP POLICY IF EXISTS reviews_public_select ON public.reviews;
CREATE POLICY reviews_public_select ON public.reviews
  FOR SELECT TO public USING (status = 'approved');
DROP POLICY IF EXISTS reviews_owner_select ON public.reviews;
CREATE POLICY reviews_owner_select ON public.reviews
  FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.can_access_event(event_id));
DROP POLICY IF EXISTS reviews_insert ON public.reviews;
CREATE POLICY reviews_insert ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid() AND status = 'pending');
DROP POLICY IF EXISTS reviews_moderate ON public.reviews;
CREATE POLICY reviews_moderate ON public.reviews
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.can_manage_event(event_id))
  WITH CHECK (public.is_admin() OR public.can_manage_event(event_id));
DROP POLICY IF EXISTS reviews_delete ON public.reviews;
CREATE POLICY reviews_delete ON public.reviews
  FOR DELETE TO authenticated USING (
    public.is_admin() OR (customer_id = auth.uid() AND status = 'pending')
  );

-- Platform settings: only is_public values are visible to anonymous clients.
DROP POLICY IF EXISTS platform_settings_select ON public.platform_settings;
CREATE POLICY platform_settings_select ON public.platform_settings
  FOR SELECT TO public USING (is_public OR public.is_admin());
DROP POLICY IF EXISTS platform_settings_write ON public.platform_settings;
CREATE POLICY platform_settings_write ON public.platform_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Audit log: read-only to admins; writes come from server-side code only.
DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_select ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());
