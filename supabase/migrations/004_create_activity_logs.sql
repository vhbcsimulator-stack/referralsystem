-- Create the activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  user_id uuid NOT NULL, -- The user who performed the action
  action_type text NOT NULL, -- e.g., 'STATUS_CHANGE', 'SCHEDULE_APPROVED'
  entity_type text NOT NULL, -- e.g., 'client', 'schedule'
  entity_id uuid NOT NULL, -- The ID of the client or schedule
  description text NOT NULL, -- Human-readable description
  metadata jsonb NULL, -- Optional JSON for storing before/after values
  created_at timestamp WITH TIME ZONE NOT NULL DEFAULT timezone ('utc'::text, now()),
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Add RLS policies (optional but recommended)
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all logs" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can insert logs" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
