/**
 * Utilitário Centralizado para Transações de Estoque
 * 
 * Este arquivo garante:
 * 1. Travamento de saldo negativo em saídas/transferências.
 * 2. Consistência entre Kardex (InventoryMove) e Saldo (StockBalance).
 * 3. Cálculo de custo médio em entradas.
 * 4. Unificação de tipos de dados (sempre usando Number/parseFloat).
 */

import { base44 } from '@/api/base44Client';

/**
 * Executa uma transação de estoque completa
 * @param {Object} moveData - Dados do movimento (type, product_id, qty, warehouse_id, etc)
 * @param {string} companyId - ID da empresa
 * @returns {Promise<Object>} - O movimento criado
 */
export async function executeInventoryTransaction(moveData, companyId) {
  const { 
    type, 
    product_id, 
    qty, 
    from_warehouse_id, 
    from_location_id,
    to_warehouse_id,
    to_location_id,
    unit_cost = 0,
    related_type = null,
    related_id = null,
    reason = '',
    notes = ''
  } = moveData;

  const moveQty = parseFloat(qty) || 0;
  if (moveQty <= 0) throw new Error('Quantidade deve ser maior que zero.');

  console.log(`📦 Iniciando Transação de Estoque (${type}):`, { product_id, moveQty });

  try {
    // --- 1. VALIDAÇÃO DE SALDO NEGATIVO (Para SAIDA, TRANSFERENCIA, CONSUMO, etc) ---
    // PRODUCAO_REVERSO é uma ENTRADA (devolução de material), NÃO deve estar aqui
    const isOutgoing = ['SAIDA', 'PRODUCAO_CONSUMO', 'BAIXA', 'RESERVA', 'TRANSFERENCIA', 'SEPARACAO'].includes(type);
    
    // Para PRODUCAO_REVERSO: é sempre uma ENTRADA (devolução), ignora validação de saída.
    if (isOutgoing) {
      const sourceBalances = await base44.entities.StockBalance.filter({
        company_id: companyId,
        product_id: product_id,
        warehouse_id: from_warehouse_id,
        location_id: from_location_id || null
      });

      const balance = sourceBalances[0];
      const currentAvailable = balance ? parseFloat(balance.qty_available) || 0 : 0;
      const currentSeparated = balance ? parseFloat(balance.qty_separated) || 0 : 0;
      const currentReserved = balance ? parseFloat(balance.qty_reserved) || 0 : 0;
      const physicalTotal = currentAvailable + currentReserved;
      
      // Se for SAIDA, verificamos se há saldo separado para este pedido (rastreabilidade)
      // Ou se há saldo disponível total. O motor deve ser flexível mas firme.
      if (type === 'SAIDA') {
        const canShip = (physicalTotal + currentSeparated) >= moveQty;
        if (!canShip) {
           throw new Error(`Saldo insuficiente para Expedição! Total: ${physicalTotal + currentSeparated}, Solicitado: ${moveQty}.`);
        }
      } else if (type !== 'PRODUCAO_REVERSO' && physicalTotal < moveQty) {
        throw new Error(`Saldo insuficiente! Físico (Disponível + Reservado): ${physicalTotal}, Solicitado: ${moveQty}. Lançamento bloqueado.`);
      }
    }

    // --- 2. CRIAR O REGISTRO NO KARDEX (InventoryMove) ---
    const move = await base44.entities.InventoryMove.create({
      company_id: companyId,
      type,
      product_id,
      qty: String(moveQty),
      unit_cost: String(unit_cost),
      from_warehouse_id,
      from_location_id,
      to_warehouse_id,
      to_location_id,
      related_type,
      related_id,
      reason,
      notes,
      created_date: new Date().toISOString()
    });

    // --- 3. ATUALIZAR SALDOS (StockBalance) ---
    
    // Função auxiliar para abater saldo (primeiro do disponível, depois do reservado)
    const deductStock = async (whId, locId, qty) => {
       const sourceBalances = await base44.entities.StockBalance.filter({
         company_id: companyId,
         product_id: product_id,
         warehouse_id: whId,
         location_id: locId || null
       });
       const bal = sourceBalances[0];
       const curAvail = bal ? parseFloat(bal.qty_available) || 0 : 0;
       const deductFromAvail = Math.min(curAvail, qty);
       const deductFromRes = Math.max(0, qty - deductFromAvail);

       await updateStockBalance(companyId, product_id, whId, locId, { 
         available: -deductFromAvail,
         reserved: -deductFromRes
       });

       // Se consumiu reserva, tentar limpar o registro de Reservation para este pedido/processo se existir
       if (deductFromRes > 0 && related_id) {
         try {
           const reservations = await base44.entities.Reservation.filter({
             order_id: related_id,
             product_id: product_id,
             location_id: locId || null
           });
           for (const res of reservations) {
             const resQty = parseFloat(res.qty) || 0;
             if (resQty <= deductFromRes) {
               await base44.entities.Reservation.delete(res.id);
             } else {
               await base44.entities.Reservation.update(res.id, { qty: String(resQty - deductFromRes) });
             }
           }
         } catch (e) {
           console.warn('Falha ao limpar reserva durante baixa:', e);
         }
       }
    };

    // CASO A: Saída/Consumo (Apenas subtrai da origem)
    if (['PRODUCAO_CONSUMO', 'BAIXA'].includes(type)) {
      await deductStock(from_warehouse_id, from_location_id, moveQty);
    }
    
    // CASO B: Entrada / Produção Encerrada (Apenas soma no destino e atualiza custo médio)
    else if (['ENTRADA', 'PRODUCAO_ENTRADA', 'PRODUCAO_REVERSO'].includes(type)) {
      await updateStockBalance(companyId, product_id, to_warehouse_id, to_location_id, { available: moveQty, cost: unit_cost });
    }
    
    // CASO C: Transferência (Subtrai da origem e soma no destino)
    else if (type === 'TRANSFERENCIA') {
      await deductStock(from_warehouse_id, from_location_id, moveQty);
      await updateStockBalance(companyId, product_id, to_warehouse_id, to_location_id, { available: moveQty });
    }

    // CASO D: Separação (Transferência entre Origem e Destino, consumindo reserva se necessário)
    else if (type === 'SEPARACAO') {
      await deductStock(from_warehouse_id, from_location_id, moveQty);
      await updateStockBalance(companyId, product_id, to_warehouse_id, to_location_id, { available: moveQty });
    }

    // CASO D2: Desfazer Separação (Diferente do Estorno, o item FICA no destino como Disponível)
    else if (type === 'DESFAZER_SEPARACAO') {
      // Sem alteração de saldo, pois o item já está Disponível na Doca após o Picking inicial.
    }

    // CASO E: Saída Final/Expedição (Sempre tira da origem informada - Geralmente Doca)
    else if (type === 'SAIDA') {
      await deductStock(from_warehouse_id, from_location_id, moveQty);
    }

    // CASO F: Estorno (Soma no disponível do destino)
    else if (type === 'ESTORNO') {
      await updateStockBalance(companyId, product_id, to_warehouse_id, to_location_id, { available: moveQty });
    }

    return move;
  } catch (error) {
    console.error('❌ Erro na transação de estoque:', error);
    throw error;
  }
}

/**
 * Helper para atualizar ou criar registro de saldo
 */
async function updateStockBalance(companyId, productId, warehouseId, locationId, deltas) {
  const availableDelta = parseFloat(deltas.available) || 0;
  const separatedDelta = parseFloat(deltas.separated) || 0;
  const reservedDelta = parseFloat(deltas.reserved) || 0;
  const moveCost = parseFloat(deltas.cost) || 0;

  const filter = {
    company_id: companyId,
    product_id: productId,
    warehouse_id: warehouseId
  };

  // Se houver locationId, filtramos por ele. Se for null/undefined, não passamos no filtro 
  // do base44 (pois o filter do base44 pode não lidar bem com null explícito em alguns casos)
  // ou lidamos com o fato de que pode haver registros com location_id vazio.
  const balances = await base44.entities.StockBalance.filter(filter);
  
  // Refinar localmente para garantir matching exato de location_id (null vs undefined vs '')
  const matchingBalances = balances.filter(b => {
    const bLoc = b.location_id || null;
    const targetLoc = locationId || null;
    return bLoc === targetLoc;
  });

  if (matchingBalances.length > 0) {
    // Se for entrada (delta positivo), somamos no primeiro registro
    if (availableDelta >= 0 && separatedDelta >= 0 && reservedDelta >= 0) {
      const balance = matchingBalances[0];
      const currentQty = parseFloat(balance.qty_available) || 0;
      const currentSep = parseFloat(balance.qty_separated) || 0;
      const currentRes = parseFloat(balance.qty_reserved) || 0;

      const newQty = Math.round((currentQty + availableDelta) * 1000) / 1000;
      const newSep = Math.round((currentSep + separatedDelta) * 1000) / 1000;
      const newRes = Math.round((currentRes + reservedDelta) * 1000) / 1000;
      
      let avgCost = parseFloat(balance.avg_cost) || 0;
      if (availableDelta > 0 && moveCost > 0) {
        avgCost = ((currentQty * avgCost) + (availableDelta * moveCost)) / (currentQty + availableDelta);
      }

      await base44.entities.StockBalance.update(balance.id, {
        qty_available: String(newQty),
        qty_separated: String(newSep),
        qty_reserved: String(newRes),
        avg_cost: String(avgCost),
        last_move_date: new Date().toISOString()
      });
    } 
    // Se for saída (delta negativo)
    else {
      let remainingToDeductAvail = Math.abs(availableDelta);
      let remainingToDeductSep = Math.abs(separatedDelta);
      let remainingToDeductRes = Math.abs(reservedDelta);

      for (const bal of matchingBalances) {
        const curAvail = parseFloat(bal.qty_available) || 0;
        const curSep = parseFloat(bal.qty_separated) || 0;
        const curRes = parseFloat(bal.qty_reserved) || 0;
        
        const deductAvail = Math.min(curAvail, remainingToDeductAvail);
        const deductSep = Math.min(curSep, remainingToDeductSep);
        const deductRes = Math.min(curRes, remainingToDeductRes);
        
        if (deductAvail > 0 || deductSep > 0 || deductRes > 0) {
          await base44.entities.StockBalance.update(bal.id, {
            qty_available: String(Math.max(0, curAvail - deductAvail)),
            qty_separated: String(Math.max(0, curSep - deductSep)),
            qty_reserved: String(Math.max(0, curRes - deductRes)),
            last_move_date: new Date().toISOString()
          });
          remainingToDeductAvail -= deductAvail;
          remainingToDeductSep -= deductSep;
          remainingToDeductRes -= deductRes;
        }
        
        if (remainingToDeductAvail <= 0 && remainingToDeductSep <= 0 && remainingToDeductRes <= 0) break;
      }
    }
  } else {
    // Criar novo registro se não existir
    if (availableDelta < 0 || separatedDelta < 0 || reservedDelta < 0) {
      throw new Error(`Tentativa de subtrair saldo de um local inexistente (Produto: ${productId}).`);
    }

    await base44.entities.StockBalance.create({
      company_id: companyId,
      product_id: productId,
      warehouse_id: warehouseId,
      location_id: locationId || null,
      qty_available: String(availableDelta),
      qty_separated: String(separatedDelta),
      qty_reserved: String(reservedDelta),
      avg_cost: String(moveCost),
      last_move_date: new Date().toISOString()
    });
  }
}
