import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Download, RefreshCw, PackageSearch } from 'lucide-react';
import { useCompanyId } from '@/components/useCompanyId';
import { toast } from 'sonner';

export default function StockPledgeQuery() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Real-time subscriptions: atualiza ao registrar movimentações, OPs ou entregas
  useEffect(() => {
    const unsub1 = base44.entities.StockBalance.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['stock-balances-all'] });
    });
    const unsub2 = base44.entities.ProductionOrder.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['open-ops-pledge'] });
    });
    const unsub3 = base44.entities.BOMDeliveryControl.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['delivery-controls-pledge'] });
    });
    const unsub4 = base44.entities.InventoryMove.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['stock-balances-all'] });
      queryClient.invalidateQueries({ queryKey: ['op-inventory-moves-pledge'] });
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [queryClient]);

  // Fetch open production orders
  const { data: openOPs = [], isLoading: loadingOPs } = useQuery({
    queryKey: ['open-ops-pledge', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ProductionOrder.filter({
        company_id: companyId,
        status: ['ABERTA', 'EM_ANDAMENTO', 'PAUSADA']
      }, '-created_at', 1000);
    },
    enabled: !!companyId
  });

  // Fetch ALL BOMs for the company to map product -> active version
  const { data: allBoms = [] } = useQuery({
    queryKey: ['all-boms-pledge', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.BOM.filter({ company_id: companyId }, null, 2000);
    },
    enabled: !!companyId
  });

  // Fetch BOMItems for relevant versions
  const { data: bomItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['bom-items-pledge', companyId, openOPs.length],
    queryFn: async () => {
      if (!companyId || openOPs.length === 0 || allBoms.length === 0) return [];

      // Mapear produto -> BOM ativa
      const productBOMMap = {};
      allBoms.forEach(bom => {
        // Aceita is_active ou active (fallback)
        const isActive = bom.is_active === true || bom.is_active === 'true' || bom.active === true;
        if (isActive && bom.current_version_id) {
          productBOMMap[bom.product_id] = bom;
        }
      });

      // Coletar versões únicas das OPs abertas
      const relevantVersionIds = new Set();
      openOPs.forEach(op => {
        const bom = productBOMMap[op.product_id];
        if (bom?.current_version_id) {
          relevantVersionIds.add(bom.current_version_id);
        }
      });

      if (relevantVersionIds.size === 0) return [];

      // Fetch itens de todas as versões relevantes
      const versionItemsMap = {};
      await Promise.all([...relevantVersionIds].map(async (versionId) => {
        try {
          const items = await base44.entities.BOMItem.filter({
            company_id: companyId,
            bom_version_id: versionId
          }, null, 1000);
          versionItemsMap[versionId] = items;
        } catch (e) {
          console.warn(`Erro ao buscar itens da versão ${versionId}:`, e);
          versionItemsMap[versionId] = [];
        }
      }));

      // Expandir: 1 entrada por item por OP
      const result = [];
      openOPs.forEach(op => {
        const bom = productBOMMap[op.product_id];
        if (!bom) return;
        const items = versionItemsMap[bom.current_version_id] || [];
        items.forEach(item => {
          result.push({
            ...item,
            op_id: op.id,
            op_number: op.op_number,
            op_status: op.status,
            op_qty_planned: Number(op.qty_planned || 0)
          });
        });
      });

      return result;
    },
    enabled: !!companyId && openOPs.length > 0 && allBoms.length > 0
  });

  // Fetch products for SKU/Name metadata
  const { data: products = [] } = useQuery({
    queryKey: ['products-pledge', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.Product.filter({ company_id: companyId }, null, 5000);
    },
    enabled: !!companyId,
  });

  // Fetch stock balances
  const { data: stockBalances = [], refetch: refetchBalances } = useQuery({
    queryKey: ['stock-balances-all', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const all = await base44.entities.StockBalance.filter({ company_id: companyId });
      const map = {};
      all.forEach(sb => {
        if (!map[sb.product_id]) {
          map[sb.product_id] = { product_id: sb.product_id, qty_available: 0, qty_reserved: 0 };
        }
        map[sb.product_id].qty_available += Number(sb.qty_available || 0);
        map[sb.product_id].qty_reserved += Number(sb.qty_reserved || 0);
      });
      return Object.values(map);
    },
    enabled: !!companyId,
  });

  // Fetch BOM delivery controls
  const { data: deliveryControls = [] } = useQuery({
    queryKey: ['delivery-controls-pledge', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      // Tabela costuma ser global ou compartimentada por company_id se presente
      try {
        return await base44.entities.BOMDeliveryControl.filter({}, '-created_at', 5000);
      } catch (e) {
        return [];
      }
    },
    enabled: !!companyId,
  });

  // Fetch reservations
  const { data: reservations = [] } = useQuery({
    queryKey: ['active-reservations-pledge', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.Reservation.filter({ company_id: companyId }, null, 5000);
    },
    enabled: !!companyId,
  });

  // Calculate pledge data
  const pledgeData = useMemo(() => {
    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });

    // Reservas de venda
    const reservationQtyMap = {};
    reservations
      .filter(r => r.status === 'RESERVADA' || r.status === 'SEPARADA')
      .forEach(r => {
        reservationQtyMap[r.product_id] = (reservationQtyMap[r.product_id] || 0) + Number(r.qty || 0);
      });

    const componentMap = {};

    bomItems.forEach(item => {
      const componentId = item.component_id;
      const product = productMap[componentId];
      if (!product) return;

      const totalRequired = Number(item.quantity || item.qty || 0) * Number(item.op_qty_planned || 0);
      
      const deliveredQty = deliveryControls
        .filter(dc => dc.op_id === item.op_id && (dc.component_id === componentId || dc.consumed_product_id === componentId))
        .reduce((sum, dc) => sum + (Number(dc.qty) || 0), 0);

      if (!componentMap[componentId]) {
        componentMap[componentId] = {
          component_id: componentId,
          component_sku: product.sku || item.component_sku,
          component_name: product.name || item.component_name || item.name,
          pledged_qty: 0,
          delivered_qty: 0,
        };
      }
      
      componentMap[componentId].pledged_qty += totalRequired;
      componentMap[componentId].delivered_qty += deliveredQty;
    });

    return Object.values(componentMap)
      .map(comp => {
        const stock = stockBalances.find(sb => sb.product_id === comp.component_id);
        const stockQty = Number(stock?.qty_available || 0);
        const reservedQty = reservationQtyMap[comp.component_id] || 0;
        
        // Disponível = Estoque - Reservas de Venda
        const available = stockQty - reservedQty;
        
        // Empenho Pendente = Empenho Total - O que já foi entregue para a OP
        const pendingPledge = Math.max(0, comp.pledged_qty - comp.delivered_qty);
        
        // Necessidade = O que falta para cobrir o empenho pendente
        const necessity = pendingPledge - available;

        return {
          ...comp,
          stock_qty: stockQty,
          reserved_qty: reservedQty,
          available_qty: Math.max(0, available),
          pending_pledge: pendingPledge,
          necessity: necessity,
          necessity_ok: necessity <= 0,
        };
      })
      .sort((a, b) => b.necessity - a.necessity);
  }, [bomItems, deliveryControls, stockBalances, products, reservations]);

  const filtered = useMemo(() => {
    return pledgeData.filter(item =>
      (item.component_sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.component_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [pledgeData, searchTerm]);

  const handleExport = () => {
    const csv = [
      ['SKU', 'Componente', 'Estoque', 'Reservado', 'Disponível', 'Empenho Total', 'Entregue', 'Empenho Pendente', 'Falta/Sobra (Necessidade)', 'Status'],
      ...filtered.map(item => [
        item.component_sku,
        item.component_name,
        item.stock_qty,
        item.reserved_qty,
        item.available_qty,
        item.pledged_qty,
        item.delivered_qty,
        item.pending_pledge,
        item.necessity,
        item.necessity_ok ? 'OK' : 'INSUFICIENTE'
      ])
    ];

    const csvContent = csv.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `empenho-estoque-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Arquivo exportado com sucesso');
  };

  if (!companyId) return <div className="p-8 text-center">Nenhuma empresa selecionada</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Consulta Empenho x Estoque</h1>
          <p className="text-slate-600 mt-1">Análise de componentes em BOMs de OPs abertas vs. estoque disponível</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetchBalances()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Saldos
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm" disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Itens em Processo Produtivo</CardTitle>
            <div className="relative w-64">
              <Input
                placeholder="Buscar por SKU ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-[120px]">SKU</TableHead>
                  <TableHead>Componente</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead className="text-right">Empenho</TableHead>
                  <TableHead className="text-right">Entregue</TableHead>
                  <TableHead className="text-right">Necessidade</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingOPs || loadingItems ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                        <span className="text-slate-500">Calculando empenho...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-slate-500 py-12">
                      <PackageSearch className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                      <p>Nenhum item com empenho encontrado para as OPs abertas.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.component_id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-mono text-xs font-semibold">{item.component_sku}</TableCell>
                      <TableCell className="max-w-[250px] truncate">{item.component_name}</TableCell>
                      <TableCell className="text-right">{item.stock_qty.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-amber-600">{item.reserved_qty.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium text-slate-900">{item.available_qty.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium text-blue-600">{item.pledged_qty.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-green-600">{item.delivered_qty.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-bold ${item.necessity > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {item.necessity > 0 ? item.necessity.toFixed(2) : '0.00'}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.necessity_ok ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none">OK</Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-none">INSUFICIENTE</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-slate-500">Total Estoque</div>
              <div className="text-2xl font-bold mt-1">{filtered.reduce((sum, i) => sum + i.stock_qty, 0).toFixed(0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-slate-500">Empenho Pendente</div>
              <div className="text-2xl font-bold mt-1 text-blue-600">{filtered.reduce((sum, i) => sum + i.pending_pledge, 0).toFixed(0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-slate-500">Total Disponível</div>
              <div className="text-2xl font-bold mt-1 text-emerald-600 font-mono">{filtered.reduce((sum, i) => sum + i.available_qty, 0).toFixed(0)}</div>
            </CardContent>
          </Card>
          <Card className={filtered.reduce((sum, i) => sum + (i.necessity > 0 ? i.necessity : 0), 0) > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-slate-600">Necessidade de Compra</div>
              <div className={`text-2xl font-bold mt-1 ${filtered.reduce((sum, i) => sum + (i.necessity > 0 ? i.necessity : 0), 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {filtered.reduce((sum, i) => sum + (i.necessity > 0 ? i.necessity : 0), 0).toFixed(0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}