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
  // SAIDA/PRODUCAO_CONSUMO: Aumenta o total entregue/consumido
  // ENTRADA/ESTORNO/PRODUCAO_REVERSO: Diminui o total entregue/consumido
  const isAdding = ['SAIDA', 'PRODUCAO_CONSUMO', 'BAIXA'].includes(moveData.type);
  const isSubtracting = ['ENTRADA', 'ESTORNO', 'PRODUCAO_REVERSO'].includes(moveData.type);

  if (!isAdding && !isSubtracting) {
    console.log('ℹ️ Tipo de movimento ignorado para controles de OP:', moveData.type);
    return;
  }

  const factor = isAdding ? 1 : -1;
  const delta = qtyInput * factor;

  console.log(`🔄 Atualizando Controles de OP (${moveData.type}):`, { opId, productId, delta });

  try {
    // 1. Atualizar BOMDeliveryControl
    // Omitimos company_id pois alguns registros legados da base44 podem estar com valor null (criados via ProductionOrders)
    const deliveryControls = await base44.entities.BOMDeliveryControl.filter({
      op_id: opId,
      component_id: productId
    });

    if (deliveryControls.length > 0) {
      let remainingDeltaDelivery = delta;
      for (const dc of deliveryControls) {
        if (remainingDeltaDelivery === 0) break;
        
        const currentDelivered = parseFloat(dc.qty) || 0;
        const qtyPlanned = parseFloat(dc.qty_planned || dc.qty_required) || 0;

        if (isSubtracting) {
          const amountToSubtract = Math.min(currentDelivered, Math.abs(remainingDeltaDelivery));
          const newDelivered = currentDelivered - amountToSubtract;
          remainingDeltaDelivery += amountToSubtract;

          if (newDelivered <= 0) {
            await base44.entities.BOMDeliveryControl.delete(dc.id);
          } else {
            await base44.entities.BOMDeliveryControl.update(dc.id, {
              qty: String(newDelivered),
              status: (qtyPlanned > 0 && newDelivered >= qtyPlanned) ? 'ENTREGUE' : 'ABERTO'
            });
          }
        } else {
          const newDelivered = currentDelivered + remainingDeltaDelivery;
          await base44.entities.BOMDeliveryControl.update(dc.id, {
            qty: String(newDelivered),
            status: (qtyPlanned > 0 && newDelivered >= qtyPlanned) ? 'ENTREGUE' : 'ABERTO'
          });
          remainingDeltaDelivery = 0;
        }
      }
    } else if (isAdding) {
      // Criar como item EXTRA na BOM se não existir (apenas se for adição)
      const opData = await base44.entities.ProductionOrder.filter({ company_id: companyId, id: opId }).then(d => d?.[0]);
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
      company_id: companyId,
      op_id: opId,
      consumed_product_id: productId
    });

    if (consumptionControls.length > 0) {
      let remainingDeltaCons = delta;
      for (const cc of consumptionControls) {
        if (remainingDeltaCons === 0) break;

        const currentCons = parseFloat(cc.qty) || 0;

        if (isSubtracting) {
          const amountToSubtract = Math.min(currentCons, Math.abs(remainingDeltaCons));
          const newCons = currentCons - amountToSubtract;
          remainingDeltaCons += amountToSubtract;

          if (newCons <= 0) {
            await base44.entities.OPConsumptionControl.delete(cc.id);
          } else {
            await base44.entities.OPConsumptionControl.update(cc.id, {
              qty: String(newCons),
              inventory_move_id: inventoryMoveId || cc.inventory_move_id
            });
          }
        } else {
          const newCons = currentCons + remainingDeltaCons;
          await base44.entities.OPConsumptionControl.update(cc.id, {
            qty: String(newCons),
            inventory_move_id: inventoryMoveId || cc.inventory_move_id
          });
          remainingDeltaCons = 0;
        }
      }
    } else if (isAdding) {
      const opData = await base44.entities.ProductionOrder.filter({ company_id: companyId, id: opId }).then(d => d?.[0]);
      const prodData = await base44.entities.Product.filter({ company_id: companyId, id: productId }).then(d => d?.[0]);
      
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

    // 3. Sincronizar MaterialConsumption (rastreabilidade manual legada)
    const materialConsumptions = await base44.entities.MaterialConsumption.filter({
      company_id: companyId,
      op_id: opId,
      product_id: productId
    });

    if (materialConsumptions.length > 0) {
      // Ordena pelos mais antigos (opcional) ou atualiza o primeiro. Aqui vamos reduzir o total:
      let remainingDelta = delta;
      for (const mc of materialConsumptions) {
        if (remainingDelta === 0) break;
        const currentMC = parseFloat(mc.qty_consumed) || 0;
        
        if (isSubtracting) { // delta is negative
          const amountToSubtract = Math.min(currentMC, Math.abs(remainingDelta));
          const newMC = currentMC - amountToSubtract;
          remainingDelta += amountToSubtract; // brings remainingDelta closer to 0
          
          if (newMC <= 0) {
            await base44.entities.MaterialConsumption.delete(mc.id);
          } else {
            await base44.entities.MaterialConsumption.update(mc.id, { qty_consumed: String(newMC) });
          }
        } else { // delta is positive
          const newMC = currentMC + remainingDelta;
          await base44.entities.MaterialConsumption.update(mc.id, { qty_consumed: String(newMC) });
          remainingDelta = 0;
        }
      }
    }
  } catch (error) {
    console.error('❌ Erro ao processar controles de produção:', error);
    throw error;
  }
}
