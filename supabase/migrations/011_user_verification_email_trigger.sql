-- Update the webhook handler to pass the OLD record on updates
CREATE OR REPLACE FUNCTION public.handle_notification_webhook()
RETURNS trigger AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE null END,
    'table', TG_TABLE_NAME,
    'type', TG_OP
  );

  -- Call the edge function
  PERFORM
    net.http_post(
      url := 'https://ubrfbtvzbasvfdynpuka.supabase.co/functions/v1/send-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := payload
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for user verification update
DROP TRIGGER IF EXISTS on_user_verification_notification ON public.app_users;
CREATE TRIGGER on_user_verification_notification
AFTER UPDATE OF verification_status ON public.app_users
FOR EACH ROW
WHEN (OLD.verification_status IS DISTINCT FROM NEW.verification_status)
EXECUTE FUNCTION public.handle_notification_webhook();
