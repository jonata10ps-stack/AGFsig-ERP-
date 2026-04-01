import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { op_number, product_sku } = await req.json();

    if (!op_number || !product_sku) {
      return Response.json({ error: 'op_number e product_sku são obrigatórios' }, { status: 400 });
    }

    // Buscar a OP
    const ops = await base44.asServiceRole.entities.ProductionOrder.filter({ op_number });
    if (ops.length === 0) {
      return Response.json({ error: 'OP não encontrada' }, { status: 404 });
    }

    const op = ops[0];

    // Buscar produto
    const products = await base44.asServiceRole.entities.Product.filter({ company_id: op.company_id, sku: product_sku });
    if (products.length === 0) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    const product = products[0];

    // Buscar consumos duplicados para esta OP + produto
    const controls = await base44.asServiceRole.entities.OPConsumptionControl.filter({
      company_id: op.company_id,
      op_id: op.id,
      consumed_product_id: product.id
    });

    if (controls.length === 0) {
      return Response.json({ error: 'Nenhum consumo encontrado para esta OP e produto' }, { status: 404 });
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

    return Response.json({
      message: 'Consumos encontrados',
      data: summary,
      instructions: 'Use o painel para editar/remover consumos duplicados manualmente'
    });
  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});