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

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { relatedId } = await req.json().catch(() => ({}));

    if (!relatedId) {
      return new Response(JSON.stringify({ error: 'relatedId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar movimento de inventário relacionado a COMPRA #69a9f2e8
    const movements = await base44.entities.InventoryMove.filter({
      company_id: user.company_id,
      related_type: 'COMPRA',
      related_id: relatedId
    });

    if (movements.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum movimento encontrado para esse documento' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Filtrar movimento que é do STR06 e está como TRANSFERENCIA
    const str06Movement = movements.find(m => 
      m.type === 'TRANSFERENCIA' && 
      (m.related_id === relatedId)
    );

    if (!str06Movement) {
      return new Response(JSON.stringify({ error: 'Movimento TRANSFERENCIA não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Atualizar movimento de TRANSFERENCIA para ENTRADA
    await base44.entities.InventoryMove.update(str06Movement.id, {
      type: 'ENTRADA',
      from_warehouse_id: null,
      from_location_id: null,
      reason: `Recebimento/Alocação - ${str06Movement.reason}`
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Movimento corrigido de TRANSFERENCIA para ENTRADA',
      movementId: str06Movement.id,
      movementDetails: {
        product_id: str06Movement.product_id,
        qty: str06Movement.qty,
        to_warehouse_id: str06Movement.to_warehouse_id,
        to_location_id: str06Movement.to_location_id
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Erro ao corrigir movimento:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});