import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { relatedId } = await req.json();

    if (!relatedId) {
      return Response.json({ error: 'relatedId is required' }, { status: 400 });
    }

    // Buscar movimento de inventário relacionado a COMPRA #69a9f2e8
    const movements = await base44.entities.InventoryMove.filter({
      company_id: user.company_id,
      related_type: 'COMPRA',
      related_id: relatedId
    });

    console.log('Movimentos encontrados:', movements.length);

    if (movements.length === 0) {
      return Response.json({ error: 'Nenhum movimento encontrado para esse documento' }, { status: 404 });
    }

    // Filtrar movimento que é do STR06 e está como TRANSFERENCIA
    const str06Movement = movements.find(m => 
      m.type === 'TRANSFERENCIA' && 
      (m.related_id === relatedId)
    );

    if (!str06Movement) {
      return Response.json({ error: 'Movimento TRANSFERENCIA não encontrado' }, { status: 404 });
    }

    console.log('Movimento encontrado:', str06Movement);
    console.log('Atualizando para ENTRADA...');

    // Atualizar movimento de TRANSFERENCIA para ENTRADA
    await base44.entities.InventoryMove.update(str06Movement.id, {
      type: 'ENTRADA',
      from_warehouse_id: null,
      from_location_id: null,
      reason: `Recebimento/Alocação - ${str06Movement.reason}`
    });

    console.log('Movimento corrigido com sucesso');

    return Response.json({
      success: true,
      message: 'Movimento corrigido de TRANSFERENCIA para ENTRADA',
      movementId: str06Movement.id,
      movementDetails: {
        product_id: str06Movement.product_id,
        qty: str06Movement.qty,
        to_warehouse_id: str06Movement.to_warehouse_id,
        to_location_id: str06Movement.to_location_id
      }
    });
  } catch (error) {
    console.error('Erro ao corrigir movimento:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});