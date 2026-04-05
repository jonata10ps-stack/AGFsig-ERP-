-- Script para corrigir as tabelas do módulo 'Minha Agenda'
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard/project/_/sql)

-- 1. Tabela de Visitas de Prospecção
CREATE TABLE IF NOT EXISTS public."ProspectionVisit" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID NOT NULL,
    active BOOLEAN DEFAULT true,
    visit_number TEXT,
    visit_date DATE NOT NULL,
    start_time TEXT,
    end_time TEXT,
    seller_id UUID,
    seller_name TEXT,
    client_id UUID,
    client_name TEXT,
    prospective_client_name TEXT,
    city TEXT,
    state TEXT,
    visit_type TEXT, -- Ex: 'PRESENCIAL', 'REUNIAO_ONLINE', 'ESTUDO_CASO'
    visit_report TEXT,
    proposal_sent BOOLEAN DEFAULT false,
    result TEXT, -- Ex: 'POSITIVO', 'NEGATIVO', 'NEUTRO', 'MUITO_POSITIVO'
    next_action TEXT,
    next_visit_date DATE,
    status TEXT DEFAULT 'PLANEJADA', -- Ex: 'PLANEJADA', 'REALIZADA', 'CANCELADA'
    notes TEXT,
    interested_products JSONB DEFAULT '[]',
    interested_products_names TEXT,
    created_by TEXT -- Email do usuário que criou
);

-- Habilitar RLS (opcional, mas recomendado)
ALTER TABLE public."ProspectionVisit" ENABLE ROW LEVEL SECURITY;

-- 2. Tabela de Registro de KM Diário
CREATE TABLE IF NOT EXISTS public."DailyVehicleLog" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID NOT NULL,
    active BOOLEAN DEFAULT true,
    log_date DATE NOT NULL,
    seller_id UUID,
    seller_name TEXT,
    km_start NUMERIC DEFAULT 0,
    km_end NUMERIC DEFAULT 0,
    is_company_vehicle BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'ABERTO', -- Ex: 'ABERTO', 'FECHADO'
    notes TEXT,
    created_by TEXT -- Email do usuário que criou
);

ALTER TABLE public."DailyVehicleLog" ENABLE ROW LEVEL SECURITY;

-- 3. Garantir que ProspectionProjectItem tenha as colunas necessárias
-- Se a tabela já existir, este comando apenas adicionará as colunas faltantes
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ProspectionProjectItem' AND column_name='seller_id') THEN
        ALTER TABLE public."ProspectionProjectItem" ADD COLUMN seller_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ProspectionProjectItem' AND column_name='seller_name') THEN
        ALTER TABLE public."ProspectionProjectItem" ADD COLUMN seller_name TEXT;
    END IF;
END $$;

-- Comentários para documentação
COMMENT ON TABLE public."ProspectionVisit" IS 'Registros de visitas de prospecção do módulo Minha Agenda';
COMMENT ON TABLE public."DailyVehicleLog" IS 'Registros diários de quilometragem de veículos';
