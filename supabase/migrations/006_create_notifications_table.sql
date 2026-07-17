-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
    user_id uuid NOT NULL, -- Target user
    entity_id uuid, -- Optional: ID of the entity this notification is about (e.g., schedule_id, user_id)
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL, -- e.g., 'new_request', 'verification_update', 'status_change', 'schedule_approved'
    is_read boolean NOT NULL DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb, -- Optional: extra data for the app
    created_at timestamp WITH TIME ZONE NOT NULL DEFAULT timezone ('utc'::text, now()),
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications (mark as read)"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- System/Admins can insert notifications
CREATE POLICY "Enable insert for authenticated users (to notify others)"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Enable real-time for notifications table (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
END $$;
