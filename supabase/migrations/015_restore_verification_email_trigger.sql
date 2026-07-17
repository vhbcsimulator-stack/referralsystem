-- ============================================================
-- Migration 015: Restore Verification Email + In-App Notification
--
-- Context: Migration 014 dropped the old handle_notification_webhook()
-- and on_user_verification_notification trigger because they caused
-- an RLS infinite recursion. The RLS policies have since been fixed
-- (using the is_admin() SECURITY DEFINER helper). This migration
-- safely re-creates both the email webhook trigger and an in-app
-- notification insert for the user when their verification_status
-- changes from pending to verified.
-- ============================================================


-- -------------------------------------------------------
-- PART 0: Configure the service role key for the DB trigger
--
-- The DB trigger uses pg_net to HTTP-call the Edge Function.
-- It reads the service role key via current_setting() at runtime.
-- You must set it here before the trigger can authenticate.
--
-- HOW TO GET YOUR SERVICE ROLE KEY:
--   Supabase Dashboard → Settings → API → "service_role" key
--   (it is different from the anon key)
--
-- NOTE: SUPABASE_SERVICE_ROLE_KEY is auto-injected into Edge
-- Functions by Supabase — you do NOT need to add it as a secret
-- in the Edge Functions secrets page.
-- -------------------------------------------------------

ALTER DATABASE postgres
  SET app.settings.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVicmZidHZ6YmFzdmZkeW5wdWthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQxOTMzMSwiZXhwIjoyMDg3OTk1MzMxfQ.vaR3HRtR51eJiuzj6PnHTDON_M48Pyb0GiALD0997U0';


-- -------------------------------------------------------
-- PART 1: Re-create the email webhook function
-- Uses SECURITY DEFINER so it runs as a superuser role
-- and is not subject to RLS on app_users, avoiding the
-- infinite recursion bug that existed before migration 014.
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_verification_email_webhook()
RETURNS trigger AS $$
DECLARE
  payload jsonb;
BEGIN
  -- Only act when verification_status actually changes to 'verified'
  IF NEW.verification_status IS NOT DISTINCT FROM OLD.verification_status THEN
    RETURN NEW;
  END IF;

  IF NEW.verification_status = 'verified' THEN
    payload := jsonb_build_object(
      'record',     row_to_json(NEW),
      'old_record', row_to_json(OLD),
      'table',      TG_TABLE_NAME,
      'type',       TG_OP
    );

    -- Fire-and-forget HTTP call to the Edge Function (pg_net is already enabled)
    PERFORM
      net.http_post(
        url     := 'https://ubrfbtvzbasvfdynpuka.supabase.co/functions/v1/send-notification',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body    := payload
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------------
-- PART 2: Re-create the email webhook trigger
-- Scoped only to verification_status column changes so it
-- does not fire on every unrelated update to app_users.
-- -------------------------------------------------------

DROP TRIGGER IF EXISTS on_user_verification_email ON public.app_users;
CREATE TRIGGER on_user_verification_email
  AFTER UPDATE OF verification_status ON public.app_users
  FOR EACH ROW
  WHEN (OLD.verification_status IS DISTINCT FROM NEW.verification_status)
  EXECUTE FUNCTION public.handle_verification_email_webhook();


-- -------------------------------------------------------
-- PART 3: Add in-app notification for the verified user
-- When admin flips the status to 'verified', the user gets
-- a bell-icon notification inside the app as well.
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_verification_in_app_notification()
RETURNS trigger AS $$
BEGIN
  -- Insert notification for the newly-verified user
  IF NEW.verification_status = 'verified' AND OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
    INSERT INTO public.notifications (user_id, entity_id, title, message, type)
    VALUES (
      NEW.id,
      NEW.id,
      'Account Verified',
      'Congratulations! Your VHBC Referrer account has been approved. You can now access your dashboard.',
      'verification_update'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP TRIGGER IF EXISTS on_user_verification_in_app_notification ON public.app_users;
CREATE TRIGGER on_user_verification_in_app_notification
  AFTER UPDATE OF verification_status ON public.app_users
  FOR EACH ROW
  WHEN (OLD.verification_status IS DISTINCT FROM NEW.verification_status)
  EXECUTE FUNCTION public.handle_verification_in_app_notification();
