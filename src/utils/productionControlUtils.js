/**
 * Utilitário Centralizado para Controle de Materiais de Ordens de Produção
 * 
 * Este arquivo unifica a lógica de atualização das tabelas:
 * - BOMDeliveryControl (Controle de entrega da BOM)
 * - OPConsumptionControl (Tabela de consumo auxiliar para rastreamento)
 * 
 * Usando apenas o schema correto (qty, component_id, op_id) e prevenindo erros 400.
 */

import { base44 } from '@/api/base44Client';

export async function processProductionOrderControls(moveData, companyId, inventoryMoveId = null) {
  if (moveData.related_type !== 'OP' || !moveData.related_id) {
    console.log('ℹ️ Movimento não relacionado a OP. Ignorando atualização de controles.');
    return;
  }

  const opId = moveData.related_id;
  const productId = moveData.product_id;
  const qtyInput = parseFloat(moveData.qty) || 0;

  // Detectar direção do movimento
  const isAdding = ['SAIDA', 'PRODUCAO_CONSUMO', 'BAIXA'].includes(moveData.type);
  const isSubtracting = ['ENTRADA', 'ESTORNO'].includes(moveData.type);

  if (!isAdding && !isSubtracting) {
    console.log('ℹ️ Tipo de movimento ignorado para controles de OP:', moveData.type);
    return;
  }

  const factor = isAdding ? 1 : -1;
  const delta = qtyInput * factor;

  console.log(`🔄 Atualizando Controles de OP (${moveData.type}):`, { opId, productId, delta });

  try {
    // 1. Atualizar BOMDeliveryControl
    const deliveryControls = await base44.entities.BOMDeliveryControl.filter({
      op_id: opId,
      component_id: productId
    });

    if (deliveryControls.length > 0) {
      for (const dc of deliveryControls) {
        const currentDelivered = parseFloat(dc.qty) || 0;
        const newDelivered = Math.max(0, currentDelivered + delta);
        const qtyPlanned = parseFloat(dc.qty_planned || dc.qty_required) || 0;

        await base44.entities.BOMDeliveryControl.update(dc.id, {
          qty: String(newDelivered),
          status: (qtyPlanned > 0 && newDelivered >= qtyPlanned) ? 'ENTREGUE' : 'ABERTO'
        });
      }
    } else if (isAdding) {
      // Criar como item EXTRA na BOM se não existir (apenas se for adição)
      const opData = await base44.entities.ProductionOrder.filter({ id: opId }).then(d => d?.[0]);
      if (opData) {
        await base44.entities.BOMDeliveryControl.create({
          company_id: companyId,
          op_id: opId,
          numero_op_externo: opData.numero_op_externo,
          product_id: opData.product_id,
          component_id: productId,
          qty: String(qtyInput),
          status: 'ENTREGUE'
        });
      }
    }

    // 2. Atualizar ou Criar OPConsumptionControl
    const consumptionControls = await base44.entities.OPConsumptionControl.filter({
      op_id: opId,
      consumed_product_id: productId
    });

    if (consumptionControls.length > 0) {
      const currentCons = parseFloat(consumptionControls[0].qty) || 0;
      const newCons = Math.max(0, currentCons + delta);
      await base44.entities.OPConsumptionControl.update(consumptionControls[0].id, {
        qty: String(newCons),
        inventory_move_id: inventoryMoveId || consumptionControls[0].inventory_move_id
      });
    } else if (isAdding) {
      const opData = await base44.entities.ProductionOrder.filter({ id: opId }).then(d => d?.[0]);
      const prodData = await base44.entities.Product.filter({ id: productId }).then(d => d?.[0]);
      
      if (opData && prodData) {
        await base44.entities.OPConsumptionControl.create({
          company_id: companyId,
          op_id: opId,
          op_number: opData.op_number,
          product_id: opData.product_id,
          product_name: opData.product_name,
          consumed_product_id: productId,
          consumed_product_name: prodData.name,
          consumed_product_sku: prodData.sku,
          qty: String(qtyInput),
          inventory_move_id: inventoryMoveId,
          control_status: 'ABERTO'
        });
      }
    }
  } catch (error) {
    console.error('❌ Erro ao processar controles de produção:', error);
    throw error;
  }
}
