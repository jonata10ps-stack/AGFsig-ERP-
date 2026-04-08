import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { 
  Search, Package, User, ClipboardList, AlertCircle, 
  CheckCircle2, Clock, Filter, Printer, FileText,
  AlertTriangle, Loader2, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PendingItemsReport() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');

  // 1. Fetch Orders (Active ones)
  // 1. Fetch Orders (Active ones)
  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ['active-sales-orders-report', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const all = await base44.entities.SalesOrder.filter({ company_id: companyId });
      
      return all.filter(o => {
        if (o.status === 'CANCELADO') return false;
        
        // Vendas: Exclui Faturado/Expedido
        if (!o.is_shipment) {
          return !['FATURADO', 'EXPEDIDO'].includes(o.status);
        }
        
        // Remessas: Mostra se não estiver Cancelada
        return true;
      });
    },
    enabled: !!companyId,
  });

  // 2. Fetch Items - Fetch items for the specific orders found to ensure accuracy
  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['sales-order-items-report', companyId, orders?.map(o => o.id).join(',')],
    queryFn: async () => {
      if (!companyId || !orders || orders.length === 0) return [];
      
      const orderIds = orders.map(o => o.id);
      
      // Batch fetch items if there are many orders to avoid URL length issues
      const BATCH_SIZE = 50;
      let allItems = [];
      const products = await base44.entities.Product.filter({ company_id: companyId });

      for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
        const batch = orderIds.slice(i, i + BATCH_SIZE);
        const results = await base44.entities.SalesOrderItem.filter({ order_id: batch });
        
        // Filtrar apenas itens físicos (não SV)
        const physical = results.filter(item => {
          const p = products.find(prod => prod.id === item.product_id);
          return p?.category !== 'SV';
        });

        allItems = [...allItems, ...physical];
      }
      return allItems;
    },
    enabled: !!companyId && !!orders,
  });

  // 3. Fetch Stock Balances
  const { data: stockBalances, isLoading: loadingStock } = useQuery({
    queryKey: ['stock-balances-report', companyId],
    queryFn: () => companyId ? base44.entities.StockBalance.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  // 4. Consolidate Data
  const reportData = useMemo(() => {
    if (!orders || !items || !stockBalances) return [];

    const orderMap = orders.reduce((acc, o) => ({ ...acc, [o.id]: o }), {});
    
    const stockMap = stockBalances.reduce((acc, sb) => {
      const qty = parseFloat(sb.qty_available) || 0;
      acc[sb.product_id] = (acc[sb.product_id] || 0) + qty;
      return acc;
    }, {});

    const processed = items.map(item => {
      const order = orderMap[item.order_id];
      if (!order) return null;

      const qty = parseFloat(item.qty) || 0;
      const separated = parseFloat(item.qty_separated) || 0;
      const returned = parseFloat(item.qty_returned) || 0;
      
      // Lógica de Pendência Diferenciada
      let isPending = false;
      let pendingQty = 0;
      
      if (!order.is_shipment) {
        // Venda: pendente se não separado
        isPending = separated < qty;
        pendingQty = Math.max(0, qty - separated);
      } else {
        // Remessa: pendente se não enviado OU se não retornado (caso exija retorno)
        const pendingShipment = separated < qty;
        const pendingReturn = order.requires_return && returned < qty;
        
        isPending = pendingShipment || pendingReturn;
        
        if (pendingShipment) {
          pendingQty = qty - separated;
        } else if (pendingReturn) {
          pendingQty = qty - returned;
        }
      }

      if (!isPending) return null;

      const stock = stockMap[item.product_id] || 0;
      let status = 'OUT_OF_STOCK';
      if (stock >= pendingQty) status = 'READY';
      else if (stock > 0) status = 'PARTIAL';

      return {
        ...item,
        order_number: order.order_number,
        client_name: order.client_name,
        delivery_date: order.delivery_date,
        order_status: order.status,
        is_shipment: order.is_shipment,
        shipment_type: order.shipment_type,
        requires_return: order.requires_return,
        nf_number: order.numero_pedido_externo || '-', 
        pending_qty: Math.round(pendingQty * 1000) / 1000,
        available_stock: stock,
        inventory_status: status,
        is_pending_return: (separated >= qty) && (order.requires_return && returned < qty)
      };
    }).filter(Boolean);

    return processed;
  }, [orders, items, stockBalances]);

  // 5. Filter Data
  const filteredData = useMemo(() => {
    return reportData.filter(row => 
      row.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      row.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      row.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      row.product_sku?.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => {
      const dateA = a.delivery_date ? new Date(a.delivery_date).getTime() : 0;
      const dateB = b.delivery_date ? new Date(b.delivery_date).getTime() : 0;
      return dateA - dateB;
    });
  }, [reportData, search]);

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'READY':
        return <Badge className="bg-emerald-100 text-emerald-700 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Disponível</Badge>;
      case 'PARTIAL':
        return <Badge className="bg-amber-100 text-amber-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Parcial</Badge>;
      default:
        return <Badge className="bg-rose-100 text-rose-700 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Indisponível</Badge>;
    }
  };

  if (loadingOrders || loadingItems || loadingStock) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-20 w-full" />
        <Card><CardContent className="p-0"><div className="space-y-2 p-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatório de Itens Pendentes</h1>
          <p className="text-slate-500">Acompanhamento de atendimento e disponibilidade de estoque</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Badge className="bg-indigo-100 text-indigo-700 h-8 px-3">
            {filteredData.length} itens pendentes
          </Badge>
        </div>
      </div>

      <Card className="print:hidden border-slate-200 bg-slate-50/50">
        <CardContent className="p-3 text-xs text-slate-500 flex flex-wrap gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>Empresa ID: <span className="font-mono font-bold text-slate-700">{companyId || 'Não definido'}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Pedidos Ativos: <span className="font-mono font-bold text-slate-700">{orders?.length || 0}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Itens Processados: <span className="font-mono font-bold text-slate-700">{items?.length || 0}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Resultado: <span className="font-mono font-bold text-slate-700">{reportData.length} pendências</span></span>
          </div>
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por cliente, pedido ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200 shadow-sm print:border-none print:shadow-none">
        <CardHeader className="bg-slate-50/50 border-b print:hidden">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-indigo-500" />
            Detalhamento de Pendências
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="w-[120px]">Data Entrega</TableHead>
                  <TableHead>Tipo / Ref</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Pendente</TableHead>
                  <TableHead className="text-center">Estoque Total</TableHead>
                  <TableHead>Disponibilidade</TableHead>
                  <TableHead className="print:hidden"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Package className="h-12 w-12 mb-2 opacity-20" />
                        <p>Nenhum item pendente encontrado</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((row) => (
                    <TableRow key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium text-slate-600">
                        {row.delivery_date ? format(new Date(row.delivery_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <Badge variant="outline" className={cn(
                            "text-[10px] py-0 px-1 w-fit mb-1",
                            row.is_shipment ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                          )}>
                            {row.is_shipment ? `REMESSA: ${row.shipment_type || ''}` : 'VENDA'}
                          </Badge>
                          <span className="text-[10px] text-slate-400 font-mono uppercase">REF: {row.nf_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-indigo-600">{row.order_number}</span>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="text-sm font-semibold text-slate-900 truncate" title={row.client_name}>
                          {row.client_name}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px] text-indigo-500 font-bold uppercase">{row.product_sku}</span>
                          <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]" title={row.product_name}>
                            {row.product_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold text-slate-700">
                        {row.pending_qty}
                      </TableCell>
                      <TableCell className="text-center text-slate-500">
                        {row.available_stock}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge className={cn(
                            "w-fit",
                            row.inventory_status === 'READY' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                            row.inventory_status === 'PARTIAL' ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                            "bg-rose-100 text-rose-700 hover:bg-rose-100"
                          )}>
                            {row.inventory_status === 'READY' ? 'Estoque OK' : 
                             row.inventory_status === 'PARTIAL' ? 'Estoque Parcial' : 'Sem Estoque'}
                          </Badge>
                          
                          {row.is_pending_return && (
                            <Badge variant="outline" className="w-fit bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
                              Pendente Retorno
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="print:hidden">
                        <Link to={createPageUrl(`SalesOrderDetail?id=${row.order_id}`)}>
                          <Button variant="ghost" size="icon" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <style>{`
        @media print {
          body { background: white; }
          .print-hidden { display: none !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
          th { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
          .badge { border: 1px solid #ccc; padding: 2px 6px; border-radius: 4px; }
        }
      `}</style>
    </div>
  );
}
