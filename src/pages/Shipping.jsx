import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { 
  Search, Package, CheckCircle, Truck, ArrowRight, RotateCcw, Printer, 
  Package2, Calendar, User, FileText, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import QRScanner from '@/components/scanner/QRScanner';
import ShippingLabel from '@/components/shipping/ShippingLabel';
import SerialNumberInput from '@/components/shipping/SerialNumberInput';

export default function Shipping() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [printLabel, setPrintLabel] = useState(null);

  const [editingOrder, setEditingOrder] = useState(null);
  const [serialInput, setSerialInput] = useState(null);
  const [shippingData, setShippingData] = useState({
    nf_number: '',
    carrier: '',
    weight: '',
    volume: ''
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders-for-shipping', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const all = await base44.entities.SalesOrder.filter({ company_id: companyId }, '-created_date', 200);
      return all.filter(o => o.status !== 'CANCELADO');
    },
    enabled: !!companyId,
  });

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['order-items-shipping', selectedOrder?.id],
    queryFn: () => base44.entities.SalesOrderItem.filter({ order_id: selectedOrder.id }),
    enabled: !!selectedOrder,
  });

  const shipOrderMutation = useMutation({
    mutationFn: async (order) => {
      // 1. Buscar itens do pedido
      const orderItems = await base44.entities.SalesOrderItem.filter({ order_id: order.id });

      // 2. Cancelar reservas do pedido e limpar saldos reservados
      const reservations = await base44.entities.Reservation.filter({ order_id: order.id });
      for (const res of reservations) {
        if (res.status === 'CANCELADA') continue;

        // Cancelar a reserva
        await base44.entities.Reservation.update(res.id, { status: 'CANCELADA' });

        // Reduzir qty_reserved no StockBalance correspondente
        if (res.product_id) {
          const balFilter = { company_id: order.company_id, product_id: res.product_id };
          if (res.location_id) balFilter.location_id = res.location_id;
          const balances = await base44.entities.StockBalance.filter(balFilter);
          if (balances.length > 0) {
            const bal = balances[0];
            await base44.entities.StockBalance.update(bal.id, {
              qty_reserved: Math.max(0, (bal.qty_reserved || 0) - (res.qty || 0)),
              qty_separated: Math.max(0, (bal.qty_separated || 0) - (res.qty || 0)),
            });
          }
        }
      }

      // 3. Para cada item, baixar estoque e limpar qtds
      for (const item of orderItems) {
        const qty = item.qty || 0;
        if (!item.product_id || qty <= 0) continue;

        // Zerar qty_reserved e qty_separated no item
        await base44.entities.SalesOrderItem.update(item.id, {
          qty_reserved: 0,
          qty_separated: 0,
        });

        // Criar movimento de saída no kardex
        await base44.entities.InventoryMove.create({
          company_id: order.company_id,
          type: 'SAIDA',
          product_id: item.product_id,
          qty: qty,
          related_type: 'PEDIDO',
          related_id: order.id,
          reason: `Expedição do pedido ${order.order_number || order.id}`,
        });

        // Atualizar saldo de estoque (reduzir qty_available)
        const balances = await base44.entities.StockBalance.filter({
          company_id: order.company_id,
          product_id: item.product_id,
        });

        let remaining = qty;
        for (const bal of balances) {
          if (remaining <= 0) break;
          const deduct = Math.min(bal.qty_available || 0, remaining);
          if (deduct > 0) {
            await base44.entities.StockBalance.update(bal.id, {
              qty_available: (bal.qty_available || 0) - deduct,
            });
            remaining -= deduct;
          }
        }
      }

      // 3. Atualizar status do pedido
      await base44.entities.SalesOrder.update(order.id, { 
        status: 'EXPEDIDO',
        nf_number: shippingData.nf_number || order.nf_number,
        carrier: shippingData.carrier || order.carrier,
        weight: shippingData.weight || order.weight,
        volume: shippingData.volume || order.volume
      });
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['orders-for-shipping', companyId] });
       setEditingOrder(null);
       setShippingData({ nf_number: '', carrier: '', weight: '', volume: '' });
       toast.success('Pedido expedido e estoque baixado com sucesso');
     },
  });

  const updateShippingInfoMutation = useMutation({
    mutationFn: async (order) => {
      await base44.entities.SalesOrder.update(order.id, {
        nf_number: shippingData.nf_number || order.nf_number,
        carrier: shippingData.carrier || order.carrier,
        weight: shippingData.weight || order.weight,
        volume: shippingData.volume || order.volume
      });
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['orders-for-shipping', companyId] });
       setEditingOrder(null);
       setShippingData({ nf_number: '', carrier: '', weight: '', volume: '' });
       toast.success('Dados de expedição atualizados');
     },
  });

  const cancelShippingMutation = useMutation({
    mutationFn: async (order) => {
      await base44.entities.SalesOrder.update(order.id, { status: 'SEPARADO' });
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['orders-for-shipping', companyId] });
       setSelectedOrder(null);
       toast.success('Expedição cancelada');
     },
    onError: (error) => {
      toast.error('Erro ao cancelar expedição: ' + error.message);
    }
  });

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setShippingData({
      nf_number: order.nf_number || '',
      carrier: order.carrier || '',
      weight: order.weight || '',
      volume: order.volume || ''
    });
  };

  const filteredOrders = orders?.filter(o =>
    o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.nf_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Expedição</h1>
        <p className="text-slate-500">Gere etiquetas e expida pedidos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Prontos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <QRScanner
                onScan={(code) => {
                  const order = orders?.find(
                    o => o.order_number === code || o.numero_pedido_externo === code
                  );
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
                  placeholder="Busque por número ou cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : filteredOrders?.length === 0 ? (
                <div className="text-center py-8">
                  <Truck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">Nenhum pedido pronto</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredOrders?.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => handleSelectOrder(order)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedOrder?.id === order.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <p className="font-mono text-sm text-indigo-600 font-medium">
                        {order.order_number || `#${order.id.slice(0, 8)}`}
                      </p>
                      <p className="text-sm text-slate-600">{order.client_name}</p>
                      {order.nf_number && (
                        <p className="text-xs text-slate-500">NF: {order.nf_number}</p>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <Badge className={`text-xs ${
                          order.status === 'EXPEDIDO' ? 'bg-emerald-100 text-emerald-700' :
                          order.status === 'FATURADO' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'SEPARADO' ? 'bg-purple-100 text-purple-700' :
                          order.status === 'SEPARANDO' ? 'bg-yellow-100 text-yellow-700' :
                          order.status === 'RESERVADO' ? 'bg-orange-100 text-orange-700' :
                          order.status === 'CONFIRMADO' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {order.status}
                        </Badge>
                        {order.delivery_date && (
                          <span className="text-xs text-slate-500">
                            {format(new Date(order.delivery_date), 'dd/MM', { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Items & Labels */}
        <div className="lg:col-span-2 space-y-4">
          {selectedOrder && (editingOrder || selectedOrder.status !== 'EXPEDIDO') && (
            <Card>
              <CardHeader>
                <CardTitle>Dados de Expedição</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">NF</label>
                    <Input
                      placeholder="Número da nota fiscal"
                      value={shippingData.nf_number}
                      onChange={(e) => setShippingData({...shippingData, nf_number: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Transportadora</label>
                    <Input
                      placeholder="Nome da transportadora"
                      value={shippingData.carrier}
                      onChange={(e) => setShippingData({...shippingData, carrier: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Peso (kg)</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={shippingData.weight}
                      onChange={(e) => setShippingData({...shippingData, weight: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Volume (m³)</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={shippingData.volume}
                      onChange={(e) => setShippingData({...shippingData, volume: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                   <Button
                     onClick={() => updateShippingInfoMutation.mutate(selectedOrder)}
                     disabled={updateShippingInfoMutation.isPending}
                     className="bg-indigo-600 hover:bg-indigo-700"
                   >
                     Atualizar Dados
                   </Button>
                   {selectedOrder.status !== 'EXPEDIDO' && (
                     <>
                       <Button
                         onClick={() => shipOrderMutation.mutate(selectedOrder)}
                         disabled={shipOrderMutation.isPending}
                         className="bg-emerald-600 hover:bg-emerald-700"
                       >
                         <Truck className="h-4 w-4 mr-2" />
                         Expedir Agora
                       </Button>
                       <Button
                         onClick={() => cancelShippingMutation.mutate(selectedOrder)}
                         disabled={cancelShippingMutation.isPending}
                         variant="destructive"
                       >
                         <X className="h-4 w-4 mr-2" />
                         Cancelar Expedição
                       </Button>
                     </>
                   )}
                 </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {selectedOrder 
                  ? `Etiquetas - ${selectedOrder.order_number || `#${selectedOrder.id.slice(0, 8)}`}`
                  : 'Selecione um pedido'
                }
              </CardTitle>
              {selectedOrder?.status === 'EXPEDIDO' && !editingOrder && (
                <Button
                  onClick={() => setEditingOrder(true)}
                  className="bg-slate-600 hover:bg-slate-700"
                >
                  Editar Dados
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!selectedOrder ? (
                <div className="text-center py-12">
                  <ArrowRight className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">Selecione um pedido na lista</p>
                </div>
              ) : loadingItems ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <Skeleton key={i} className="h-40 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                    {items?.map((item) => (
                      <div key={item.id} className="border rounded-lg p-4 bg-slate-50">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="font-mono text-sm text-indigo-600 font-bold">
                              {item.product_sku}
                            </p>
                            <p className="font-medium text-slate-900">{item.product_name}</p>
                            <p className="text-sm text-slate-600 mt-1">Qtd: {item.qty}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => setSerialInput(item)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Séries
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setPrintLabel(item)}
                              className="bg-indigo-600 hover:bg-indigo-700"
                            >
                              <Printer className="h-4 w-4 mr-1" />
                              Etiqueta
                            </Button>
                          </div>
                        </div>
                      
                      <Separator className="my-3" />
                      
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">Cliente:</span>
                          <p className="font-medium text-slate-900">{selectedOrder.client_name}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">NF:</span>
                          <p className="font-medium text-slate-900">{selectedOrder.nf_number || '-'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Entrega:</span>
                          <p className="font-medium text-slate-900">
                            {selectedOrder.delivery_date 
                              ? format(new Date(selectedOrder.delivery_date), 'dd/MM/yyyy', { locale: ptBR })
                              : '-'
                            }
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Pedido:</span>
                          <p className="font-medium text-slate-900">
                            {selectedOrder.order_number || selectedOrder.numero_pedido_externo}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Print Label Dialog */}
       {printLabel && (
         <ShippingLabel 
           item={printLabel}
           order={selectedOrder}
           onClose={() => setPrintLabel(null)}
         />
       )}

       {/* Serial Number Input Dialog */}
       {serialInput && (
         <SerialNumberInput
           item={serialInput}
           order={selectedOrder}
           onClose={() => setSerialInput(null)}
           onSuccess={() => queryClient.invalidateQueries({ queryKey: ['order-items-shipping'] })}
         />
       )}
      </div>
      );
      }