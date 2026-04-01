-- Robust Script to synchronize Supabase schema with frontend requirements
-- This script creates missing tables and adds missing columns safely.
-- Execute this in the Supabase SQL Editor.

-- Helper function to add columns safely (optional, but we'll use IF NOT EXISTS)
-- We'll use a standard pattern for each table:

-- 1. PaymentCondition
CREATE TABLE IF NOT EXISTS public."PaymentCondition" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."PaymentCondition" 
ADD COLUMN IF NOT EXISTS "code" TEXT,
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "discount_percentage" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "interest_percentage" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "parcelas" JSONB DEFAULT '[]';

-- 2. Quote
CREATE TABLE IF NOT EXISTS public."Quote" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."Quote"
ADD COLUMN IF NOT EXISTS "quote_number" TEXT,
ADD COLUMN IF NOT EXISTS "client_id" UUID,
ADD COLUMN IF NOT EXISTS "client_name" TEXT,
ADD COLUMN IF NOT EXISTS "client_document" TEXT,
ADD COLUMN IF NOT EXISTS "seller_id" UUID,
ADD COLUMN IF NOT EXISTS "seller_name" TEXT,
ADD COLUMN IF NOT EXISTS "payment_condition_id" UUID,
ADD COLUMN IF NOT EXISTS "payment_condition_name" TEXT,
ADD COLUMN IF NOT EXISTS "validity_date" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "delivery_date" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "notes" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT,
ADD COLUMN IF NOT EXISTS "total_amount" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "converted_at" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "converted_order_id" UUID;

-- 3. QuoteSubitem
CREATE TABLE IF NOT EXISTS public."QuoteSubitem" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."QuoteSubitem"
ADD COLUMN IF NOT EXISTS "quote_item_id" UUID,
ADD COLUMN IF NOT EXISTS "product_name" TEXT,
ADD COLUMN IF NOT EXISTS "qty" NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS "unit_price" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "total_price" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "line_sequence" INTEGER DEFAULT 1;

-- 4. QuoteAttachment
CREATE TABLE IF NOT EXISTS public."QuoteAttachment" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."QuoteAttachment"
ADD COLUMN IF NOT EXISTS "quote_id" UUID,
ADD COLUMN IF NOT EXISTS "file_url" TEXT,
ADD COLUMN IF NOT EXISTS "file_name" TEXT,
ADD COLUMN IF NOT EXISTS "file_type" TEXT,
ADD COLUMN IF NOT EXISTS "description" TEXT;

-- 5. User
CREATE TABLE IF NOT EXISTS public."User" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."User"
ADD COLUMN IF NOT EXISTS "email" TEXT,
ADD COLUMN IF NOT EXISTS "full_name" TEXT,
ADD COLUMN IF NOT EXISTS "allowed_modules" JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "company_ids" JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "is_seller" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "account_status" TEXT DEFAULT 'PENDENTE',
ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'user',
ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "approved_by" TEXT,
ADD COLUMN IF NOT EXISTS "current_company_id" UUID;

-- 6. Client
CREATE TABLE IF NOT EXISTS public."Client" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."Client"
ADD COLUMN IF NOT EXISTS "code" TEXT,
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "document" TEXT,
ADD COLUMN IF NOT EXISTS "email" TEXT,
ADD COLUMN IF NOT EXISTS "phone" TEXT,
ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "city" TEXT,
ADD COLUMN IF NOT EXISTS "state" TEXT,
ADD COLUMN IF NOT EXISTS "credit_limit" NUMERIC DEFAULT 0;

-- 7. Company
CREATE TABLE IF NOT EXISTS public."Company" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."Company"
ADD COLUMN IF NOT EXISTS "code" TEXT,
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "document" TEXT;

-- 8. Warehouse
CREATE TABLE IF NOT EXISTS public."Warehouse" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."Warehouse"
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "type" TEXT,
ADD COLUMN IF NOT EXISTS "code" TEXT;

-- 9. Location
CREATE TABLE IF NOT EXISTS public."Location" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."Location"
ADD COLUMN IF NOT EXISTS "warehouse_id" UUID,
ADD COLUMN IF NOT EXISTS "barcode" TEXT,
ADD COLUMN IF NOT EXISTS "rua" TEXT,
ADD COLUMN IF NOT EXISTS "modulo" TEXT,
ADD COLUMN IF NOT EXISTS "nivel" TEXT,
ADD COLUMN IF NOT EXISTS "posicao" TEXT,
ADD COLUMN IF NOT EXISTS "capacity" NUMERIC DEFAULT 0;

-- 10. Technician
CREATE TABLE IF NOT EXISTS public."Technician" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."Technician"
ADD COLUMN IF NOT EXISTS "code" TEXT,
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "email" TEXT,
ADD COLUMN IF NOT EXISTS "phone" TEXT,
ADD COLUMN IF NOT EXISTS "specialties" JSONB DEFAULT '[]';

-- 11. SystemConfiguration
CREATE TABLE IF NOT EXISTS public."SystemConfiguration" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."SystemConfiguration"
ADD COLUMN IF NOT EXISTS "key" TEXT,
ADD COLUMN IF NOT EXISTS "label" TEXT,
ADD COLUMN IF NOT EXISTS "value" TEXT,
ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'string',
ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'geral',
ADD COLUMN IF NOT EXISTS "description" TEXT;

-- 12. Product
CREATE TABLE IF NOT EXISTS public."Product" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."Product"
ADD COLUMN IF NOT EXISTS "sku" TEXT,
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "unit" TEXT,
ADD COLUMN IF NOT EXISTS "category" TEXT,
ADD COLUMN IF NOT EXISTS "min_stock" NUMERIC,
ADD COLUMN IF NOT EXISTS "max_stock" NUMERIC,
ADD COLUMN IF NOT EXISTS "cost_price" NUMERIC,
ADD COLUMN IF NOT EXISTS "sale_price" NUMERIC,
ADD COLUMN IF NOT EXISTS "cod_finame" TEXT;

-- 13. ProspectionProject
CREATE TABLE IF NOT EXISTS public."ProspectionProject" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."ProspectionProject"
ADD COLUMN IF NOT EXISTS "title" TEXT,
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "client_id" UUID,
ADD COLUMN IF NOT EXISTS "status" TEXT,
ADD COLUMN IF NOT EXISTS "start_date" DATE,
ADD COLUMN IF NOT EXISTS "end_date" DATE;

-- 14. ProspectionProjectItem
CREATE TABLE IF NOT EXISTS public."ProspectionProjectItem" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."ProspectionProjectItem"
ADD COLUMN IF NOT EXISTS "project_id" UUID,
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "qty" NUMERIC,
ADD COLUMN IF NOT EXISTS "status" TEXT;

-- 15. Resource
CREATE TABLE IF NOT EXISTS public."Resource" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."Resource"
ADD COLUMN IF NOT EXISTS "code" TEXT,
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "type" TEXT,
ADD COLUMN IF NOT EXISTS "capacity" NUMERIC;

-- 16. InventoryCount
CREATE TABLE IF NOT EXISTS public."InventoryCount" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."InventoryCount"
ADD COLUMN IF NOT EXISTS "count_number" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT,
ADD COLUMN IF NOT EXISTS "warehouse_id" UUID,
ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- 17. ReportTemplate
CREATE TABLE IF NOT EXISTS public."ReportTemplate" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."ReportTemplate"
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "type" TEXT,
ADD COLUMN IF NOT EXISTS "config" JSONB;

-- 18. AuditLog
CREATE TABLE IF NOT EXISTS public."AuditLog" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID,
    active BOOLEAN DEFAULT true
);
ALTER TABLE public."AuditLog"
ADD COLUMN IF NOT EXISTS "action" TEXT,
ADD COLUMN IF NOT EXISTS "entity_type" TEXT,
ADD COLUMN IF NOT EXISTS "entity_id" UUID,
ADD COLUMN IF NOT EXISTS "new_data" TEXT,
ADD COLUMN IF NOT EXISTS "user_email" TEXT,
ADD COLUMN IF NOT EXISTS "user_id" UUID,
ADD COLUMN IF NOT EXISTS "user_name" TEXT,
ADD COLUMN IF NOT EXISTS "ip_address" TEXT;

-- FINAL STEP: Reset Schema Cache
NOTIFY pgrst, 'reload schema';
