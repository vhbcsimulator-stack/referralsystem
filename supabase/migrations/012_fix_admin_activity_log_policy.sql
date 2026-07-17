-- Fix: Allow admins to insert activity logs for any user_id (not just their own).
-- The previous policy "Users can insert logs" only allowed inserting rows where user_id = auth.uid(),
-- which blocked admin actions like approving/revoking users from being logged correctly.

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can insert logs" ON public.activity_logs;

-- New policy: Authenticated users can insert logs where user_id = their own uid (referrer actions)
CREATE POLICY "Authenticated users can insert own logs"
  ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- New policy: Admins can insert logs with any user_id (for admin actions)
CREATE POLICY "Admins can insert any logs"
  ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role = 'admin'));
