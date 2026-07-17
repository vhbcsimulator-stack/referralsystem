-- Add 'Rescheduled' value to the schedule_status enum
ALTER TYPE public.schedule_status ADD VALUE IF NOT EXISTS 'Rescheduled';
