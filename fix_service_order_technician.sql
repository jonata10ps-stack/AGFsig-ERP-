-- Script to fix the ServiceOrder table by adding missing technician columns
-- Execute this in your Supabase SQL Editor at https://supabase.com/dashboard/project/vcbbvqhfcnouhsazqoxr/sql

ALTER TABLE public."ServiceOrder" 
ADD COLUMN IF NOT EXISTS "technician_id" UUID,
ADD COLUMN IF NOT EXISTS "technician_name" TEXT;

-- Verify if TechnicianHistory also needs columns (it seems to be working but let's be safe)
ALTER TABLE public."TechnicianHistory"
ADD COLUMN IF NOT EXISTS "from_technician_id" UUID,
ADD COLUMN IF NOT EXISTS "from_technician_name" TEXT,
ADD COLUMN IF NOT EXISTS "to_technician_id" UUID,
ADD COLUMN IF NOT EXISTS "to_technician_name" TEXT;

-- Trigger a schema cache reload for PostgREST
NOTIFY pgrst, 'reload schema';
