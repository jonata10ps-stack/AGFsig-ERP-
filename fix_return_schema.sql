-- Script to fix the Return and ReturnItem tables by adding missing columns
-- Execute this in your Supabase SQL Editor

ALTER TABLE public."Return" 
ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'ABERTA',
ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "analyzed_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "analyzed_by" TEXT,
ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "resolution" TEXT,
ADD COLUMN IF NOT EXISTS "credit_amount" DECIMAL,
ADD COLUMN IF NOT EXISTS "return_number" TEXT;

-- Standardize existing status if any
UPDATE public."Return" SET "status" = 'ABERTA' WHERE "status" IS NULL;

ALTER TABLE public."ReturnItem"
ADD COLUMN IF NOT EXISTS "return_id" UUID;

-- Trigger a schema cache reload for PostgREST
NOTIFY pgrst, 'reload schema';
