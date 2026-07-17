-- Create custom enums if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'valid_platforms') THEN
        CREATE TYPE public.valid_platforms AS ENUM ('Google Meet', 'Zoom', 'In-person');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_status') THEN
        CREATE TYPE public.schedule_status AS ENUM ('Pending', 'Approved', 'Cancelled');
    END IF;
END $$;

-- Create the schedules table
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  referrer_id uuid NOT NULL,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_number text NOT NULL,
  schedule_date date NOT NULL,
  schedule_time time WITHOUT TIME ZONE NOT NULL,
  platform public.valid_platforms NOT NULL,
  status public.schedule_status NOT NULL DEFAULT 'Pending'::schedule_status,
  created_at timestamp WITH TIME ZONE NOT NULL DEFAULT timezone ('utc'::text, now()),
  updated_at timestamp WITH TIME ZONE NOT NULL DEFAULT timezone ('utc'::text, now()),
  meeting_link text NULL,
  CONSTRAINT schedules_pkey PRIMARY KEY (id),
  CONSTRAINT schedules_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES app_users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create the clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  schedule_id uuid NULL,
  client_name text NOT NULL,
  client_email text NOT NULL,
  contact_no text NOT NULL,
  referrer_name text NOT NULL,
  meeting_link text NULL,
  status text NOT NULL DEFAULT 'Pending'::text,
  created_at timestamp WITH TIME ZONE NOT NULL DEFAULT timezone ('utc'::text, now()),
  updated_at timestamp WITH TIME ZONE NOT NULL DEFAULT timezone ('utc'::text, now()),
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules (id) ON DELETE SET NULL
) TABLESPACE pg_default;
