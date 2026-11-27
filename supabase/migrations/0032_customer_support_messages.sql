DO $$
BEGIN
  CREATE TYPE public.support_message_status AS ENUM ('open', 'in_progress', 'resolved');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  sender_email text NOT NULL,
  form_type text NOT NULL,
  message text NOT NULL,
  status public.support_message_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_email_format CHECK (
    sender_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  CONSTRAINT support_messages_form_type_valid CHECK (form_type IN ('contact', 'support')),
  CONSTRAINT support_messages_message_length CHECK (
    length(btrim(message)) BETWEEN 1 AND 5000
  )
);

CREATE INDEX support_messages_created_at_idx
  ON public.support_messages (created_at DESC);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_messages_public_insert ON public.support_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    user_id IS NOT DISTINCT FROM auth.uid()
    AND status = 'open'
  );

CREATE POLICY support_messages_admin_select ON public.support_messages
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY support_messages_admin_update ON public.support_messages
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.support_messages FROM anon, authenticated;
GRANT INSERT (sender_email, form_type, message)
  ON TABLE public.support_messages TO anon, authenticated;
GRANT SELECT ON TABLE public.support_messages TO authenticated;
GRANT UPDATE (status) ON TABLE public.support_messages TO authenticated;
