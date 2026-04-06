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

  // Subscrições para atualização em tempo real
  useEffect(() => {
    const unsub1 = base44.entities.StockBalance.subscribe(() => queryClient.invalidateQueries({ queryKey: ['stock-balances-all'] }));
    const unsub2 = base44.entities.ProductionOrder.subscribe(() => queryClient.invalidateQueries({ queryKey: ['open-ops-pledge'] }));
    const unsub3 = base44.entities.BOMDeliveryControl.subscribe(() => queryClient.invalidateQueries({ queryKey: ['delivery-controls-pledge'] }));
    const unsub4 = base44.entities.InventoryMove.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['stock-balances-all'] });
      queryClient.invalidateQueries({ queryKey: ['op-inventory-moves-pledge'] });
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [queryClient]);

  // Busca OPs abertas (Expandido para incluir planejadas que o usuário pode considerar "abertas")
  const { data: openOPs = [], isLoading: loadingOPs } = useQuery({
    queryKey: ['open-ops-pledge', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ProductionOrder.filter({
        company_id: companyId,
        status: ['ABERTA', 'EM_ANDAMENTO', 'PAUSADA', 'PLANEJADA', 'SUSPENSA']
      }, '-created_at', 5000);
    },
    enabled: !!companyId,
    staleTime: 30000
  });

  // Busca todas as BOMs para mapear Produto -> Versão Ativa
  const { data: allBoms = [] } = useQuery({
    queryKey: ['all-boms-pledge', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        // Tentar buscar todas as BOMs da empresa. Se houver mais de 5000, usar listAll
        return await base44.entities.BOM.filter({ company_id: companyId }, null, 5000);
      } catch (e) {
        return [];
      }
    },
    enabled: !!companyId,
    staleTime: 60000
  });

  // Busca todos os itens das versões relevantes em uma única chamada (Batch)
  const { data: bomItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['bom-items-pledge', companyId, openOPs.length, allBoms.length],
    queryFn: async () => {
      if (!companyId || openOPs.length === 0 || allBoms.length === 0) return [];

      // Mapear produto -> BOM ativa
      // Guardamos tanto por product_id quanto por product_sku para maior robustez
      const productBOMMap = new Map();
      const skuBOMMap = new Map();

      allBoms.forEach(bom => {
        // Mais flexível na detecção de BOM ativa
        const isActive = bom.is_active === true || 
                         String(bom.is_active).toLowerCase() === 'true' || 
                         bom.active === true ||
                         String(bom.is_active) === '1' ||
                         (bom.is_active === undefined && bom.current_version_id); // Se indefinido mas tem versão, considerar ativo

        if (isActive && bom.current_version_id) {
          if (bom.product_id) productBOMMap.set(bom.product_id, bom);
          if (bom.product_sku) skuBOMMap.set(bom.product_sku, bom);
        }
      });

      // Coletar IDs de versões únicas necessárias
      const relevantVersionIds = new Set();
      openOPs.forEach(op => {
        const bom = productBOMMap.get(op.product_id) || skuBOMMap.get(op.product_sku);
        if (bom?.current_version_id) relevantVersionIds.add(bom.current_version_id);
      });

      if (relevantVersionIds.size === 0) return [];

      // Fetch batch de itens usando listAll para garantir que pegamos todos se houver muitos
      const versionIdArray = Array.from(relevantVersionIds);
      const allItems = await base44.entities.BOMItem.listAll({
        bom_version_id: versionIdArray
      });

      // Agrupar itens por versão para expansão rápida
      const itemsByVersion = new Map();
      allItems.forEach(item => {
        if (!itemsByVersion.has(item.bom_version_id)) itemsByVersion.set(item.bom_version_id, []);
        itemsByVersion.get(item.bom_version_id).push(item);
      });

      // Expandir: 1 entrada por componente por OP
      const result = [];
      openOPs.forEach(op => {
        const bom = productBOMMap.get(op.product_id) || skuBOMMap.get(op.product_sku);
        if (!bom) return;
        
        const items = itemsByVersion.get(bom.current_version_id) || [];
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
    enabled: !!companyId && openOPs.length > 0 && allBoms.length > 0,
    staleTime: 30000
  });


  // Busca produtos para metadados (SKU/Nome)
  const { data: products = [] } = useQuery({
    queryKey: ['products-pledge', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        // Usar listAll para garantir cobertura total de SKUs de componentes
        return await base44.entities.Product.listAll({ company_id: companyId });
      } catch (e) {
        console.warn('Erro ao buscar produtos para empenho:', e);
        return [];
      }
    },
    enabled: !!companyId,
    staleTime: 300000 // Cache longo
  });

  // Busca saldos de estoque (pré-agrupados por produto na query se possível, mas aqui fazemos no JS)
  const { data: stockBalances = new Map(), refetch: refetchBalances, isLoading: loadingBalances } = useQuery({
    queryKey: ['stock-balances-all', companyId],
    queryFn: async () => {
      if (!companyId) return new Map();
      // Usar listAll para garantir que pegamos TODOS os saldos se a empresa tiver muitos itens
      const all = await base44.entities.StockBalance.listAll({ company_id: companyId });
      const map = new Map();
      all.forEach(sb => {
        const productId = sb.product_id;
        if (!productId) return;
        const existing = map.get(productId) || { qty_available: 0, qty_reserved: 0 };
        map.set(productId, {
          qty_available: existing.qty_available + Number(sb.qty_available || 0),
          qty_reserved: existing.qty_reserved + Number(sb.qty_reserved || 0)
        });
      });
      return map;
    },
    enabled: !!companyId,
    staleTime: 30000
  });

  // Busca controles de entrega (BOMDeliveryControl)
  const { data: deliveryControls = [] } = useQuery({
    queryKey: ['delivery-controls-pledge', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        // Tabela costuma ser volumosa, usar listAll mas filtrar o máximo possível
        // Nota: se a tabela tiver company_id, passamos. Se não tiver, o SDK ignora (sanitiza)
        return await base44.entities.BOMDeliveryControl.listAll({ company_id: companyId });
      } catch (e) {
        console.warn('Erro ao buscar delivery-controls:', e);
        return [];
      }
    },
    enabled: !!companyId,
    staleTime: 15000
  });

  // Busca reservas
  const { data: reservations = [] } = useQuery({
    queryKey: ['active-reservations-pledge', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.Reservation.filter({ company_id: companyId }, null, 5000);
    },
    enabled: !!companyId,
    staleTime: 30000
  });

  // Cálculos pesados otimizados para O(N)
  const pledgeData = useMemo(() => {
    if (!products.length || !bomItems.length) return [];

    const productMap = new Map();
    products.forEach(p => productMap.set(p.id, p));

    // Pré-calcular Reservas por produto
    const reservationQtyMap = new Map();
    reservations.filter(r => r.status === 'RESERVADA' || r.status === 'SEPARADA').forEach(r => {
      reservationQtyMap.set(r.product_id, (reservationQtyMap.get(r.product_id) || 0) + Number(r.qty || 0));
    });

    // Pré-agrupar Entregas (BOMDeliveryControl) por OP + Produto para acesso instantâneo
    const deliveryQtyMap = new Map();
    deliveryControls.forEach(dc => {
      const prodId = dc.component_id || dc.consumed_product_id || dc.product_id;
      const key = `${dc.op_id}_${prodId}`;
      deliveryQtyMap.set(key, (deliveryQtyMap.get(key) || 0) + Number(dc.qty || 0));
    });

    const componentSummary = new Map();

    bomItems.forEach(item => {
      const componentId = item.component_id;
      const product = productMap.get(componentId);
      if (!product) return;

      const totalRequired = Number(item.quantity || item.qty || 0) * Number(item.op_qty_planned || 0);
      const deliveredQty = deliveryQtyMap.get(`${item.op_id}_${componentId}`) || 0;

      const existing = componentSummary.get(componentId) || {
        component_id: componentId,
        component_sku: product.sku || item.component_sku,
        component_name: product.name || item.component_name || item.name,
        pledged_qty: 0,
        delivered_qty: 0,
      };
      
      existing.pledged_qty += totalRequired;
      existing.delivered_qty += deliveredQty;
      componentSummary.set(componentId, existing);
    });

    return Array.from(componentSummary.values())
      .map(comp => {
        const stock = stockBalances instanceof Map ? stockBalances.get(comp.component_id) : null;
        const stockQty = Number(stock?.qty_available || 0);
        const reservedQty = reservationQtyMap.get(comp.component_id) || 0;
        
        const available = stockQty - reservedQty;
        const pendingPledge = Math.max(0, comp.pledged_qty - comp.delivered_qty);
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
      ['SKU', 'Componente', 'Estoque', 'Reservado', 'Disponível', 'Empenho Total', 'Entregue', 'Empenho Pendente', 'Falta/Sobra', 'Status'],
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

  if (!companyId) return <div className="p-8 text-center bg-slate-50 min-h-[400px] flex items-center justify-center">Nenhuma empresa selecionada</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Consulta Empenho x Estoque</h1>
          <p className="text-slate-500 mt-1 font-medium italic">Análise otimizada de balanço de materiais</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetchBalances()} variant="outline" size="sm" className="bg-white shadow-sm hover:bg-slate-50 transition-all border-slate-200">
            <RefreshCw className="h-4 w-4 mr-2" />
            Recalcular Saldos
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm" disabled={filtered.length === 0} className="bg-white shadow-sm hover:bg-slate-50 transition-all border-slate-200">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-md">
        <CardHeader className="pb-3 border-b bg-slate-50/10">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              Itens em Processo Produtivo
              <Badge variant="outline" className="bg-white text-slate-500 border-slate-200">{filtered.length} itens</Badge>
            </CardTitle>
            <div className="relative w-72">
              <Input
                placeholder="SKU ou nome do componente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-8 bg-white border-slate-200 shadow-sm focus-visible:ring-slate-300"
              />
              <PackageSearch className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="w-[140px] font-bold">SKU</TableHead>
                  <TableHead className="font-bold">Componente</TableHead>
                  <TableHead className="text-right font-bold w-[100px]">Estoque</TableHead>
                  <TableHead className="text-right font-bold w-[100px]">Reservado</TableHead>
                  <TableHead className="text-right font-bold w-[110px]">Disponível</TableHead>
                  <TableHead className="text-right font-bold w-[100px] text-blue-700">Empenho</TableHead>
                  <TableHead className="text-right font-bold w-[100px] text-emerald-700">Entregue</TableHead>
                  <TableHead className="text-right font-bold w-[110px]">Falta/Sobra</TableHead>
                  <TableHead className="text-center font-bold w-[130px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingOPs || loadingItems ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
                        <span className="text-slate-500 font-medium font-mono text-sm tracking-widest uppercase">Processando Estruturas...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-slate-400 py-20">
                      <div className="max-w-xs mx-auto flex flex-col items-center gap-2">
                        <PackageSearch className="h-12 w-12 text-slate-200" />
                        <p className="font-medium text-slate-500 uppercase text-xs tracking-tighter">Nenhum empenho pendente ou dados insuficientes</p>
                        <p className="text-[10px] italic">Certifique-se de que as OPs têm BOMs ativas em suas versões atuais.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.component_id} className="group hover:bg-slate-50/80 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-slate-600">{item.component_sku}</TableCell>
                      <TableCell>
                        <div className="truncate max-w-[300px] font-medium text-slate-700" title={item.component_name}>
                          {item.component_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{item.stock_qty.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm text-amber-600/80 font-medium">-{item.reserved_qty.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold text-slate-800 bg-slate-50/30">{item.available_qty.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600 group-hover:scale-105 transition-transform">{item.pledged_qty.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{item.delivered_qty.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-black ${item.necessity > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                        {item.necessity > 0 ? `+${item.necessity.toFixed(2)}` : 'Sobra'}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.necessity_ok ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200 shadow-none font-bold uppercase text-[10px]">Cuberto</Badge>
                        ) : (
                          <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50 border-rose-200 shadow-none font-bold uppercase text-[10px] animate-pulse">Insuficiente</Badge>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-slate-400 shadow-sm">
            <CardContent className="pt-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Unidades em Estoque</div>
              <div className="text-2xl font-black mt-2 text-slate-800">{filtered.reduce((sum, i) => sum + i.stock_qty, 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="pt-6">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-500">Empenho Pendente Total</div>
              <div className="text-2xl font-black mt-2 text-blue-700">{filtered.reduce((sum, i) => sum + i.pending_pledge, 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <CardContent className="pt-6">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-500">Saldo Disponível Geral</div>
              <div className="text-2xl font-black mt-2 text-emerald-700 font-mono">{filtered.reduce((sum, i) => sum + i.available_qty, 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className={`border-l-4 shadow-sm ${filtered.reduce((sum, i) => sum + (i.necessity > 0 ? i.necessity : 0), 0) > 0 ? 'border-l-rose-500 bg-rose-50/10' : 'border-l-emerald-500 bg-emerald-50/10'}`}>
            <CardContent className="pt-6">
              <div className="text-xs font-bold uppercase tracking-wider text-rose-500">Necessidade de Aquisição</div>
              <div className={`text-2xl font-black mt-2 ${filtered.reduce((sum, i) => sum + (i.necessity > 0 ? i.necessity : 0), 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {filtered.reduce((sum, i) => sum + (i.necessity > 0 ? i.necessity : 0), 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
