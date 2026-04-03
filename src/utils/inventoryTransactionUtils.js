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
    const isOutgoing = ['SAIDA', 'PRODUCAO_CONSUMO', 'BAIXA', 'RESERVA', 'TRANSFERENCIA', 'SEPARACAO'].includes(type);
    
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
      
      // Se for SAIDA, verificamos se há saldo separado para este pedido (rastreabilidade)
      // Ou se há saldo disponível total. O motor deve ser flexível mas firme.
      if (type === 'SAIDA') {
        const canShip = (currentAvailable + currentSeparated) >= moveQty;
        if (!canShip) {
           throw new Error(`Saldo insuficiente para Expedição! Total: ${currentAvailable + currentSeparated}, Solicitado: ${moveQty}.`);
        }
      } else if (currentAvailable < moveQty) {
        throw new Error(`Saldo insuficiente! Disponível: ${currentAvailable}, Solicitado: ${moveQty}. Lançamento bloqueado.`);
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
      notes
    });

    // --- 3. ATUALIZAR SALDOS (StockBalance) ---
    
    // CASO A: Saída/Consumo (Apenas subtrai da origem)
    if (['PRODUCAO_CONSUMO', 'BAIXA'].includes(type)) {
      await updateStockBalance(companyId, product_id, from_warehouse_id, from_location_id, { available: -moveQty });
    }
    
    // CASO B: Entrada (Apenas soma no destino e atualiza custo médio)
    else if (type === 'ENTRADA') {
      await updateStockBalance(companyId, product_id, to_warehouse_id, to_location_id, { available: moveQty, cost: unit_cost });
    }
    
    // CASO C: Transferência (Subtrai da origem e soma no destino)
    else if (type === 'TRANSFERENCIA') {
      await updateStockBalance(companyId, product_id, from_warehouse_id, from_location_id, { available: -moveQty });
      await updateStockBalance(companyId, product_id, to_warehouse_id, to_location_id, { available: moveQty });
    }

    // CASO D: Separação (Transferência de Disponível entre Origem e Destino)
    else if (type === 'SEPARACAO') {
      await updateStockBalance(companyId, product_id, from_warehouse_id, from_location_id, { available: -moveQty });
      await updateStockBalance(companyId, product_id, to_warehouse_id, to_location_id, { available: moveQty });
    }

    // CASO D2: Desfazer Separação (Diferente do Estorno, o item FICA no destino como Disponível)
    else if (type === 'DESFAZER_SEPARACAO') {
      // Sem alteração de saldo, pois o item já está Disponível na Doca após o Picking inicial.
      // O estorno do contador do pedido é feito no componente Separation.jsx
    }

    // CASO E: Saída Final/Expedição (Sempre tira do Disponível da Doca/Local informado)
    else if (type === 'SAIDA') {
      await updateStockBalance(companyId, product_id, from_warehouse_id, from_location_id, { available: -moveQty });
    }

    // CASO F: Estorno (Soma no disponível do destino)
    else if (type === 'ESTORNO') {
      await updateStockBalance(companyId, product_id, from_warehouse_id, from_location_id, { available: moveQty });
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
  const moveCost = parseFloat(deltas.cost) || 0;

  const filter = {
    company_id: companyId,
    product_id: productId,
    warehouse_id: warehouseId,
    location_id: locationId || null
  };

  const balances = await base44.entities.StockBalance.filter(filter);

  if (balances.length > 0) {
    // Se for entrada (delta positivo), somamos no primeiro registro
    if (availableDelta >= 0 && separatedDelta >= 0) {
      const balance = balances[0];
      const currentQty = parseFloat(balance.qty_available) || 0;
      const currentSep = parseFloat(balance.qty_separated) || 0;
      const newQty = Math.round((currentQty + availableDelta) * 1000) / 1000;
      const newSep = Math.round((currentSep + separatedDelta) * 1000) / 1000;
      
      let avgCost = parseFloat(balance.avg_cost) || 0;
      if (availableDelta > 0 && moveCost > 0) {
        avgCost = ((currentQty * avgCost) + (availableDelta * moveCost)) / (currentQty + availableDelta);
      }

      await base44.entities.StockBalance.update(balance.id, {
        qty_available: String(newQty),
        qty_separated: String(newSep),
        avg_cost: String(avgCost),
        last_move_date: new Date().toISOString()
      });
    } 
    // Se for saída (delta negativo), podemos precisar limpar múltiplos registros se houver duplicatas legadas
    else {
      let remainingToDeductAvail = Math.abs(availableDelta);
      let remainingToDeductSep = Math.abs(separatedDelta);

      for (const bal of balances) {
        const curAvail = parseFloat(bal.qty_available) || 0;
        const curSep = parseFloat(bal.qty_separated) || 0;
        
        const deductAvail = Math.min(curAvail, remainingToDeductAvail);
        const deductSep = Math.min(curSep, remainingToDeductSep);
        
        if (deductAvail > 0 || deductSep > 0) {
          await base44.entities.StockBalance.update(bal.id, {
            qty_available: String(Math.max(0, curAvail - deductAvail)),
            qty_separated: String(Math.max(0, curSep - deductSep)),
            last_move_date: new Date().toISOString()
          });
          remainingToDeductAvail -= deductAvail;
          remainingToDeductSep -= deductSep;
        }
        
        if (remainingToDeductAvail <= 0 && remainingToDeductSep <= 0) break;
      }
    }
  } else {
    // Criar novo registro se não existir
    if (availableDelta < 0 || separatedDelta < 0) {
      throw new Error(`Tentativa de subtrair saldo de um local inexistente (Produto: ${productId}).`);
    }

    await base44.entities.StockBalance.create({
      company_id: companyId,
      product_id: productId,
      warehouse_id: warehouseId,
      location_id: locationId || null,
      qty_available: String(availableDelta),
      qty_separated: String(separatedDelta),
      qty_reserved: '0',
      avg_cost: String(moveCost),
      last_move_date: new Date().toISOString()
    });
  }
}
