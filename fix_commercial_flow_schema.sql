-- Script de migração para colunas do fluxo comercial integrado

-- 1. ProspectionVisit: vínculo com projeto
ALTER TABLE "ProspectionVisit" ADD COLUMN IF NOT EXISTS project_id text;

-- 2. ProspectionProjectItem: vínculo com visita, orçamento e pedido de venda
ALTER TABLE "ProspectionProjectItem" ADD COLUMN IF NOT EXISTS visit_id text;
ALTER TABLE "ProspectionProjectItem" ADD COLUMN IF NOT EXISTS quote_id text;
ALTER TABLE "ProspectionProjectItem" ADD COLUMN IF NOT EXISTS sales_order_id text;

-- 3. Quote: vínculo com projeto e visita
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS visit_id text;

-- 4. SalesOrder: vínculo com projeto e visita
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS visit_id text;
