-- Script para integrar Devoluções (Return) com Estoque e Números de Série
-- Execute este script no SQL Editor do Supabase

-- Adicionar campos de destino no cabeçalho da Devolução
ALTER TABLE public."Return"
ADD COLUMN IF NOT EXISTS "warehouse_id" UUID REFERENCES public."Warehouse"(id),
ADD COLUMN IF NOT EXISTS "location_id" UUID REFERENCES public."Location"(id);

-- Adicionar campo de Número de Série nos Itens da Devolução
ALTER TABLE public."ReturnItem"
ADD COLUMN IF NOT EXISTS "serial_number" TEXT;

-- Notificar o PostgREST para recarregar o esquema
NOTIFY pgrst, 'reload schema';
