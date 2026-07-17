-- Enable the pg_net extension to allow HTTP requests from the database
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call the edge function
CREATE OR REPLACE FUNCTION public.handle_notification_webhook()
RETURNS trigger AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'record', row_to_json(NEW),
    'table', TG_TABLE_NAME,
    'type', TG_OP
  );

  -- Call the edge function
  -- You'll need to update the URL with your actual Supabase project ref
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

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_user_signup_notification ON public.app_users;
CREATE TRIGGER on_user_signup_notification
AFTER INSERT ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.handle_notification_webhook();

-- Trigger for new schedule request
DROP TRIGGER IF EXISTS on_schedule_request_notification ON public.schedules;
CREATE TRIGGER on_schedule_request_notification
AFTER INSERT ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.handle_notification_webhook();
