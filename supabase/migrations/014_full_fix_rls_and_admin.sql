-- ============================================================
-- FULL FIX v4: Fixes infinite recursion in RLS policies
-- Run this ENTIRE script in: Supabase Dashboard → SQL Editor
-- ============================================================

-- -------------------------------------------------------
-- PART 1: Remove the broken email notification webhook
-- -------------------------------------------------------

DROP TRIGGER IF EXISTS on_user_signup_notification ON public.app_users;
DROP TRIGGER IF EXISTS on_user_verification_notification ON public.app_users;
DROP TRIGGER IF EXISTS on_schedule_request_notification ON public.schedules;
DROP FUNCTION IF EXISTS public.handle_notification_webhook();

-- -------------------------------------------------------
-- PART 2: Create a SECURITY DEFINER helper function
-- This runs as superuser (bypasses RLS) to check if the
-- current user is admin — prevents infinite recursion.
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- -------------------------------------------------------
-- PART 3: Fix app_users RLS policies (no self-reference)
-- -------------------------------------------------------

DROP POLICY IF EXISTS "Admins have full access to app_users" ON public.app_users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.app_users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.app_users;
DROP POLICY IF EXISTS "Admins can select all users" ON public.app_users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.app_users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.app_users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.app_users;

-- Every user can read their own row (needed for login profile fetch)
CREATE POLICY "Users can view own profile"
  ON public.app_users FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Every user can update their own row (settings page)
CREATE POLICY "Users can update own profile"
  ON public.app_users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can SELECT all rows (uses is_admin() to avoid recursion)
CREATE POLICY "Admins can select all users"
  ON public.app_users FOR SELECT TO authenticated
  USING (public.is_admin());

-- Admins can UPDATE any row (user verification approval)
CREATE POLICY "Admins can update all users"
  ON public.app_users FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can DELETE rows
CREATE POLICY "Admins can delete users"
  ON public.app_users FOR DELETE TO authenticated
  USING (public.is_admin());

-- -------------------------------------------------------
-- PART 4: Fix activity_logs RLS policies
-- -------------------------------------------------------

DROP POLICY IF EXISTS "Users can insert logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert own logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can insert any logs" ON public.activity_logs;

CREATE POLICY "Authenticated users can insert own logs"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can insert any logs"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- -------------------------------------------------------
-- PART 5: Set your account to admin (safe now — no recursion)
-- -------------------------------------------------------

UPDATE public.app_users
SET role = 'admin',
    verification_status = 'verified'
WHERE email = 'geralddelima.vhbc@gmail.com';

-- -------------------------------------------------------
-- PART 6: Verify — should show role=admin, status=verified
-- -------------------------------------------------------

SELECT id, full_name, email, role, verification_status
FROM public.app_users
WHERE email = 'geralddelima.vhbc@gmail.com';
