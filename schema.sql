-- Auto-generated Supabase Schema based on frontend entities inference

CREATE TABLE public."ServiceRequest" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "request_number" TEXT,
  "client_name" TEXT,
  "order_number" TEXT,
  "product_name" TEXT,
  "status" TEXT
);

CREATE TABLE public."ServiceOrder" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "os_number" TEXT,
  "request_id" UUID,
  "client_id" UUID,
  "client_name" TEXT,
  "product_id" UUID,
  "product_name" TEXT,
  "serial_number" TEXT,
  "type" TEXT,
  "priority" TEXT,
  "description" TEXT,
  "status" TEXT
);

CREATE TABLE public."ProductionOrder" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "status" TEXT,
  "nin" TEXT,
  "parent_op_id" UUID,
  "op_number" TEXT,
  "numero_op_externo" TEXT,
  "request_id" UUID,
  "product_id" UUID,
  "product_name" TEXT,
  "route_id" UUID,
  "route_name" TEXT,
  "qty_planned" NUMERIC,
  "qty_produced" NUMERIC,
  "qty_attended" NUMERIC,
  "priority" TEXT,
  "due_date" TIMESTAMP WITH TIME ZONE,
  "warehouse_id" UUID,
  "warehouse_name" TEXT,
  "location_id" UUID,
  "location_barcode" TEXT,
  "in" TEXT,
  "title" TEXT,
  "message" TEXT,
  "severity" TEXT
);

CREATE TABLE public."BOMDeliveryControl" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "op_id" UUID,
  "component_id" UUID,
  "status" TEXT
);

CREATE TABLE public."BOM" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "product_id" UUID,
  "product_sku" TEXT,
  "product_name" TEXT
);

CREATE TABLE public."BOMItem" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "bom_version_id" UUID,
  "bom_id" UUID,
  "component_id" UUID,
  "component_sku" TEXT,
  "component_name" TEXT,
  "quantity" NUMERIC,
  "sequence" TEXT,
  "unit" TEXT
);

CREATE TABLE public."ProductionRouteStep" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "route_id" UUID
);

CREATE TABLE public."Location" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "warehouse_id" UUID
);

CREATE TABLE public."StockBalance" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "product_id" UUID,
  "warehouse_id" UUID,
  "location_id" UUID,
  "qty_available" NUMERIC,
  "qty_reserved" NUMERIC,
  "qty_separated" NUMERIC,
  "avg_cost" NUMERIC,
  "product_sku" TEXT,
  "product_name" TEXT,
  "warehouse_name" TEXT,
  "qty" NUMERIC
);

CREATE TABLE public."InventoryMove" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "type" TEXT,
  "product_id" UUID,
  "qty" NUMERIC,
  "from_warehouse_id" UUID,
  "from_location_id" UUID,
  "related_type" TEXT,
  "related_id" UUID,
  "reason" TEXT,
  "unit_cost" NUMERIC,
  "to_warehouse_id" UUID,
  "to_location_id" UUID,
  "baixa_motivo" TEXT
);

CREATE TABLE public."OPConsumptionControl" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "op_id" UUID,
  "consumed_product_id" UUID,
  "op_number" TEXT,
  "numero_op_externo" TEXT,
  "product_id" UUID,
  "product_name" TEXT,
  "consumed_product_sku" TEXT,
  "consumed_product_name" TEXT,
  "qty" NUMERIC,
  "inventory_move_id" UUID,
  "op_status" TEXT,
  "control_status" TEXT,
  "notes" TEXT
);

CREATE TABLE public."Product" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "sku" TEXT,
  "name" TEXT,
  "unit" TEXT,
  "category" TEXT,
  "min_stock" TEXT,
  "max_stock" TEXT,
  "cost_price" NUMERIC,
  "sale_price" NUMERIC
);

CREATE TABLE public."ProductionRoute" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "product_id" UUID,
  "code" TEXT,
  "name" TEXT
);

CREATE TABLE public."BOMVersion" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "bom_id" UUID,
  "version_number" TEXT,
  "is_active" BOOLEAN,
  "effective_date" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public."Client" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public."Company" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public."ConfigurationHistory" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "config_id" UUID,
  "config_key" TEXT,
  "old_value" TEXT,
  "new_value" TEXT,
  "change_type" TEXT,
  "reason" TEXT,
  "version" TEXT,
  "test_id" UUID,
  "teste" TEXT
);

CREATE TABLE public."SystemConfiguration" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public."ConfigurationTest" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public."CostCenter" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "code" TEXT,
  "name" TEXT,
  "description" TEXT
);

CREATE TABLE public."Warehouse" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "type" TEXT,
  "code" TEXT
);

CREATE TABLE public."SalesOrder" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "numero_pedido_externo" TEXT,
  "client_id" UUID,
  "client_name" TEXT,
  "seller_id" UUID,
  "seller_name" TEXT,
  "payment_condition_id" UUID,
  "payment_condition_name" TEXT,
  "status" TEXT,
  "total_amount" NUMERIC,
  "delivery_date" TIMESTAMP WITH TIME ZONE,
  "notes" TEXT,
  "order_number" TEXT
);

CREATE TABLE public."AuditLog" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "action" TEXT,
  "entity_type" TEXT,
  "entity_id" UUID,
  "new_data" TEXT,
  "type" TEXT,
  "product" TEXT,
  "qty" NUMERIC,
  "from" TEXT,
  "to" TEXT,
  "related_type" TEXT,
  "related_id" UUID,
  "location" TEXT,
  "items_count" TEXT,
  "details" TEXT,
  "remaining" TEXT
);

CREATE TABLE public."Seller" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "email" TEXT,
  "name" TEXT,
  "code" TEXT
);

CREATE TABLE public."DailyVehicleLog" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "seller_id" UUID,
  "seller_name" TEXT,
  "status" TEXT
);

CREATE TABLE public."DashboardConfig" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "user_id" UUID,
  "widgets" TEXT
);

CREATE TABLE public."ReceivingItem" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "batch_id" UUID,
  "product_id" UUID,
  "product_sku" TEXT,
  "product_name" TEXT,
  "qty" NUMERIC,
  "unit_cost" NUMERIC,
  "warehouse_id" UUID,
  "warehouse_name" TEXT,
  "location_barcode" TEXT,
  "status" TEXT,
  "receiving_batch_id" UUID,
  "quantity_expected" NUMERIC,
  "quantity_received" NUMERIC
);

CREATE TABLE public."EngineeringProjectItem" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "project_id" UUID,
  "quantity" NUMERIC,
  "drawings" TEXT
);

CREATE TABLE public."EngineeringProject" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "estimated_hours" TEXT,
  "progress_percent" TEXT,
  "actual_hours" TEXT
);

CREATE TABLE public."EngineeringProjectUpdate" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "project_id" UUID
);

CREATE TABLE public."ProductionStep" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "op_id" UUID,
  "sequence" TEXT,
  "name" TEXT,
  "description" TEXT,
  "status" TEXT
);

CREATE TABLE public."Resource" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public."InventoryCount" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public."InventoryCountItem" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "count_id" UUID,
  "product_id" UUID,
  "product_sku" TEXT,
  "product_name" TEXT,
  "location_id" UUID,
  "location_barcode" TEXT,
  "qty_system" NUMERIC,
  "qty_counted" NUMERIC,
  "qty_divergence" NUMERIC,
  "status" TEXT,
  "stock_balance_id" UUID
);

CREATE TABLE public."MaterialRequest" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "request_number" TEXT,
  "status" TEXT,
  "description" TEXT,
  "requester" TEXT,
  "department" TEXT,
  "priority" TEXT,
  "notes" TEXT
);

CREATE TABLE public."MaterialRequestItem" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "request_id" UUID,
  "product_id" UUID,
  "product_sku" TEXT,
  "product_name" TEXT,
  "qty_requested" NUMERIC,
  "qty_received" NUMERIC,
  "qty_pending" NUMERIC,
  "notes" TEXT
);

CREATE TABLE public."ReceivingBatch" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "batch_number" TEXT,
  "reason" TEXT,
  "o" TEXT,
  "total_value" TEXT,
  "received_date" TIMESTAMP WITH TIME ZONE,
  "status" TEXT,
  "notes" TEXT
);

CREATE TABLE public."NonConformityReport" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "status" TEXT,
  "report_number" TEXT,
  "receiving_batch_id" UUID,
  "receiving_item_id" UUID,
  "product_id" UUID,
  "product_sku" TEXT,
  "product_name" TEXT,
  "quantity_expected" NUMERIC,
  "quantity_received" NUMERIC,
  "variance" TEXT,
  "variance_type" TEXT,
  "order_id" UUID,
  "order_number" TEXT,
  "action_type" TEXT,
  "description" TEXT
);

CREATE TABLE public."MaterialConsumption" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "op_id" UUID,
  "product_id" UUID,
  "product_sku" TEXT,
  "product_name" TEXT,
  "qty_consumed" NUMERIC,
  "warehouse_id" UUID,
  "location_id" UUID,
  "registered_by" TEXT,
  "registered_date" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public."PaymentCondition" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public."SalesOrderItem" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "order_id" UUID,
  "product_id" UUID,
  "product_sku" TEXT,
  "product_name" TEXT,
  "qty" NUMERIC,
  "unit_price" NUMERIC,
  "total_price" NUMERIC,
  "fulfill_mode" TEXT,
  "qty_reserved" NUMERIC,
  "qty_separated" NUMERIC
);

CREATE TABLE public."Reservation" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "order_id" UUID,
  "status" TEXT,
  "order_item_id" UUID,
  "product_id" UUID,
  "qty" NUMERIC,
  "warehouse_id" UUID,
  "location_id" UUID
);

CREATE TABLE public."ProductionRequest" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "origin_id" UUID,
  "origin_type" TEXT,
  "order_id" UUID,
  "order_number" TEXT,
  "product_id" UUID,
  "product_name" TEXT,
  "qty_requested" NUMERIC,
  "qty_fulfilled" NUMERIC,
  "qty_residue" NUMERIC,
  "priority" TEXT,
  "status" TEXT,
  "due_date" TIMESTAMP WITH TIME ZONE,
  "request_number" TEXT,
  "user_email" TEXT,
  "is_read" BOOLEAN
);

CREATE TABLE public."ProspectionVisit" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "visit_number" TEXT,
  "seller_name" TEXT,
  "interested_products" TEXT,
  "interested_products_names" TEXT,
  "vendedor" TEXT,
  "seller_id" UUID
);

CREATE TABLE public."Quote" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "quote_number" TEXT,
  "client_id" UUID,
  "client_name" TEXT,
  "client_document" TEXT,
  "seller_id" UUID,
  "seller_name" TEXT,
  "payment_condition_id" UUID,
  "payment_condition_name" TEXT,
  "validity_date" TIMESTAMP WITH TIME ZONE,
  "delivery_date" TIMESTAMP WITH TIME ZONE,
  "notes" TEXT,
  "status" TEXT,
  "total_amount" NUMERIC
);

CREATE TABLE public."ProspectionProjectItem" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public."User" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public."QuoteItem" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "quote_id" UUID,
  "product_id" UUID,
  "product_sku" TEXT,
  "product_name" TEXT,
  "qty" NUMERIC,
  "unit_price" NUMERIC,
  "base_total" TEXT,
  "subitems_total" TEXT,
  "final_total" TEXT,
  "line_sequence" TEXT
);

CREATE TABLE public."QuoteSubitem" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "total_price" NUMERIC,
  "line_sequence" TEXT
);

CREATE TABLE public."QuoteAttachment" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "quote_id" UUID,
  "file_name" TEXT,
  "file_type" TEXT,
  "description" TEXT
);

CREATE TABLE public."ReportTemplate" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public."GeneratedReport" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "template_id" UUID,
  "template_name" TEXT,
  "type" TEXT,
  "status" TEXT,
  "date_from" TIMESTAMP WITH TIME ZONE,
  "date_to" TIMESTAMP WITH TIME ZONE,
  "filters_applied" TEXT
);

CREATE TABLE public."Return" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public."ReturnItem" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "return_id" UUID
);

CREATE TABLE public."Notification" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "user_email" TEXT,
  "related_visit_id" UUID,
  "type" TEXT,
  "title" TEXT,
  "message" TEXT,
  "locale" TEXT
);

CREATE TABLE public."SerialNumber" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "product_sku" TEXT,
  "product_name" TEXT,
  "client_name" TEXT,
  "order_number" TEXT,
  "sale_date" TIMESTAMP WITH TIME ZONE,
  "status" TEXT,
  "warranty_expires" TEXT,
  "serial_number" TEXT,
  "product_id" UUID,
  "client_id" UUID,
  "order_id" UUID,
  "warranty_months" TEXT
);

CREATE TABLE public."Technician" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true
);

CREATE TABLE public."TechnicianHistory" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "service_order_id" UUID,
  "from_technician_id" UUID,
  "from_technician_name" TEXT,
  "to_technician_id" UUID,
  "to_technician_name" TEXT,
  "reason" TEXT,
  "changed_by" TEXT
);

CREATE TABLE public."UserInvite" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "email" TEXT,
  "full_name" TEXT,
  "modules" TEXT,
  "is_seller" BOOLEAN,
  "company_ids" TEXT,
  "status" TEXT,
  "invited_at" TEXT,
  "expires_at" TEXT,
  "invited_by" TEXT
);

CREATE TABLE public."ERPSync" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "entity_type" TEXT,
  "entity_id" UUID,
  "erp_id" UUID,
  "status" TEXT,
  "direction" TEXT,
  "last_sync" TEXT,
  "sync_count" TEXT,
  "data_snapshot" TEXT
);

CREATE TABLE public."ERPLog" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true,
  "action" TEXT,
  "entity_type" TEXT,
  "entity_id" UUID,
  "direction" TEXT,
  "status" TEXT,
  "duration_ms" TEXT,
  "details" TEXT,
  "provider" TEXT,
  "error_message" TEXT
);

CREATE TABLE public."SalesAppointment" (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_id UUID,
  active BOOLEAN DEFAULT true
);

