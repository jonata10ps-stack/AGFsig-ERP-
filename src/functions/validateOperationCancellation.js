/**
 * Mocks das funções de validação de produção que antes residiam na nuvem Base44.
 * Agora essas funções são locais e podem ser customizadas conforme a necessidade do ERP.
 */

/**
 * Valida se uma Ordem de Produção pode ser cancelada.
 * @param {Object} params - { opId, companyId }
 * @returns {Promise<{ canCancel: boolean, message?: string }>}
 */
export async function validateProductionOrderCancellation({ opId, companyId }) {
  console.log(`[Mock] Validando cancelamento da OP ${opId} para empresa ${companyId}`);
  
  // Por padrão, permite o cancelamento. 
  // Futuramente, você pode adicionar lógicas como check de estoque ou integração com TOTVS.
  return {
    canCancel: true
  };
}

/**
 * Valida se uma Ordem de Produção pode ser encerrada.
 * @param {Object} params - { opId, companyId, orders }
 * @returns {Promise<{ canClose: boolean, message?: string }>}
 */
export async function validateProductionOrderClose({ opId, companyId, orders }) {
  console.log(`[Mock] Validando encerramento da OP ${opId}`);

  // Mock de sucesso. 
  // No código original, isso checava se sub-operações estavam abertas ou se o BOM foi entregue.
  return {
    canClose: true
  };
}
