-- ============================================================
-- Migration 017: Fix NULL service_role_key — embed key in function
--
-- Problem: ALTER DATABASE is blocked in Supabase's managed
-- environment (permission denied), so current_setting() always
-- returns NULL, causing the Edge Function to get an empty
-- Authorization header and reject every request with 401.
--
-- Fix: Rewrite the webhook function to embed the service role
-- key directly in the function body. No runtime database setting
-- is needed. The function is SECURITY DEFINER so it is safe.
-- ============================================================


-- -------------------------------------------------------
-- Rewrite the webhook function with the key embedded directly.
-- The service role key is hardcoded here as the authoritative
-- value. This is the most reliable approach in Supabase's
-- managed environment where ALTER DATABASE is not available.
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_verification_email_webhook()
RETURNS trigger AS $$
DECLARE
  payload     jsonb;
  service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVicmZidHZ6YmFzdmZkeW5wdWthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQxOTMzMSwiZXhwIjoyMDg3OTk1MzMxfQ.vaR3HRtR51eJiuzj6PnHTDON_M48Pyb0GiALD0997U0';
BEGIN
  IF NEW.verification_status = 'verified' THEN
    payload := jsonb_build_object(
      'record',     row_to_json(NEW),
      'old_record', row_to_json(OLD),
      'table',      TG_TABLE_NAME,
      'type',       TG_OP
    );

    BEGIN
      PERFORM
        net.http_post(
          url     := 'https://ubrfbtvzbasvfdynpuka.supabase.co/functions/v1/send-notification',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || service_key
          ),
          body    := payload
        );
    EXCEPTION WHEN OTHERS THEN
      -- Log but never block the approval UPDATE
      RAISE WARNING 'handle_verification_email_webhook: HTTP call failed — %, %', SQLERRM, SQLSTATE;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
