-- Explicitly add the schedule_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'clients' 
                   AND column_name = 'schedule_id') THEN
        ALTER TABLE public.clients 
        ADD COLUMN schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL;
    END IF;
END $$;
