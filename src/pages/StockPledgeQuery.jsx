import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Download, RefreshCw } from 'lucide-react';
import { useCompanyId } from '@/components/useCompanyId';
import { toast } from 'sonner';

export default function StockPledgeQuery() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Real-time subscriptions: atualiza ao movimentar estoque, abrir OP ou entregar BOM
  useEffect(() => {
    const unsub1 = base44.entities.StockBalance.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['stock-balances-all'] });
    });
    const unsub2 = base44.entities.ProductionOrder.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['open-ops'] });
    });
    const unsub3 = base44.entities.BOMDeliveryControl.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['delivery-controls'] });
    });
    const unsub4 = base44.entities.InventoryMove.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['stock-balances-all'] });
      queryClient.invalidateQueries({ queryKey: ['op-inventory-moves-pledge'] });
    });
    const unsub5 = base44.entities.Product.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['products-ids'] });
    });
    const unsub6 = base44.entities.Reservation.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['active-reservations-pledge'] });
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); };
  }, [queryClient]);

  // Fetch open production orders
  const { data: openOPs = [] } = useQuery({
    queryKey: ['open-ops', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ProductionOrder.filter({
        company_id: companyId,
        status: { $in: ['ABERTA', 'EM_ANDAMENTO', 'PAUSADA'] }
      });
    },
    enabled: !!companyId
  });

  // Fetch ALL BOMs for the company (1 call), then all BOMItems for relevant versions (N unique versions)
  const { data: allBOMs = [] } = useQuery({
    queryKey: ['all-boms', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.BOM.filter({ company_id: companyId }, null, 5000);
    },
    enabled: !!companyId
  });

  const { data: bomItems = [] } = useQuery({
    queryKey: ['bom-items-for-pledge', companyId, openOPs.map(op => op.id).sort().join(',')],
    queryFn: async () => {
      if (!companyId || openOPs.length === 0 || allBOMs.length === 0) return [];

      // Build map: product_id -> active BOM
      const productBOMMap = {};
      allBOMs.forEach(bom => {
        if (bom.active !== false && bom.current_version_id) {
          productBOMMap[bom.product_id] = bom;
        }
      });

      // Collect unique BOM version IDs needed by open OPs
      const relevantVersionIds = new Set();
      openOPs.forEach(op => {
        const bom = productBOMMap[op.product_id];
        if (bom) relevantVersionIds.add(bom.current_version_id);
      });

      if (relevantVersionIds.size === 0) return [];

      // Fetch BOMItems for each unique version (much fewer calls than 1 per OP)
      const versionItemsMap = {};
      await Promise.all([...relevantVersionIds].map(async (versionId) => {
        const items = await base44.entities.BOMItem.filter({
          company_id: companyId,
          bom_version_id: versionId
        }, null, 2000);
        versionItemsMap[versionId] = items;
      }));

      // Expand: 1 entry per OP per BOM item
      const result = [];
      openOPs.forEach(op => {
        if (!op.product_id) return;
        const bom = productBOMMap[op.product_id];
        if (!bom) return;
        const items = versionItemsMap[bom.current_version_id] || [];
        items.forEach(item => {
          result.push({
            ...item,
            op_id: op.id,
            op_number: op.op_number,
            op_status: op.status,
            product_name: op.product_name,
            qty_planned: op.qty_planned
          });
        });
      });

      return result;
    },
    enabled: !!companyId && openOPs.length > 0 && allBOMs.length > 0
  });

  // Fetch products to validate component existence
  const { data: products = [] } = useQuery({
    queryKey: ['products-ids', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.Product.filter({ company_id: companyId }, null, 5000);
    },
    enabled: !!companyId,
  });

  // Fetch stock balances — soma todos os saldos de todas as localizações por produto
  const { data: stockBalances = [], refetch: refetchBalances } = useQuery({
    queryKey: ['stock-balances-all', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const all = await base44.entities.StockBalance.filter({ company_id: companyId }, '-updated_date', 5000);
      const map = {};
      all.forEach(sb => {
        if (!map[sb.product_id]) {
          map[sb.product_id] = { product_id: sb.product_id, qty_available: 0, qty_reserved: 0 };
        }
        map[sb.product_id].qty_available += sb.qty_available || 0;
        map[sb.product_id].qty_reserved += sb.qty_reserved || 0;
      });
      return Object.values(map);
    },
    enabled: !!companyId,
  });

  // Fetch ALL BOM delivery controls (including ENTREGUE) to know what was already delivered
  const { data: deliveryControls = [] } = useQuery({
    queryKey: ['delivery-controls', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.BOMDeliveryControl.filter({ company_id: companyId }, '-created_date', 5000);
    },
    enabled: !!companyId,
  });

  // Fetch reservations (filtrar no cliente por status ativo)
  const { data: allReservations = [] } = useQuery({
    queryKey: ['active-reservations-pledge', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.Reservation.filter({ company_id: companyId }, null, 5000);
    },
    enabled: !!companyId,
  });

  // Fetch inventory moves de SAIDA/PRODUCAO_CONSUMO vinculados a OPs
  const { data: opInventoryMoves = [] } = useQuery({
    queryKey: ['op-inventory-moves-pledge', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const moves = await base44.entities.InventoryMove.filter({ company_id: companyId, related_type: 'OP' }, null, 5000);
      return moves.filter(m => m.type === 'SAIDA' || m.type === 'PRODUCAO_CONSUMO');
    },
    enabled: !!companyId,
  });

  // Calculate pledge data
  const pledgeData = useMemo(() => {
    const validProductIds = new Set(products.map(p => p.id));

    // Reservas ativas de pedidos de venda
    const reservationQtyMap = {};
    allReservations
      .filter(r => r.status === 'RESERVADA' || r.status === 'SEPARADA')
      .forEach(r => {
        reservationQtyMap[r.product_id] = (reservationQtyMap[r.product_id] || 0) + (r.qty || 0);
      });

    const componentMap = {};

    bomItems.forEach(item => {
      const key = item.component_id;

      // EMPENHO = total do BOM (fixo, independente de entrega)
      const totalRequired = (item.quantity || 0) * (item.qty_planned || 1);

      // ENTREGUE = BOMDeliveryControl.qty_delivered para essa OP+componente
      const deliveredByBOM = deliveryControls
        .filter(dc => dc.op_id === item.op_id && dc.component_id === item.component_id)
        .reduce((sum, dc) => sum + (dc.qty_delivered || 0), 0);

      // ENTREGUE += InventoryMoves SAIDA/PRODUCAO_CONSUMO vinculados à OP para esse produto
      const deliveredByMove = opInventoryMoves
        .filter(m => m.related_id === item.op_id && m.product_id === item.component_id)
        .reduce((sum, m) => sum + (m.qty || 0), 0);

      const deliveredQty = deliveredByBOM + deliveredByMove;

      if (!componentMap[key]) {
        componentMap[key] = {
          component_id: item.component_id,
          component_sku: item.component_sku,
          component_name: item.component_name,
          pledged_qty: 0,   // empenho total do BOM
          delivered_qty: 0, // já entregue para as OPs
          ops: []
        };
      }
      componentMap[key].pledged_qty += totalRequired;
      componentMap[key].delivered_qty += deliveredQty;
      componentMap[key].ops.push({
        op_id: item.op_id,
        op_number: item.op_number,
        op_status: item.op_status,
        qty_required: totalRequired,
        qty_delivered: deliveredQty,
      });
    });

    return Object.values(componentMap)
      .filter(comp => validProductIds.has(comp.component_id))
      .map(comp => {
        const stock = stockBalances.find(sb => sb.product_id === comp.component_id);
        const stockQty = stock?.qty_available || 0;

        // Reservado: soma das Reservations ativas (RESERVADA + SEPARADA)
        const reservedQty = reservationQtyMap[comp.component_id] || 0;

        const available = stockQty - reservedQty;

        // Necessidade = Empenho - Disponível + Entregue
        const necessity = comp.pledged_qty - available + comp.delivered_qty;

        return {
          ...comp,
          stock_qty: stockQty,
          reserved_qty: reservedQty,
          available_qty: Math.max(0, available),
          necessity: necessity,
          necessity_ok: necessity <= 0,
        };
      });
  }, [bomItems, deliveryControls, opInventoryMoves, stockBalances, products, allReservations]);

  // Filter by search
  const filtered = useMemo(() => {
    return pledgeData.filter(item =>
      item.component_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.component_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [pledgeData, searchTerm]);

  const handleExport = () => {
    const csv = [
      ['SKU', 'Componente', 'Estoque', 'Reservado', 'Disponível', 'Empenho', 'Entregue', 'Necessidade', 'Status'],
      ...filtered.map(item => [
        item.component_sku,
        item.component_name,
        item.stock_qty,
        item.reserved_qty,
        item.available_qty,
        item.pledged_qty,
        item.delivered_qty,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Consulta Empenho x Estoque</h1>
        <p className="text-slate-600 mt-2">Análise de componentes em BOMs de OPs abertas vs. estoque disponível</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Itens Empenados</CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => refetchBalances()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button onClick={handleExport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              placeholder="Buscar por SKU ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>SKU</TableHead>
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
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-slate-500 py-8">
                      Nenhum item encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                   filtered.map((item) => (
                     <TableRow key={item.component_id} className="hover:bg-slate-50">
                       <TableCell className="font-mono text-sm">{item.component_sku}</TableCell>
                       <TableCell>{item.component_name}</TableCell>
                       <TableCell className="text-right font-semibold">{item.stock_qty.toFixed(2)}</TableCell>
                       <TableCell className="text-right text-amber-600">{item.reserved_qty.toFixed(2)}</TableCell>
                       <TableCell className="text-right font-semibold text-blue-600">{item.available_qty.toFixed(2)}</TableCell>
                       <TableCell className="text-right font-semibold text-red-600">{item.pledged_qty.toFixed(2)}</TableCell>
                       <TableCell className="text-right font-semibold text-green-600">{item.delivered_qty.toFixed(2)}</TableCell>
                       <TableCell className={`text-right font-semibold ${item.necessity_ok ? 'text-green-600' : 'text-red-600'}`}>
                         {item.necessity.toFixed(2)}
                       </TableCell>
                       <TableCell className="text-center">
                         {item.necessity_ok ? (
                           <Badge className="bg-green-100 text-green-800">OK</Badge>
                         ) : (
                           <div className="flex items-center justify-center gap-1">
                             <AlertCircle className="h-4 w-4 text-red-500" />
                             <Badge className="bg-red-100 text-red-800">Insuficiente</Badge>
                           </div>
                         )}
                       </TableCell>
                     </TableRow>
                   ))
                 )}
              </TableBody>
            </Table>
          </div>

          {filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4 border-t">
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="text-sm text-slate-600">Total Estoque</div>
                <div className="text-2xl font-bold">{filtered.reduce((sum, i) => sum + i.stock_qty, 0).toFixed(2)}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="text-sm text-slate-600">Total Empenho</div>
                <div className="text-2xl font-bold text-red-600">{filtered.reduce((sum, i) => sum + i.pledged_qty, 0).toFixed(2)}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="text-sm text-slate-600">Total Entregue</div>
                 <div className="text-2xl font-bold text-green-600">{filtered.reduce((sum, i) => sum + i.delivered_qty, 0).toFixed(2)}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="text-sm text-slate-600">Total Disponível</div>
                <div className="text-2xl font-bold text-blue-600">{filtered.reduce((sum, i) => sum + i.available_qty, 0).toFixed(2)}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="text-sm text-slate-600">Total Necessidade</div>
                <div className={`text-2xl font-bold ${filtered.reduce((sum, i) => sum + i.necessity, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {filtered.reduce((sum, i) => sum + i.necessity, 0).toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}