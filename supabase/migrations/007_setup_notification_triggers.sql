-- Function to handle in-app notifications
CREATE OR REPLACE FUNCTION public.handle_in_app_notification()
RETURNS trigger AS $$
DECLARE
  admin_id uuid;
BEGIN
  -- 1. Notify all admins on NEW registrations or NEW schedules
  IF TG_OP = 'INSERT' THEN
    FOR admin_id IN (SELECT id FROM public.app_users WHERE role = 'admin') LOOP
      IF TG_TABLE_NAME = 'app_users' THEN
        INSERT INTO public.notifications (user_id, entity_id, title, message, type)
        VALUES (
          admin_id,
          NEW.id,
          'New User Registration',
          'A new user (' || COALESCE(NEW.full_name, 'Unknown') || ') has joined and requires verification.',
          'verification_update'
        );
      ELSIF TG_TABLE_NAME = 'schedules' THEN
        INSERT INTO public.notifications (user_id, entity_id, title, message, type)
        VALUES (
          admin_id,
          NEW.id,
          'New Schedule Request',
          'A new site tripping request has been submitted for ' || COALESCE(NEW.client_name, 'Unknown') || '.',
          'new_request'
        );
      END IF;
    END LOOP;
  
  -- 2. Notify relevant users on UPDATES (e.g., schedule approval/rejection or rescheduling)
  ELSIF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'schedules' THEN
      -- Check if date or time has changed (Rescheduling)
      -- This handles date/time updates on both Approved and Pending requests
      IF OLD.schedule_date != NEW.schedule_date OR OLD.schedule_time != NEW.schedule_time THEN
        FOR admin_id IN (SELECT id FROM public.app_users WHERE role = 'admin') LOOP
          INSERT INTO public.notifications (user_id, entity_id, title, message, type)
          VALUES (
            admin_id,
            NEW.id,
            'Reschedule Request',
            'A schedule for ' || COALESCE(NEW.client_name, 'Unknown') || ' has been rescheduled to ' || NEW.schedule_date || ' at ' || NEW.schedule_time || '.',
            'reschedule_request'
          );
        END LOOP;
      END IF;

      -- Check if status has changed
      IF OLD.status != NEW.status THEN
        -- Notify the referrer who requested the schedule
        INSERT INTO public.notifications (user_id, entity_id, title, message, type)
        VALUES (
          NEW.referrer_id,
          NEW.id,
          'Schedule Status Update',
          'Your site tripping request for ' || COALESCE(NEW.client_name, 'Unknown') || ' has been updated to: ' || NEW.status || '.',
          CASE 
            WHEN NEW.status = 'Approved' THEN 'schedule_approved'
            ELSE 'status_change'
          END
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_user_signup_in_app_notification ON public.app_users;
CREATE TRIGGER on_user_signup_in_app_notification
AFTER INSERT ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.handle_in_app_notification();

-- Trigger for new schedule request
DROP TRIGGER IF EXISTS on_schedule_request_in_app_notification ON public.schedules;
CREATE TRIGGER on_schedule_request_in_app_notification
AFTER INSERT ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.handle_in_app_notification();

-- Trigger for schedule status update
DROP TRIGGER IF EXISTS on_schedule_status_update_in_app_notification ON public.schedules;
CREATE TRIGGER on_schedule_status_update_in_app_notification
AFTER UPDATE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.handle_in_app_notification();
