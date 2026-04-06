import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { op_number, product_sku } = await req.json();

    if (!op_number || !product_sku) {
      return new Response(JSON.stringify({ error: 'op_number e product_sku são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar a OP
    const ops = await base44.asServiceRole.entities.ProductionOrder.filter({ op_number });
    if (ops.length === 0) {
      return new Response(JSON.stringify({ error: 'OP não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const op = ops[0];

    // Buscar produto
    const products = await base44.asServiceRole.entities.Product.filter({ company_id: op.company_id, sku: product_sku });
    if (products.length === 0) {
      return new Response(JSON.stringify({ error: 'Produto não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const product = products[0];

    // Buscar consumos duplicados para esta OP + produto
    const controls = await base44.asServiceRole.entities.OPConsumptionControl.filter({
      company_id: op.company_id,
      op_id: op.id,
      consumed_product_id: product.id
    });

    if (controls.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum consumo encontrado para esta OP e produto' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Registrar informações
    const summary = {
      op_number,
      product_sku,
      total_controls: controls.length,
      controls_details: controls.map(c => ({
        id: c.id,
        qty: c.qty,
        status: c.control_status,
        created_date: c.created_date
      }))
    };

    return new Response(JSON.stringify({
      message: 'Consumos encontrados',
      data: summary,
      instructions: 'Use o painel para editar/remover consumos duplicados manualmente'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});