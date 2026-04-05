-- Script to fix the ServiceOrder table by adding missing columns
-- Execute this in your Supabase SQL Editor at https://supabase.com/dashboard/project/vcbbvqhfcnouhsazqoxr/sql

-- 1. Add missing technician and cost columns to ServiceOrder
ALTER TABLE public."ServiceOrder" 
ADD COLUMN IF NOT EXISTS "technician_id" UUID,
ADD COLUMN IF NOT EXISTS "technician_name" TEXT,
ADD COLUMN IF NOT EXISTS "total_cost" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP WITH TIME ZONE;

-- 2. Verify and add missing columns to TechnicianHistory (if not there)
ALTER TABLE public."TechnicianHistory"
ADD COLUMN IF NOT EXISTS "from_technician_id" UUID,
ADD COLUMN IF NOT EXISTS "from_technician_name" TEXT,
ADD COLUMN IF NOT EXISTS "to_technician_id" UUID,
ADD COLUMN IF NOT EXISTS "to_technician_name" TEXT;

-- 3. Invalidate schema cache
NOTIFY pgrst, 'reload schema';
