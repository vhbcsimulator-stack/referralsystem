-- Migration 019: Fix verification status default on signup and update existing users
-- Run this SQL script in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard)

-- 1. Update the handle_new_user() trigger function to use 'pending' as the default status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  max_num integer;
BEGIN
  -- Find the largest control_number currently in the app_users table
  SELECT COALESCE(MAX(control_number), 0) INTO max_num FROM public.app_users;

  -- Insert the new user profile, setting verification_status to 'pending'
  INSERT INTO public.app_users (
    id, 
    full_name, 
    email, 
    role, 
    verification_status, 
    mobile_number, 
    id_card_url, 
    control_number
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'referrer',          -- Force referrer role for all new signups
    'pending',           -- Force pending status (so they show up on admin verification page)
    COALESCE(new.raw_user_meta_data->>'mobile_number', ''),
    COALESCE(new.raw_user_meta_data->>'id_card_url', ''),
    max_num + 1          -- Set auto-incremented control number
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update existing referrers who are stuck in 'not_verified' status to 'pending'
-- so they immediately appear in the User Verification page of the admin portal.
UPDATE public.app_users
SET verification_status = 'pending'
WHERE role = 'referrer' AND (verification_status = 'not_verified' OR verification_status IS NULL);
