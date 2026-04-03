import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Search, Package, CheckCircle, PackageCheck, ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import QRScanner from '@/components/scanner/QRScanner';
import { Loader2, ChevronDown, ChevronRight, Barcode } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { executeInventoryTransaction } from '@/utils/inventoryTransactionUtils';
import { PackageOpen, MapPin, Truck } from 'lucide-react';

function ItemRow({ item, selectedOrder, companyId, onSeparate, separationMoves, onUndo }) {
  const remaining = item.qty - (item.qty_separated || 0);
  const isComplete = remaining <= 0;
  
  // Filtrar moves deste item
  const itemMoves = (separationMoves || []).filter(m => m.product_id === item.product_id && m.type === 'SEPARACAO');

  return (
    <div className={`p-4 rounded-lg border mb-3 ${isComplete ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-start gap-2">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm text-indigo-600 font-bold">{item.product_sku}</p>
            </div>
            <p className="font-medium text-slate-800">{item.product_name}</p>
          </div>
        </div>
        {isComplete && (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">
            <CheckCircle className="h-3 w-3 mr-1" /> Completo
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between py-2 border-y border-slate-50 mb-3">
        <div className="text-sm flex gap-4">
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Pedido</span>
            <span className="font-mono font-bold">{item.qty}</span>
          </div>
          <div>
            <span className="text-emerald-500 text-[10px] uppercase font-bold block">Separado</span>
            <span className="font-mono font-bold text-emerald-600">{item.qty_separated || 0}</span>
          </div>
        </div>
        
        {!isComplete && (selectedOrder.status === 'SEPARANDO' || selectedOrder.status === 'CONFIRMADO') && (
          <Button
            size="sm"
            onClick={() => onSeparate(remaining, null)}
            className="shadow-sm bg-indigo-600 hover:bg-indigo-700"
          >
            <Package className="h-4 w-4 mr-1" />
            Separar
          </Button>
        )}
      </div>

      {itemMoves.length > 0 && (
        <div className="space-y-2 mt-2">
           <p className="text-[10px] uppercase font-bold text-slate-400">Histórico de Retirada:</p>
           {itemMoves.map(move => (
              <div key={move.id} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 text-xs">
                 <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                       <span className="text-indigo-600 font-bold flex items-center gap-1">
                          <PackageOpen className="h-3 w-3" /> {move.qty} un.
                       </span>
                       <span className="text-[9px] text-slate-500 flex items-center gap-1">
                          {move.from_location_id} <ArrowRight className="h-2 w-2" /> {move.to_location_id}
                       </span>
                    </div>
                 </div>
                 <Button
                   variant="ghost"
                   size="icon"
                   className="h-7 w-7 text-rose-500 hover:bg-rose-50"
                   onClick={() => onUndo(move)}
                   title="Desfazer esta retirada"
                 >
                    <RotateCcw className="h-3 w-3" />
                 </Button>
              </div>
           ))}
        </div>
      )}
    </div>
  );
}

export default function Separation() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Modal Picker Configuration
  const [pickConfig, setPickConfig] = useState({ open: false, item: null, qty: 0, component: null, locs: [], whs: [], prods: [] });
  const [scanProd, setScanProd] = useState('');
  const [scanLoc, setScanLoc] = useState('');
  const [scanDestLoc, setScanDestLoc] = useState('');
  const [pickQty, setPickQty] = useState(0);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders-for-separation', companyId],
    queryFn: () => companyId ? base44.entities.SalesOrder.filter({ company_id: companyId, status: ['CONFIRMADO', 'RESERVADO', 'SEPARANDO', 'SEPARADO'] }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['order-items', selectedOrder?.id],
    queryFn: () => base44.entities.SalesOrderItem.filter({ order_id: selectedOrder.id }),
    enabled: !!selectedOrder,
  });

  const startSeparationMutation = useMutation({
    mutationFn: async (order) => {
      await base44.entities.SalesOrder.update(order.id, { status: 'SEPARANDO' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-for-separation'] });
      toast.success('Separação iniciada');
    },
  });

  const separateItemMutation = useMutation({
    mutationFn: async ({ item, qty, from_warehouse_id, from_location_id, to_warehouse_id, to_location_id }) => {
      const newSeparated = (item.qty_separated || 0) + qty;
      
      await executeInventoryTransaction({
        type: 'SEPARACAO',
        product_id: item.product_id,
        qty: qty,
        from_warehouse_id,
        from_location_id,
        to_warehouse_id,
        to_location_id,
        related_type: 'PEDIDO',
        related_id: item.order_id,
        reason: `Picking: ${from_location_id} -> ${to_location_id} p/ pedido ${item.order_id}`
      }, companyId);

      await base44.entities.SalesOrderItem.update(item.id, { 
        qty_separated: newSeparated 
      });

      // Checar se o pedido todo foi separado
      const allItems = await base44.entities.SalesOrderItem.filter({ order_id: item.order_id });
      const overallComplete = allItems.every(i => {
         if (i.id === item.id) return (newSeparated >= i.qty);
         return (i.qty_separated || 0) >= i.qty;
      });

      if (overallComplete) {
         await base44.entities.SalesOrder.update(item.order_id, { status: 'SEPARADO' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-items', selectedOrder?.id] });
      queryClient.invalidateQueries({ queryKey: ['orders-for-separation', companyId] });
      queryClient.invalidateQueries({ queryKey: ['separations-moves'] });
      toast.success('Transferência para expedição concluída');
      setPickConfig(prev => ({ ...prev, open: false }));
      setScanProd('');
      setScanLoc('');
      setScanDestLoc('');
    },
    onError: (error) => {
      toast.error('Erro na movimentação: ' + error.message);
    }
  });

  const undoSeparationMutation = useMutation({
    mutationFn: async (move) => {
       // 1. Reverter no inventário (no destino)
       await executeInventoryTransaction({
         type: 'DESFAZER_SEPARACAO',
         product_id: move.product_id,
         qty: move.qty,
         from_warehouse_id: move.to_warehouse_id,
         from_location_id: move.to_location_id,
         related_type: 'PEDIDO',
         related_id: move.related_id,
         reason: `Estorno de Picking: ${move.to_location_id}`
       }, companyId);

       // 2. Atualizar item do pedido
       const item = items.find(i => i.product_id === move.product_id);
       if (item) {
          const newTotal = (item.qty_separated || 0) - (move.qty || 0);
          await base44.entities.SalesOrderItem.update(item.id, { qty_separated: Math.max(0, newTotal) });
       }

       // 3. Voltar status do pedido para SEPARANDO se ele for SEPARADO
       if (selectedOrder.status === 'SEPARADO') {
          await base44.entities.SalesOrder.update(selectedOrder.id, { status: 'SEPARANDO' });
       }
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['order-items', selectedOrder?.id] });
       queryClient.invalidateQueries({ queryKey: ['orders-for-separation', companyId] });
       queryClient.invalidateQueries({ queryKey: ['separations-moves'] });
       toast.success('Retirada estornada para o local de expedição');
    }
  });

  const { data: separationMoves } = useQuery({
     queryKey: ['separations-moves', selectedOrder?.id],
     queryFn: () => base44.entities.InventoryMove.filter({ related_id: selectedOrder.id, type: 'SEPARACAO' }),
     enabled: !!selectedOrder
  });

  const handleSeparateRequest = async (item, requiredQty, component) => {
     // Pre-flight check de saldo global do banco de dados
     const prodId = component ? component.component_id : item.product_id;
     
     const [bals, locs, whs, prods] = await Promise.all([
       base44.entities.StockBalance.filter({ company_id: companyId, product_id: prodId }),
       base44.entities.Location.filter({ company_id: companyId }),
       base44.entities.Warehouse.filter({ company_id: companyId }),
       base44.entities.Product.filter({ id: prodId })
     ]);
     
     const available = bals.filter(b => parseFloat(b.qty_available) > 0);
     if (available.length === 0) {
        toast.error(`Aviso Crítico: O item ${prods[0]?.sku || ''} está sem saldo físico na empresa e não pode ser separado.`);
        return;
     }

     const availQtyTotal = available.reduce((acc, b) => acc + (parseFloat(b.qty_available) || 0), 0);
     const defaultQty = Math.min(requiredQty, availQtyTotal);
     setPickQty(defaultQty);
     setPickConfig({ open: true, item, qty: requiredQty, component, available, locs, whs, prods });
  };

  const handleConfirmLocation = () => {
     if (!scanLoc) {
         toast.error("Você precisa bipar ou digitar algum endereço/código de armazém.");
         return;
     }
     
     const match = pickConfig.available.find(b => {
        const l = pickConfig.locs.find(lx => lx.id === b.location_id);
        const w = pickConfig.whs.find(wx => wx.id === b.warehouse_id);
        return (l?.barcode?.toLowerCase() === scanLoc.toLowerCase() || 
                l?.id === scanLoc || 
                w?.code?.toLowerCase() === scanLoc.toLowerCase());
     });

     if (!match) {
        toast.error("O local escaneado não confere ou não possui saldo livre desse produto!");
        return;
     }
     
     if (scanProd) {
        const pro = pickConfig.prods[0];
        if (pro.sku?.toLowerCase() !== scanProd.toLowerCase() && pro.barcode?.toLowerCase() !== scanProd.toLowerCase()) {
           toast.error("O código do produto lido não bate com o item logístico exigido da OP.");
           return;
        }
     }
     
     const manualQty = parseFloat(pickQty) || 0;
     if (manualQty <= 0) {
         toast.error("A quantidade precisa ser maior que zero.");
         return;
     }
     
     if (manualQty > parseFloat(match.qty_available)) {
         toast.error(`A prateleira ${scanLoc} possui apenas ${match.qty_available} un. disponível.`);
         return;
     }

     separateItemMutation.mutate({ 
        item: pickConfig.item, 
        qty: manualQty, 
        warehouse_id: match.warehouse_id, 
        location_id: match.location_id 
     });
  };

  const completeSeparationMutation = useMutation({
    mutationFn: async (order) => {
      await base44.entities.SalesOrder.update(order.id, { status: 'SEPARADO' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-for-separation'] });
      setSelectedOrder(null);
      toast.success('Separação concluída');
    },
  });

  const releaseSeparationMutation = useMutation({
    mutationFn: async (order) => {
      // Buscar itens do pedido
      const orderItems = await base44.entities.SalesOrderItem.filter({ order_id: order.id });
      
      // Se estiver em SEPARADO/SEPARANDO, liberar reservas
      if (order.status === 'SEPARADO' || order.status === 'SEPARANDO') {
        // Buscar todas as reservas do pedido
        const reservations = await base44.entities.Reservation.filter({ order_id: order.id });
        
        // Deletar cada reserva e atualizar saldos
        for (const reservation of reservations) {
          const balances = await base44.entities.StockBalance.filter({
            product_id: reservation.product_id,
            location_id: reservation.location_id
          });
          
          if (balances[0]) {
            await base44.entities.StockBalance.update(balances[0].id, {
              qty_reserved: (balances[0].qty_reserved || 0) - reservation.qty,
              qty_available: (balances[0].qty_available || 0) + reservation.qty
            });
          }
          
          await base44.entities.Reservation.delete(reservation.id);
        }
        
        // Zerar qty_reserved dos itens
        for (const item of orderItems) {
          if (item.qty_reserved > 0) {
            await base44.entities.SalesOrderItem.update(item.id, { qty_reserved: 0 });
          }
        }
      }
      
      // Se estiver em RESERVADO, voltar para CONFIRMADO
      // Se estiver em SEPARANDO/SEPARADO, voltar para CONFIRMADO
      const newStatus = 'CONFIRMADO';
      await base44.entities.SalesOrder.update(order.id, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-for-separation'] });
      toast.success('Separação revertida para Confirmado');
    },
  });

  const filteredOrders = orders?.filter(o =>
    o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  const allItemsSeparated = items?.every(item => (item.qty_separated || 0) >= item.qty);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Separação de Pedidos</h1>
        <p className="text-slate-500">Separe os itens dos pedidos para expedição</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos para Separar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              <QRScanner
                onScan={(code) => {
                  const order = orders?.find(o => o.order_number === code || o.numero_pedido_externo === code);
                  if (order) {
                    setSelectedOrder(order);
                    toast.success(`Pedido ${order.order_number} selecionado`);
                  } else {
                    toast.error('Pedido não encontrado');
                  }
                }}
                placeholder="Escaneie o pedido"
              />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Ou busque manualmente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filteredOrders?.length === 0 ? (
              <div className="text-center py-8">
                <PackageCheck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">Nenhum pedido para separar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders?.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedOrder?.id === order.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-indigo-600 font-medium">
                          {order.order_number || `#${order.id.slice(0, 8)}`}
                        </p>
                        <p className="text-sm text-slate-500">{order.client_name}</p>
                      </div>
                      <div className="text-right">
                        <Badge className={
                          order.status === 'SEPARANDO' ? 'bg-amber-100 text-amber-700' :
                          order.status === 'CONFIRMADO' ? 'bg-blue-100 text-blue-700' :
                          'bg-indigo-100 text-indigo-700'
                        }>
                          {order.status}
                        </Badge>
                        {order.delivery_date && (
                          <p className="text-xs text-slate-500 mt-1">
                            Entrega: {format(new Date(order.delivery_date), 'dd/MM', { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Separation Panel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {selectedOrder ? `Separação - ${selectedOrder.order_number || `#${selectedOrder.id.slice(0, 8)}`}` : 'Selecione um pedido'}
            </CardTitle>
            {selectedOrder && (
              <div className="flex gap-2">
                {(selectedOrder.status === 'RESERVADO' || selectedOrder.status === 'SEPARANDO' || selectedOrder.status === 'SEPARADO') && (
                  <Button
                    onClick={() => releaseSeparationMutation.mutate(selectedOrder)}
                    variant="outline"
                    className="text-amber-600 border-amber-300 hover:bg-amber-50"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Liberar
                  </Button>
                )}
                {allItemsSeparated && selectedOrder.status === 'SEPARANDO' && (
                   <Button
                     onClick={() => completeSeparationMutation.mutate(selectedOrder)}
                     className="bg-emerald-600 hover:bg-emerald-700"
                   >
                     <CheckCircle className="h-4 w-4 mr-2" />
                     Pronto p/ Expedição
                   </Button>
                 )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedOrder ? (
              <div className="text-center py-12">
                <ArrowRight className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">Selecione um pedido na lista ao lado</p>
              </div>
            ) : loadingItems ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {selectedOrder.status === 'CONFIRMADO' && (
                  <Button
                    onClick={() => startSeparationMutation.mutate(selectedOrder)}
                    className="w-full"
                  >
                    Iniciar Separação
                  </Button>
                )}

                {items?.map((item) => (
                  <ItemRow 
                    key={item.id} 
                    item={item} 
                    selectedOrder={selectedOrder} 
                    companyId={companyId}
                    onSeparate={(qty, component) => handleSeparateRequest(item, qty, component)}
                    separationMoves={separationMoves}
                    onUndo={(move) => undoSeparationMutation.mutate(move)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={pickConfig.open} onOpenChange={(v) => !v && setPickConfig(prev => ({ ...prev, open: false }))}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Mapeamento de Prateleira (Bipe/Scan)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex flex-col gap-1 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-1 bg-indigo-100/30 rounded-bl-lg">
                  <Package className="h-3 w-3 text-indigo-400" />
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Confirmação de Item</span>
                 <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-200 shadow-sm px-3">
                   {pickConfig.qty} un.
                 </Badge>
               </div>
               <p className="font-mono text-sm font-black text-slate-800 mt-1">
                 {pickConfig.prods?.[0]?.sku}
               </p>
               <p className="text-xs text-slate-500 font-medium truncate">
                 {pickConfig.prods?.[0]?.name}
               </p>
            </div>
            
            <div className="space-y-3">
               <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">1. Escanear Produto (Opcional)</label>
                  <QRScanner
                    onScan={(code) => {
                      const pro = pickConfig.prods?.[0];
                      if (pro && pro.sku?.toLowerCase() !== code.toLowerCase() && pro.barcode?.toLowerCase() !== code.toLowerCase()) {
                         toast.error("Produto lido NÃO confere com o item do pedido!");
                         return;
                      }
                      setScanProd(code.trim());
                      toast.success("Produto validado!");
                    }}
                    placeholder="Bipe o código do produto"
                  />
                  <div className="relative mt-2">
                    <Barcode className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      value={scanProd} onChange={e => setScanProd(e.target.value)} 
                      placeholder="Ou digite o SKU/Barras..." className="pl-10 h-9 text-sm" 
                    />
                  </div>
               </div>
            </div>

            <div className="space-y-3">
               <div>
                  <label className="text-[10px] uppercase font-bold text-indigo-600 mb-1 block">2. Escanear Prateleira (Obrigatório)</label>
                  <QRScanner
                    onScan={(code) => {
                      setScanLoc(code.trim());
                      toast.success("Endereço lido!");
                    }}
                    placeholder="Bipe o QR Code da prateleira"
                    active={!scanLoc}
                  />
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-indigo-400" />
                    <Input 
                      autoFocus
                      value={scanLoc} onChange={e => setScanLoc(e.target.value)} 
                      placeholder="Ou digite o código da prateleira..." className="pl-10 h-9 text-sm border-indigo-200" 
                    />
                  </div>
               </div>
            </div>

            <div className="space-y-3 pt-1">
               <div>
                  <label className="text-[10px] uppercase font-bold text-emerald-600 mb-1 block">3. Quantidade a Retirar deste Local</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-2.5 h-4 w-4 text-emerald-400" />
                    <Input 
                      type="number"
                      value={pickQty} 
                      onChange={e => setPickQty(e.target.value)} 
                      placeholder="Informe a quantidade..." 
                      className="pl-10 h-9 text-sm border-emerald-200" 
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Sugerido: {pickConfig.qty} un.</p>
               </div>
            </div>

            <div className="space-y-3 pt-1">
               <div>
                  <label className="text-[10px] uppercase font-bold text-slate-900 mb-1 block">4. Endereço de DESTINO (Doca/Expedição)</label>
                  <QRScanner
                    onScan={(code) => {
                      setScanDestLoc(code.trim());
                      toast.success("Destino lido!");
                    }}
                    placeholder="Bipe o QR Code do destino"
                    active={scanLoc && !scanDestLoc}
                  />
                  <div className="relative mt-2">
                    <Truck className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
                    <Input 
                      value={scanDestLoc} onChange={e => setScanDestLoc(e.target.value)} 
                      placeholder="Ou digite o código de destino..." className="pl-10 h-9 text-sm border-slate-300" 
                    />
                  </div>
               </div>
            </div>

            <div className="pt-2 border-t text-xs">
               <p className="text-slate-500 font-semibold mb-2 italic text-center">Dica: Retire da prateleira e registre onde na expedição o lote foi colocado.</p>
            </div>
            
            <div className="pt-2 border-t text-xs">
              <p className="text-slate-500 font-semibold mb-2">Sugestões (Saldos Livres Ativos):</p>
              {pickConfig.available?.map(b => {
                 const l = pickConfig.locs?.find(lx => lx.id === b.location_id);
                 const w = pickConfig.whs?.find(wx => wx.id === b.warehouse_id);
                 return (
                   <div key={b.id} className="flex justify-between py-1 px-2 mb-1 bg-slate-100 rounded">
                     <span>{w?.code} {l ? `- ${l.rua}/${l.modulo}/${l.nivel} (${l.barcode})` : ''}</span>
                     <strong className="text-emerald-700">{b.qty_available} un.</strong>
                   </div>
                 )
              })}
            </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setPickConfig(prev => ({ ...prev, open: false }))}>Cancelar</Button>
             <Button onClick={handleConfirmLocation} disabled={separateItemMutation.isPending || !scanLoc.trim() || !scanDestLoc.trim()}>
                 {separateItemMutation.isPending ? 'Transferindo...' : 'Confirmar e Mover para Expedição'}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}