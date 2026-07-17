-- ============================================================
-- Migration 016: Fix pg_net missing + safe email trigger
--
-- Problem: Migration 015 created a trigger calling net.http_post()
-- but the pg_net extension was not enabled, causing every
-- verification_status UPDATE to fail with:
--   schema "net" does not exist
--
-- Fix:
--   1. Enable the pg_net extension
--   2. Rewrite handle_verification_email_webhook() with an
--      EXCEPTION handler so email failures NEVER block approval
-- ============================================================


-- -------------------------------------------------------
-- PART 1: Enable pg_net extension
-- This adds the net schema and net.http_post() function.
-- Safe to run even if already enabled (IF NOT EXISTS).
-- -------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;


-- -------------------------------------------------------
-- PART 2: Rewrite the webhook function with exception handling
--
-- Critical: The outer BEGIN...EXCEPTION block ensures that
-- even if net.http_post() fails for any reason (network,
-- missing extension, bad key, etc.), the function returns
-- NEW successfully — the verification update is NEVER blocked.
--
-- The email is fire-and-forget. Approval always succeeds.
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_verification_email_webhook()
RETURNS trigger AS $$
DECLARE
  payload jsonb;
BEGIN
  IF NEW.verification_status = 'verified' THEN
    payload := jsonb_build_object(
      'record',     row_to_json(NEW),
      'old_record', row_to_json(OLD),
      'table',      TG_TABLE_NAME,
      'type',       TG_OP
    );

    BEGIN
      -- Fire-and-forget HTTP call to the Edge Function
      PERFORM
        net.http_post(
          url     := 'https://ubrfbtvzbasvfdynpuka.supabase.co/functions/v1/send-notification',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
          ),
          body    := payload
        );
    EXCEPTION WHEN OTHERS THEN
      -- Log the error but DO NOT re-raise it.
      -- Approval must succeed even if email sending fails.
      RAISE WARNING 'handle_verification_email_webhook: HTTP call failed — %, %', SQLERRM, SQLSTATE;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger stays the same — just re-declaring for idempotency
DROP TRIGGER IF EXISTS on_user_verification_email ON public.app_users;
CREATE TRIGGER on_user_verification_email
  AFTER UPDATE OF verification_status ON public.app_users
  FOR EACH ROW
  WHEN (OLD.verification_status IS DISTINCT FROM NEW.verification_status)
  EXECUTE FUNCTION public.handle_verification_email_webhook();
