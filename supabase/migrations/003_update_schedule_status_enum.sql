-- Add new values to the schedule_status enum
-- Note: These must be run outside of a transaction block in some environments, 
-- but Supabase SQL editor handles them fine.
ALTER TYPE public.schedule_status ADD VALUE IF NOT EXISTS 'Done Tripping';
ALTER TYPE public.schedule_status ADD VALUE IF NOT EXISTS 'Closed Sale';
ALTER TYPE public.schedule_status ADD VALUE IF NOT EXISTS 'Not Interested';
