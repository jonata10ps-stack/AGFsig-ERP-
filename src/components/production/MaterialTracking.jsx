import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, TrendingDown, Package, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MaterialTracking({ opId, opNumber }) {
  const { data: moves, isLoading } = useQuery({
    queryKey: ['inventory-moves-op', opId],
    queryFn: async () => {
      const allMoves = await base44.entities.InventoryMove.list();
      return allMoves.filter(m => m.related_type === 'OP' && m.related_id === opId);
    },
    enabled: !!opId,
  });

  // Buscar entregas de BOM
  const { data: bomDeliveries = [] } = useQuery({
    queryKey: ['bom-deliveries-op', opId],
    queryFn: () => base44.entities.BOMDeliveryControl.filter({ op_id: opId }),
    enabled: !!opId,
  });

  // Buscar produtos para pegar SKU e descrição
  const { data: products = {} } = useQuery({
    queryKey: ['products-op-details', moves?.map(m => m.product_id)],
    queryFn: async () => {
      if (!moves || moves.length === 0) return {};
      const productIds = [...new Set(moves.map(m => m.product_id))];
      const prods = await Promise.all(
        productIds.map(id => base44.entities.Product.filter({ id }))
      );
      const map = {};
      prods.forEach(p => {
        if (p?.[0]) map[p[0].id] = p[0];
      });
      return map;
    },
    enabled: !!moves && moves.length > 0,
  });

  // Agrupar movimentos por tipo
  const transferedMaterials = moves?.filter(m => m.type === 'TRANSFERENCIA') || [];
  const consumedMaterials = moves?.filter(m => 
    m.type === 'PRODUCAO_CONSUMO' || 
    m.type === 'CONSUMO_OP' || 
    m.type === 'SAIDA'
  ) || [];
  const producedMaterials = moves?.filter(m => m.type === 'PRODUCAO_ENTRADA') || [];

  // Adicionar entregas de BOM aos materiais transferidos
  const deliveredMaterials = bomDeliveries
    .filter(bd => (Number(bd.qty) || 0) > 0)
    .map(bd => ({
      product_id: bd.component_id,
      product_name: bd.component_name || bd.product_name || 'Componente BOM',
      product_sku: bd.component_sku || bd.product_sku || '-',
      qty: Number(bd.qty) || 0,
      type: 'BOM_DELIVERY',
      created_date: bd.updated_date || bd.created_date || new Date().toISOString()
    }));

  // Consolidar quantidade transferida por produto (incluindo entregas de BOM)
  const allTransfers = [...transferedMaterials, ...deliveredMaterials];
  
  const consolidatedTransfers = allTransfers.reduce((acc, move) => {
    const existing = acc.find(m => m.product_id === move.product_id);
    const product = products[move.product_id];
    if (existing) {
      existing.qty += move.qty;
      existing.moves.push(move);
    } else {
      acc.push({
        product_id: move.product_id,
        product_name: move.product_name || product?.name || move.product_id,
        product_sku: move.product_sku || product?.sku || '-',
        qty: move.qty,
        moves: [move]
      });
    }
    return acc;
  }, []);

  const consolidatedConsumed = consumedMaterials.reduce((acc, move) => {
    const existing = acc.find(m => m.product_id === move.product_id);
    const product = products[move.product_id];
    if (existing) {
      existing.qty += move.qty;
    } else {
      acc.push({
        product_id: move.product_id,
        product_name: move.product_name || product?.name || move.product_id,
        product_sku: product?.sku || '-',
        qty: move.qty
      });
    }
    return acc;
  }, []);

  const consolidatedProduced = producedMaterials.reduce((acc, move) => {
    const existing = acc.find(m => m.product_id === move.product_id);
    const product = products[move.product_id];
    if (existing) {
      existing.qty += move.qty;
    } else {
      acc.push({
        product_id: move.product_id,
        product_name: move.product_name || product?.name || move.product_id,
        product_sku: product?.sku || '-',
        qty: move.qty
      });
    }
    return acc;
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Materiais Transferidos */}
      {consolidatedTransfers.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Package className="h-5 w-5" />
              Materiais Transferidos para a OP
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {consolidatedTransfers.map((material) => (
                <div key={material.product_id} className="border rounded-lg p-3 bg-blue-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{material.product_name}</p>
                          <Badge variant="outline" className="text-xs">{material.product_sku}</Badge>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          {material.moves.length} movimentação(ões)
                        </p>
                      </div>
                    <Badge className="bg-blue-100 text-blue-800">
                      {material.qty} un
                    </Badge>
                  </div>
                  
                  {/* Expandir movimentos */}
                  <div className="mt-3 pt-3 border-t border-blue-200 text-xs space-y-1">
                    {material.moves.map((move, idx) => (
                      <div key={idx} className="flex justify-between text-slate-600">
                        <span>
                          {move.type === 'BOM_DELIVERY' ? 'Entrega BOM' : 
                           move.from_warehouse_id ? `De: ${move.from_warehouse_id}${move.to_warehouse_id ? ` → ${move.to_warehouse_id}` : ''}` : 
                           'Movimentação manual'}
                        </span>
                        <span className="font-mono">{move.qty} un</span>
                        <span className="text-slate-400">
                          {format(new Date(move.created_date), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Materiais Consumidos */}
      {consolidatedConsumed.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="bg-amber-50">
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <TrendingDown className="h-5 w-5" />
              Consumo de Componentes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {consolidatedConsumed.map((material) => {
                const transferred = consolidatedTransfers.find(t => t.product_id === material.product_id);
                const remaining = (transferred?.qty || 0) - material.qty;
                const percentageUsed = transferred ? (material.qty / transferred.qty * 100).toFixed(0) : 0;

                return (
                  <div key={material.product_id} className="border rounded-lg p-3 bg-amber-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{material.product_name}</p>
                          <Badge variant="outline" className="text-xs">{material.product_sku}</Badge>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          Consumido: {material.qty} de {transferred?.qty || '?'} un
                        </p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800">
                        {percentageUsed}% consumido
                      </Badge>
                    </div>

                    {/* Barra de progresso */}
                    <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentageUsed}%` }}
                      />
                    </div>

                    {/* Resumo */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-white rounded px-2 py-1">
                        <p className="text-slate-500">Transferido</p>
                        <p className="font-bold text-blue-600">{transferred?.qty || 0}</p>
                      </div>
                      <div className="bg-white rounded px-2 py-1">
                        <p className="text-slate-500">Consumido</p>
                        <p className="font-bold text-amber-600">{material.qty}</p>
                      </div>
                      <div className={`rounded px-2 py-1 ${remaining === 0 ? 'bg-emerald-100' : 'bg-white'}`}>
                        <p className="text-slate-500">Restante</p>
                        <p className={`font-bold ${remaining === 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                          {remaining}
                        </p>
                      </div>
                    </div>

                    {remaining === 0 && (
                      <div className="mt-2 p-2 bg-emerald-100 border border-emerald-300 rounded text-xs text-emerald-700 flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Saldo zerado - Componente consumido por completo
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Produto Produzido */}
      {consolidatedProduced.length > 0 && (
        <Card className="border-emerald-200">
          <CardHeader className="bg-emerald-50">
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <Zap className="h-5 w-5" />
              Produto Produzido
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {consolidatedProduced.map((material) => (
                <div key={material.product_id} className="flex justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{material.product_name}</p>
                      <Badge variant="outline" className="text-xs">{material.product_sku}</Badge>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800">
                    {material.qty} un
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nenhum movimento */}
      {consolidatedTransfers.length === 0 && consolidatedConsumed.length === 0 && consolidatedProduced.length === 0 && (
        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhuma movimentação registrada nesta OP</p>
              <p className="text-xs text-slate-400 mt-2">
                Movimentos de transferência e consumo aparecerão aqui automaticamente
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}