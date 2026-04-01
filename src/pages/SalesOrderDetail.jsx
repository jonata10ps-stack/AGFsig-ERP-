import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useReactToPrint } from 'react-to-print';
import {
  ArrowLeft, Plus, Trash2, Package, CheckCircle, FileText, Truck, Save, Undo2, Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import OrderPrintTemplate from '@/components/sales/OrderPrintTemplate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';
import CancelOrderDialog from '@/components/sales/CancelOrderDialog';
import ReservationDialog from '@/components/sales/ReservationDialog';

const STATUS_CONFIG = {
  RASCUNHO: { color: 'bg-slate-100 text-slate-700', label: 'Rascunho' },
  CONFIRMADO: { color: 'bg-blue-100 text-blue-700', label: 'Confirmado' },
  RESERVADO: { color: 'bg-indigo-100 text-indigo-700', label: 'Reservado' },
  SEPARANDO: { color: 'bg-amber-100 text-amber-700', label: 'Separando' },
  SEPARADO: { color: 'bg-emerald-100 text-emerald-700', label: 'Separado' },
  FATURADO: { color: 'bg-purple-100 text-purple-700', label: 'Faturado' },
  EXPEDIDO: { color: 'bg-teal-100 text-teal-700', label: 'Expedido' },
  CANCELADO: { color: 'bg-rose-100 text-rose-700', label: 'Cancelado' },
};

function ItemForm({ item, products, onSave, onCancel, loading }) {
  const [form, setForm] = useState(item || {
    product_id: '',
    product_sku: '',
    product_name: '',
    cod_finame: '',
    qty: 1,
    unit_price: 0,
    fulfill_mode: 'AUTO'
  });

  const handleProductChange = (productId) => {
    const product = products?.find(p => p.id === productId);
    setForm({
      ...form,
      product_id: productId,
      product_sku: product?.sku || '',
      product_name: product?.name || '',
      cod_finame: product?.cod_finame || '',
      unit_price: product?.sale_price || 0
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.product_id || form.qty <= 0) {
      toast.error('Produto e quantidade são obrigatórios');
      return;
    }
    const total_price = form.qty * form.unit_price;
    onSave({ ...form, total_price });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ProductSearchSelect
        label="Produto"
        value={form.product_id}
        onSelect={handleProductChange}
        placeholder="Buscar por código ou descrição..."
        required
      />

      <div className="space-y-2">
        <Label>Cod. FINAME</Label>
        <Input
          value={form.cod_finame}
          onChange={(e) => setForm({ ...form, cod_finame: e.target.value.toUpperCase() })}
          placeholder="Código FINAME (opcional)"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Quantidade *</Label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Preço Unitário</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.unit_price}
            onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Modo de Atendimento</Label>
        <Select value={form.fulfill_mode} onValueChange={(v) => setForm({ ...form, fulfill_mode: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AUTO">Automático</SelectItem>
            <SelectItem value="ESTOQUE">Somente Estoque</SelectItem>
            <SelectItem value="PRODUCAO">Somente Produção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="p-3 bg-slate-50 rounded-lg">
        <p className="text-sm text-slate-600">
          Total: <span className="font-semibold">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(form.qty * form.unit_price)}
          </span>
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Adicionar'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function SalesOrderDetail() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const printRef = useRef();

  const { data: order, isLoading: loadingOrder } = useQuery({
    queryKey: ['sales-order', orderId],
    queryFn: () => base44.entities.SalesOrder.filter({ id: orderId }),
    select: (data) => data?.[0],
    enabled: !!orderId,
  });

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['sales-order-items', orderId],
    queryFn: () => base44.entities.SalesOrderItem.filter({ order_id: orderId }),
    enabled: !!orderId,
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ active: true }),
  });

  const { data: productionRequests } = useQuery({
    queryKey: ['production-requests-order', orderId],
    queryFn: () => base44.entities.ProductionRequest.filter({ origin_id: orderId }),
    enabled: !!orderId,
  });

  const { data: productionOrders } = useQuery({
    queryKey: ['production-orders-for-requests'],
    queryFn: () => base44.entities.ProductionOrder.list(),
  });

  const addItemMutation = useMutation({
    mutationFn: async (data) => {
      // Validar estoque em tempo real
      const balances = await base44.entities.StockBalance.filter({
        product_id: data.product_id
      });
      const totalAvailable = balances.reduce((sum, b) => sum + (b.qty_available || 0), 0);
      
      if (data.fulfill_mode !== 'PRODUCAO' && totalAvailable < data.qty) {
        throw new Error(`Estoque insuficiente! Disponível: ${totalAvailable}, Solicitado: ${data.qty}`);
      }
      
      await base44.entities.SalesOrderItem.create({ ...data, order_id: orderId });
      // Update order total
      const newTotal = (items || []).reduce((sum, item) => sum + (item.total_price || 0), 0) + data.total_price;
      await base44.entities.SalesOrder.update(orderId, { total_amount: newTotal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order-items', orderId] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', orderId] });
      setItemDialogOpen(false);
      toast.success('Item adicionado');
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId) => {
      const item = items?.find(i => i.id === itemId);
      await base44.entities.SalesOrderItem.delete(itemId);
      const newTotal = (items || []).filter(i => i.id !== itemId).reduce((sum, i) => sum + (i.total_price || 0), 0);
      await base44.entities.SalesOrder.update(orderId, { total_amount: newTotal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order-items', orderId] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', orderId] });
      setDeleteItemConfirm(null);
      toast.success('Item removido');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status) => {
      // Validar estoque ao confirmar pedido
      if (status === 'CONFIRMADO') {
        for (const item of items) {
          if (item.fulfill_mode !== 'PRODUCAO') {
            const balances = await base44.entities.StockBalance.filter({
              product_id: item.product_id
            });
            const totalAvailable = balances.reduce((sum, b) => sum + (b.qty_available || 0), 0);
            
            if (totalAvailable < item.qty) {
              throw new Error(`Estoque insuficiente para ${item.product_name}! Disponível: ${totalAvailable}, Solicitado: ${item.qty}`);
            }
          }
        }

        // Criar solicitações de produção para itens que requerem produção
        for (const item of items) {
          if (item.fulfill_mode === 'PRODUCAO' || item.fulfill_mode === 'AUTO') {
            await base44.entities.ProductionRequest.create({
              company_id: order.company_id,
              origin_type: 'VENDA',
              origin_id: orderId,
              order_id: orderId,
              order_number: order.order_number,
              product_id: item.product_id,
              product_name: item.product_name,
              qty_requested: item.qty,
              qty_fulfilled: 0,
              qty_residue: 0,
              priority: 'NORMAL',
              status: 'PENDENTE',
              due_date: order.delivery_date,
            });
          }
        }
      }
      
      return base44.entities.SalesOrder.update(orderId, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', orderId] });
      toast.success('Status atualizado');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const releaseReservationMutation = useMutation({
    mutationFn: async () => {
      // Buscar todas as reservas do pedido
      const reservations = await base44.entities.Reservation.filter({ order_id: orderId });
      
      // Deletar cada reserva e atualizar saldos
      for (const reservation of reservations) {
        // Buscar saldo
        const balances = await base44.entities.StockBalance.filter({
          product_id: reservation.product_id,
          location_id: reservation.location_id
        });
        
        if (balances[0]) {
          // Liberar quantidade reservada de volta para disponível
          await base44.entities.StockBalance.update(balances[0].id, {
            qty_reserved: (balances[0].qty_reserved || 0) - reservation.qty,
            qty_available: (balances[0].qty_available || 0) + reservation.qty
          });
        }
        
        // Deletar reserva
        await base44.entities.Reservation.delete(reservation.id);
      }
      
      // Zerar qty_reserved dos itens do pedido
      for (const item of items) {
        if (item.qty_reserved > 0) {
          await base44.entities.SalesOrderItem.update(item.id, { qty_reserved: 0 });
        }
      }
      
      // Voltar status para CONFIRMADO
      await base44.entities.SalesOrder.update(orderId, { status: 'CONFIRMADO' });
      
      // Log de auditoria
      await base44.entities.AuditLog.create({
        entity_type: 'SalesOrder',
        entity_id: orderId,
        action: 'LIBERACAO_RESERVA',
        details: `Reserva liberada - pedido voltou para status CONFIRMADO`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['sales-order-items', orderId] });
      toast.success('Reserva liberada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao liberar reserva: ' + error.message);
    }
  });

  const forceResetStatusMutation = useMutation({
    mutationFn: async () => {
      // Força reset para CONFIRMADO independente de ter reservas
      await base44.entities.SalesOrder.update(orderId, { status: 'CONFIRMADO' });
      
      // Zerar qty_reserved dos itens
      for (const item of items) {
        if (item.qty_reserved > 0) {
          await base44.entities.SalesOrderItem.update(item.id, { qty_reserved: 0 });
        }
      }
      
      await base44.entities.AuditLog.create({
        entity_type: 'SalesOrder',
        entity_id: orderId,
        action: 'RESET_STATUS',
        details: `Status forçado para CONFIRMADO - inconsistência detectada`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['sales-order-items', orderId] });
      toast.success('Status resetado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao resetar status: ' + error.message);
    }
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (decisions) => {
      // Encontrar quote vinculado a este pedido
      const quotes = await base44.entities.Quote.list();
      const linkedQuote = quotes?.find(q => q.converted_order_id === orderId);
      
      // Desconectar quote se houver
      if (linkedQuote) {
        await base44.entities.Quote.update(linkedQuote.id, {
          status: 'CONFIRMADO',
          converted_order_id: null,
          converted_at: null,
        });
      }

      // Processar decisões sobre solicitações de produção
      if (decisions) {
        // Cancelar solicitações pendentes
        for (const decision of decisions.pendingRequests) {
          if (decision.action === 'CANCELAR') {
            await base44.entities.ProductionRequest.update(decision.id, { status: 'CANCELADA' });
          }
        }

        // Processar OPs em andamento
        for (const decision of decisions.inProgressOps) {
          if (decision.action === 'CANCELAR' && decision.opId) {
            // Cancelar OP
            await base44.entities.ProductionOrder.update(decision.opId, {
              status: 'CANCELADA',
              cancellation_reason: 'Pedido de venda cancelado'
            });
            // Cancelar solicitação
            await base44.entities.ProductionRequest.update(decision.requestId, { status: 'CANCELADA' });
          } else if (decision.action === 'MANTER') {
            // Desconectar solicitação mas manter OP aberta
            await base44.entities.ProductionRequest.update(decision.requestId, { origin_id: null });
          }
        }

        // Processar solicitações concluídas
        for (const decision of decisions.completedRequests) {
          if (decision.action === 'ELIMINAR_RESIDUO' && decision.id) {
            // Criar movimento de baixa para o resíduo
            const request = productionRequests?.find(r => r.id === decision.id);
            if (request && request.qty_residue > 0) {
              await base44.entities.InventoryMove.create({
                company_id: order.company_id,
                type: 'BAIXA',
                product_id: request.product_id,
                qty: request.qty_residue,
                reason: 'Cancelamento de pedido - eliminação de resíduo',
                baixa_motivo: 'Cancelamento de pedido',
                related_type: 'PEDIDO',
                related_id: orderId,
              });
            }
            // Atualizar resíduo para 0
            await base44.entities.ProductionRequest.update(decision.id, { qty_residue: 0 });
          }
        }
      }
      
      // Deletar itens do pedido
      const orderItems = await base44.entities.SalesOrderItem.filter({ order_id: orderId });
      for (const item of orderItems) {
        await base44.entities.SalesOrderItem.delete(item.id);
      }
      
      // Atualizar status do pedido para CANCELADO antes de deletar
      await base44.entities.SalesOrder.update(orderId, { status: 'CANCELADO' });
      
      // Deletar pedido
      await base44.entities.SalesOrder.delete(orderId);
    },
    onSuccess: () => {
      toast.success('Pedido cancelado com sucesso!');
      setTimeout(() => window.location.href = createPageUrl('SalesOrders'), 1500);
    },
    onError: (error) => {
      toast.error('Erro ao cancelar pedido: ' + error.message);
    }
  });

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Pedido_${order?.order_number || order?.numero_pedido_externo || orderId?.slice(0, 8)}`,
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  if (loadingOrder) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Pedido não encontrado</p>
        <Link to={createPageUrl('SalesOrders')}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const canEdit = order.status === 'RASCUNHO';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('SalesOrders')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Pedido {order.order_number || `#${order.id.slice(0, 8)}`}
            </h1>
            <Badge className={STATUS_CONFIG[order.status]?.color}>
              {STATUS_CONFIG[order.status]?.label || order.status}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {items?.length > 0 && (
            <Button onClick={handlePrint} variant="outline">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          )}
           {order.status === 'RASCUNHO' && (
             <>
               <Button onClick={() => updateStatusMutation.mutate('CONFIRMADO')} className="bg-indigo-600 hover:bg-indigo-700">
                 <CheckCircle className="h-4 w-4 mr-2" />
                 Confirmar Pedido
               </Button>
               <Button onClick={() => setCancelDialogOpen(true)} variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cancelar Pedido
                </Button>
             </>
           )}
          {order.status === 'CONFIRMADO' && (
            <>
              <Button onClick={() => setReservationDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                <Package className="h-4 w-4 mr-2" />
                Reservar Estoque
              </Button>
              <Button onClick={() => setCancelDialogOpen(true)} variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Cancelar Pedido
              </Button>
            </>
          )}
          {order.status === 'RESERVADO' && (
            <>
              <Button 
                variant="outline" 
                onClick={() => releaseReservationMutation.mutate()}
                disabled={releaseReservationMutation.isPending}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Liberar Reserva
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => forceResetStatusMutation.mutate()}
                disabled={forceResetStatusMutation.isPending}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Forçar Reset
              </Button>
              <Link to={createPageUrl(`PickingOptimized?order=${orderId}`)}>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Package className="h-4 w-4 mr-2" />
                  Iniciar Separação
                </Button>
              </Link>
              <Button
                onClick={() => updateStatusMutation.mutate('FATURADO')}
                disabled={updateStatusMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                Faturar
              </Button>
              <Button
                onClick={() => updateStatusMutation.mutate('EXPEDIDO')}
                disabled={updateStatusMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Truck className="h-4 w-4 mr-2" />
                Expedir
              </Button>
            </>
          )}
          {(order.status === 'SEPARANDO' || order.status === 'SEPARADO') && (
            <>
              <Button
                variant="outline"
                onClick={() => updateStatusMutation.mutate('CONFIRMADO')}
                disabled={updateStatusMutation.isPending}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Voltar para Confirmado
              </Button>
              <Button
                onClick={() => updateStatusMutation.mutate('FATURADO')}
                disabled={updateStatusMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                Marcar como Faturado
              </Button>
              <Link to={createPageUrl('Shipping')}>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Truck className="h-4 w-4 mr-2" />
                  Ir para Expedição
                </Button>
              </Link>
            </>
          )}
          {order.status === 'FATURADO' && (
            <>
              <Button
                variant="outline"
                onClick={() => updateStatusMutation.mutate('SEPARADO')}
                disabled={updateStatusMutation.isPending}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Voltar para Separado
              </Button>
              <Button
                onClick={() => updateStatusMutation.mutate('EXPEDIDO')}
                disabled={updateStatusMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Truck className="h-4 w-4 mr-2" />
                Expedir Pedido
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informações do Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Cliente</p>
                <p className="font-medium">{order.client_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Data do Pedido</p>
                <p className="font-medium">
                  {order.created_date ? format(new Date(order.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Condição de Pagamento</p>
                <p className="font-medium">{order.payment_condition_name || order.payment_terms || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Data de Entrega</p>
                <p className="font-medium">
                  {order.delivery_date ? format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Vendedor</p>
                <p className="font-medium">{order.seller_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Observações</p>
                <p className="font-medium">{order.notes || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Itens</span>
                <span className="font-medium">{items?.length || 0}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-medium">Total</span>
                <span className="font-bold text-indigo-600">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Itens do Pedido</CardTitle>
          {canEdit && (
            <Button onClick={() => setItemDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loadingItems ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items?.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum item adicionado</p>
              {canEdit && (
                <Button onClick={() => setItemDialogOpen(true)} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar primeiro item
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cod. FINAME</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead className="text-right">Separado</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items?.map((item) => {
                  const qtyReserved = item.qty_reserved || 0;
                  const qtySeparated = item.qty_separated || 0;
                  const progress = (qtySeparated / item.qty) * 100;
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-indigo-600">{item.product_sku}</TableCell>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell>
                        {item.cod_finame ? (
                          <span className="font-mono text-xs text-slate-600">{item.cod_finame}</span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{item.qty}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={qtyReserved >= item.qty ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}>
                          {qtyReserved}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={qtySeparated >= item.qty ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                          {qtySeparated}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.total_price)}</TableCell>
                      <TableCell>
                        {qtySeparated >= item.qty ? (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completo
                          </Badge>
                        ) : qtyReserved > 0 ? (
                          <Badge className="bg-blue-100 text-blue-700">
                            <Package className="h-3 w-3 mr-1" />
                            Reservado
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pendente</Badge>
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteItemConfirm(item)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
          </DialogHeader>
          <ItemForm
            products={products}
            onSave={(data) => addItemMutation.mutate(data)}
            onCancel={() => setItemDialogOpen(false)}
            loading={addItemMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation */}
      <Dialog open={!!deleteItemConfirm} onOpenChange={() => setDeleteItemConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Item</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja remover <strong>{deleteItemConfirm?.product_name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItemConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteItemMutation.mutate(deleteItemConfirm.id)}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>

        {/* Reservation Dialog */}
        <ReservationDialog
          open={reservationDialogOpen}
          onClose={() => setReservationDialogOpen(false)}
          order={order}
          items={items || []}
        />

        {/* Cancel Order Dialog */}
        <CancelOrderDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        productionRequests={productionRequests}
        productionOrders={productionOrders}
        onConfirm={(decisions) => {
          cancelOrderMutation.mutate(decisions);
          setCancelDialogOpen(false);
        }}
        loading={cancelOrderMutation.isPending}
        />

        {/* Hidden Print Template */}
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -9999, opacity: 0, pointerEvents: 'none' }}>
          <OrderPrintTemplate ref={printRef} order={order} items={items || []} />
        </div>

        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-order, .print-order * { visibility: visible; }
            .print-order { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>
        </div>
        );
        }