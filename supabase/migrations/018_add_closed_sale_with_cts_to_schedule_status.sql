-- Add 'Closed Sale with CTS' value to the schedule_status enum
ALTER TYPE public.schedule_status ADD VALUE IF NOT EXISTS 'Closed Sale with CTS';
