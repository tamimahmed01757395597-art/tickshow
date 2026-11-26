-- Phase 1 / 0001: extensions and constrained enum values.
-- Idempotent: safe to re-run; never drops existing objects.
-- gen_random_uuid() is built into PostgreSQL 13+ (Supabase), so no extension is required.

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'organizer', 'staff', 'customer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE public.account_status AS ENUM ('active', 'suspended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organizer_status') THEN
    CREATE TYPE public.organizer_status AS ENUM ('pending', 'active', 'suspended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE public.event_status AS ENUM ('draft', 'pending', 'published', 'rejected', 'cancelled', 'completed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_type_status') THEN
    CREATE TYPE public.ticket_type_status AS ENUM ('draft', 'active', 'paused', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_reservation_status') THEN
    CREATE TYPE public.inventory_reservation_status AS ENUM ('pending', 'confirmed', 'released', 'expired', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE public.payment_method AS ENUM ('card', 'bkash', 'nagad', 'bank_transfer', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
    CREATE TYPE public.refund_status AS ENUM ('pending', 'processing', 'succeeded', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
    CREATE TYPE public.payout_status AS ENUM ('pending', 'in_transit', 'paid', 'failed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_status') THEN
    CREATE TYPE public.commission_status AS ENUM ('pending', 'settled', 'waived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
    CREATE TYPE public.ticket_status AS ENUM ('valid', 'used', 'cancelled', 'refunded', 'expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checkin_status') THEN
    CREATE TYPE public.checkin_status AS ENUM ('not_checked_in', 'checked_in', 'void');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checkin_result') THEN
    CREATE TYPE public.checkin_result AS ENUM ('success', 'denied', 'reversed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organizer_staff_role') THEN
    CREATE TYPE public.organizer_staff_role AS ENUM ('manager', 'checkin', 'sales', 'support', 'analyst');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_staff_permission') THEN
    CREATE TYPE public.event_staff_permission AS ENUM ('view', 'checkin', 'manage_orders');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
    CREATE TYPE public.review_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE public.notification_type AS ENUM (
      'order_created', 'payment_succeeded', 'payment_failed', 'ticket_issued',
      'event_published', 'event_cancelled', 'refund_issued', 'payout_paid', 'system'
    );
  END IF;
END
$migration$;
