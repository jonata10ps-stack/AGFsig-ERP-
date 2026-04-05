-- Sincronização Unificada de Schema - AGFsig ERP
-- Execute este script no SQL Editor do Supabase para garantir que todas as colunas necessárias existam.

-- 1. Tabela Return (Devoluções)
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE "Return" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PENDENTE';
        ALTER TABLE "Return" ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMPTZ;
        ALTER TABLE "Return" ADD COLUMN IF NOT EXISTS "warehouse_id" UUID REFERENCES "Warehouse"(id);
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Erro ao atualizar tabela Return: %', SQLERRM;
    END;
END $$;

-- 2. Tabela ReturnItem (Itens da Devolução)
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE "ReturnItem" ADD COLUMN IF NOT EXISTS "serial_number" TEXT;
        ALTER TABLE "ReturnItem" ADD COLUMN IF NOT EXISTS "condition" TEXT DEFAULT 'NOVO';
        ALTER TABLE "ReturnItem" ADD COLUMN IF NOT EXISTS "unit_price" DECIMAL(12,2) DEFAULT 0;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Erro ao atualizar tabela ReturnItem: %', SQLERRM;
    END;
END $$;

-- 3. Tabela ServiceOrder (Ordens de Serviço)
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "technician_id" UUID REFERENCES "Technician"(id);
        ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "labor_hours" TEXT;
        ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "labor_cost" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "parts_cost" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "total_cost" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "scheduled_date" DATE;
        ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Erro ao atualizar tabela ServiceOrder: %', SQLERRM;
    END;
END $$;

-- 4. Tabela StockBalance (Garantir IDs de Armazém e Localização)
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE "StockBalance" ADD COLUMN IF NOT EXISTS "warehouse_id" UUID REFERENCES "Warehouse"(id);
        ALTER TABLE "StockBalance" ADD COLUMN IF NOT EXISTS "location_id" UUID REFERENCES "Location"(id);
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Erro ao atualizar tabela StockBalance: %', SQLERRM;
    END;
END $$;
