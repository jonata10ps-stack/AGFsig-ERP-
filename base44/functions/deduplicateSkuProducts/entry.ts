import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const companyId = body.company_id || user.current_company_id || user.company_ids?.[0];
    if (!companyId) {
      return Response.json({ error: 'No company selected' }, { status: 400 });
    }

    // 1. Carrega todos os produtos
    const PAGE = 500;
    let allProducts = [];
    let skip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.Product.filter({ company_id: companyId }, 'sku', PAGE, skip);
      if (!page || page.length === 0) break;
      allProducts = allProducts.concat(page);
      if (page.length < PAGE) break;
      skip += PAGE;
      await new Promise(r => setTimeout(r, 200));
    }

    // 2. Agrupa por SKU
    const bySku = {};
    for (const p of allProducts) {
      const sku = p.sku?.trim().toUpperCase();
      if (!sku) continue;
      if (!bySku[sku]) bySku[sku] = [];
      bySku[sku].push(p);
    }

    // 3. Identifica duplicados
    const dupeSkus = Object.entries(bySku).filter(([, arr]) => arr.length > 1);
    let deletedCount = 0;

    // 4. Para cada SKU duplicado, remove os redundantes
    for (const [sku, products] of dupeSkus) {
      // Busca movimentações para cada produto
      const moveCounts = {};
      for (const p of products) {
        const moves = await base44.asServiceRole.entities.InventoryMove.filter({ company_id: companyId, product_id: p.id }, '', 1, 0);
        moveCounts[p.id] = moves?.length || 0;
        await new Promise(r => setTimeout(r, 300));
      }

      // Manter apenas aquele(s) com movimentação; excluir os sem
      const withMoves = products.filter(p => moveCounts[p.id] > 0);
      const withoutMoves = products.filter(p => moveCounts[p.id] === 0);

      // Se nenhum tem movimentação, manter o mais antigo
      let keepId;
      let deleteIds = [];
      
      if (withMoves.length > 0) {
        // Manter o com mais movimentações
        const sorted = withMoves.sort((a, b) => (moveCounts[b.id] || 0) - (moveCounts[a.id] || 0));
        keepId = sorted[0].id;
        // Deletar todos os sem movimentação + os demais com movimentação
        deleteIds = [...withoutMoves, ...sorted.slice(1)].map(p => p.id);
      } else {
        // Nenhum tem movimentação: manter o mais antigo
        const sorted = [...products].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        keepId = sorted[0].id;
        deleteIds = sorted.slice(1).map(p => p.id);
      }

      // Deleta os redundantes
      for (const id of deleteIds) {
        await base44.asServiceRole.entities.Product.delete(id);
        deletedCount++;
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return Response.json({
      success: true,
      totalDuplicateSkus: dupeSkus.length,
      totalProductsDeleted: deletedCount,
      message: `${deletedCount} produto(s) duplicado(s) removido(s) com sucesso. ${dupeSkus.length} SKU(s) processados.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});