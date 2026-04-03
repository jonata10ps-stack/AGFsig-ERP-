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
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';

function ItemRow({ item, selectedOrder, companyId, onSeparate }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Buscar se o produto tem BOM
  const { data: allBoms, isLoading: loadingBOM } = useQuery({
    queryKey: ['product-bom', companyId, item.product_id],
    queryFn: () => companyId ? base44.entities.BOM.filter({ 
      product_id: item.product_id, 
      company_id: companyId 
    }) : Promise.resolve([]),
    enabled: !!companyId && !!item.product_id,
  });

  const boms = (allBoms || []).filter(b => b.is_active === true || b.is_active === 'true');
  const activeBOM = boms?.[0];

  // Buscar itens do BOM se ele existir
  const { data: bomItems, isLoading: loadingBOMItems } = useQuery({
    queryKey: ['bom-items', activeBOM?.id],
    queryFn: () => activeBOM ? base44.entities.BOMItem.filter({ bom_id: activeBOM.id }) : Promise.resolve([]),
    enabled: !!activeBOM,
  });

  const hasBOM = boms && boms.length > 0;
  const remaining = item.qty - (item.qty_separated || 0);
  const isComplete = remaining <= 0;

  return (
    <div className={`p-4 rounded-lg border mb-3 ${isComplete ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-start gap-2">
          {hasBOM && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 p-0.5 hover:bg-slate-100 rounded text-slate-500"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm text-indigo-600">{item.product_sku}</p>
              {hasBOM && <Badge variant="outline" className="text-[10px] h-4 bg-indigo-50 text-indigo-700 border-indigo-200">BOM</Badge>}
            </div>
            <p className="font-medium">{item.product_name}</p>
          </div>
        </div>
        {isComplete && (
          <CheckCircle className="h-5 w-5 text-emerald-600" />
        )}
      </div>

      {!isExpanded && (
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-slate-500">Solicitado: </span>
            <span className="font-medium">{item.qty}</span>
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-slate-500">Separado: </span>
            <span className="font-medium text-emerald-600">{item.qty_separated || 0}</span>
          </div>
          {!isComplete && selectedOrder.status === 'SEPARANDO' && !hasBOM && (
            <Button
              size="sm"
              onClick={() => onSeparate(remaining)}
            >
              <Package className="h-4 w-4 mr-1" />
              Separar ({remaining})
            </Button>
          )}
          {hasBOM && !isComplete && (
            <button 
              onClick={() => setIsExpanded(true)}
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
            >
              Ver componentes para separar
            </button>
          )}
        </div>
      )}

      {isExpanded && hasBOM && (
        <div className="mt-4 pl-6 border-l-2 border-slate-100 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Explosão de Kit/BOM:</p>
          {loadingBOMItems ? (
             <div className="flex items-center gap-2 text-xs text-slate-400">
               <Loader2 className="h-3 w-3 animate-spin" />
               Carregando componentes...
             </div>
          ) : bomItems?.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Nenhum componente cadastrado neste BOM.</p>
          ) : (
            bomItems.map((comp) => {
              const neededQty = comp.quantity * item.qty;
              return (
                <div key={comp.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-dashed border-slate-200">
                  <div className="text-sm">
                    <p className="font-mono text-xs text-slate-600">{comp.component_sku}</p>
                    <p className="font-medium text-xs">{comp.component_name}</p>
                    <p className="text-[10px] text-slate-500">Necessário: <span className="font-bold">{neededQty}</span> {comp.unit || 'UN'}</p>
                  </div>
                  {!isComplete && selectedOrder.status === 'SEPARANDO' && (
                    <Button
                      size="xs"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => onSeparate(neededQty, comp)}
                    >
                      <Package className="h-3 w-3 mr-1" />
                      Separar {neededQty}
                    </Button>
                  )}
                </div>
              );
            })
          )}
          
          <div className="pt-2 flex justify-between items-center">
             <p className="text-[10px] text-slate-400">Após separar todos os componentes, marque o item principal:</p>
             <Button
                size="sm"
                variant="secondary"
                className="h-8"
                onClick={() => onSeparate(remaining)}
              >
                Concluir Item Pai
              </Button>
          </div>
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

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders-for-separation', companyId],
    queryFn: () => companyId ? base44.entities.SalesOrder.filter({ company_id: companyId, status: ['CONFIRMADO', 'RESERVADO', 'SEPARANDO'] }) : Promise.resolve([]),
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
    mutationFn: async ({ item, qty, component }) => {
      // Se for separação de um componente do BOM
      if (component) {
        // Criar movimentação de estoque para o COMPONENTE
        await base44.entities.InventoryMove.create({
          company_id: companyId,
          type: 'SEPARACAO',
          product_id: component.component_id,
          qty: qty,
          related_type: 'PEDIDO',
          related_id: item.order_id,
          reason: `Separação componente ${component.component_sku} para ${item.product_sku}`
        });

        // Opcional: Aqui poderíamos atualizar um controle específico de separação de componentes
        // Por agora, vamos apenas marcar uma fração da separação do item pai se for o último componente
        // Mas a lógica padrão é que a separação do PAI é incrementada quando o usuário confirma.
      } else {
        const newSeparated = (item.qty_separated || 0) + qty;
        await base44.entities.SalesOrderItem.update(item.id, { qty_separated: newSeparated });
        
        await base44.entities.InventoryMove.create({
          company_id: companyId,
          type: 'SEPARACAO',
          product_id: item.product_id,
          qty: qty,
          related_type: 'PEDIDO',
          related_id: item.order_id,
          reason: `Separação pedido`
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-items', selectedOrder?.id] });
      toast.success('Item separado');
    },
  });

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
                    onSeparate={(qty, component) => separateItemMutation.mutate({ item, qty, component })}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}