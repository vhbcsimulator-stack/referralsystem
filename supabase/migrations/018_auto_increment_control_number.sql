-- Migration 018: Auto-increment control_number on user registration trigger

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  max_num integer;
BEGIN
  -- 1. Find the largest control_number currently in the app_users table
  SELECT COALESCE(MAX(control_number), 0) INTO max_num FROM public.app_users;

  -- 2. Insert the new user profile, setting control_number to (largest number + 1)
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
    'pending',           -- Force pending status for verification
    COALESCE(new.raw_user_meta_data->>'mobile_number', ''),
    COALESCE(new.raw_user_meta_data->>'id_card_url', ''),
    max_num + 1          -- Set auto-incremented control number
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
