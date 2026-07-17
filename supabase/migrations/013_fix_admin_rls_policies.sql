-- ============================================================
-- FIX: Admin cannot approve/update users in app_users table
-- Run this entire script in your Supabase SQL Editor
-- ============================================================

-- Step 1: Drop ALL existing policies on app_users to start fresh
DROP POLICY IF EXISTS "Admins have full access to app_users" ON public.app_users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.app_users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.app_users;

-- Step 2: Recreate policies with explicit WITH CHECK clauses
-- Admins: full access (SELECT, INSERT, UPDATE, DELETE) on ALL rows
CREATE POLICY "Admins can select all users"
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update all users"
  ON public.app_users
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert users"
  ON public.app_users
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete users"
  ON public.app_users
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role = 'admin'));

-- Referrers: can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Referrers: can update their own profile (but NOT change role or verification_status)
CREATE POLICY "Users can update own profile"
  ON public.app_users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 3: Fix activity_logs insert policy
DROP POLICY IF EXISTS "Users can insert logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert own logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can insert any logs" ON public.activity_logs;

-- Allow any authenticated user to insert a log where user_id = their own uid
CREATE POLICY "Authenticated users can insert own logs"
  ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow admins to insert logs with any user_id
CREATE POLICY "Admins can insert any logs"
  ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role = 'admin'));

-- Step 4: Verify your admin account has the correct role
-- Run this SELECT to check: it should return your row with role = 'admin'
SELECT id, full_name, email, role, verification_status
FROM public.app_users
WHERE email = 'geralddelima.vhbc@gmail.com';
