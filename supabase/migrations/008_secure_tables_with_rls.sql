-- Enable Row Level Security on core tables
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 1. Policies for app_users
-- Admins can do everything
CREATE POLICY "Admins have full access to app_users"
  ON public.app_users
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role = 'admin'));

-- Users can view and update their own profile
CREATE POLICY "Users can view own profile"
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.app_users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Policies for schedules
-- Admins can do everything
CREATE POLICY "Admins have full access to schedules"
  ON public.schedules
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role = 'admin'));

-- Referrers can view their own schedules
CREATE POLICY "Referrers can view own schedules"
  ON public.schedules
  FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid());

-- Referrers can insert their own schedules
CREATE POLICY "Referrers can insert own schedules"
  ON public.schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (referrer_id = auth.uid());

-- 3. Policies for clients
-- Admins can do everything
CREATE POLICY "Admins have full access to clients"
  ON public.clients
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role = 'admin'));

-- Referrers can view clients associated with their schedules
CREATE POLICY "Referrers can view own clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.schedules
      WHERE public.schedules.id = public.clients.schedule_id
      AND public.schedules.referrer_id = auth.uid()
    )
  );

-- Referrers can insert clients for their schedules
CREATE POLICY "Referrers can insert own clients"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedules
      WHERE public.schedules.id = public.clients.schedule_id
      AND public.schedules.referrer_id = auth.uid()
    )
  );

-- 4. Secure Signup Logic
-- Function to handle new user registration safely
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.app_users (id, full_name, email, role, verification_status, mobile_number, id_card_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'referrer', -- Force referrer role for all new signups
    'not_verified', -- Force unverified status
    COALESCE(new.raw_user_meta_data->>'mobile_number', ''),
    COALESCE(new.raw_user_meta_data->>'id_card_url', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on signup
-- Note: Check if trigger already exists to avoid errors
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
