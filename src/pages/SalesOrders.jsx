import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Plus, Search, Eye, Edit2, Trash2, MoreHorizontal, ShoppingCart,
  CheckCircle, Package, Truck, FileText, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ClientSearchSelect from '@/components/clients/ClientSearchSelect';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';
import { Separator } from '@/components/ui/separator';
import { useCompanyId } from '@/components/useCompanyId';

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

function OrderForm({ order, clients, sellers, products, paymentConditions, onSave, onCancel, loading }) {
  const [form, setForm] = useState(order || {
    numero_pedido_externo: '',
    client_id: '',
    client_name: '',
    seller_id: '',
    seller_name: '',
    payment_condition_id: '',
    payment_condition_name: '',
    payment_terms: '',
    delivery_date: '',
    notes: '',
    status: 'RASCUNHO'
  });
  
  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState({
    product_id: '',
    qty: 1,
    unit_price: ''
  });

  const handleClientChange = (clientId) => {
    const client = clients?.find(c => c.id === clientId);
    setForm({ ...form, client_id: clientId, client_name: client?.name || '' });
  };

  const handleSellerChange = (sellerId) => {
    const seller = sellers?.find(s => s.id === sellerId);
    setForm({ ...form, seller_id: sellerId, seller_name: seller?.name || '' });
  };

  const handlePaymentConditionChange = (conditionId) => {
    const condition = paymentConditions?.find(c => c.id === conditionId);
    setForm({ ...form, payment_condition_id: conditionId, payment_condition_name: condition?.name || '' });
  };

  const handleProductChange = (productId) => {
    const product = products?.find(p => p.id === productId);
    setCurrentItem({
      ...currentItem,
      product_id: productId,
      product_sku: product?.sku || '',
      product_name: product?.name || ''
    });
  };

  const addItem = () => {
    if (!currentItem.product_id || currentItem.qty <= 0) {
      toast.error('Selecione um produto e quantidade válida');
      return;
    }
    if (!currentItem.unit_price || currentItem.unit_price <= 0) {
      toast.error('Informe o preço do produto');
      return;
    }
    const total_price = currentItem.qty * currentItem.unit_price;
    setItems([...items, { ...currentItem, total_price }]);
    setCurrentItem({ product_id: '', qty: 1, unit_price: '' });
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItemPrice = (index, newPrice) => {
    const updatedItems = [...items];
    updatedItems[index].unit_price = parseFloat(newPrice) || 0;
    updatedItems[index].total_price = updatedItems[index].qty * updatedItems[index].unit_price;
    setItems(updatedItems);
  };

  const updateItemQty = (index, newQty) => {
    const updatedItems = [...items];
    updatedItems[index].qty = parseFloat(newQty) || 0;
    updatedItems[index].total_price = updatedItems[index].qty * updatedItems[index].unit_price;
    setItems(updatedItems);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.client_id || !form.numero_pedido_externo) {
      toast.error('Cliente e Número do Pedido Externo são obrigatórios');
      return;
    }
    if (items.length === 0) {
      toast.error('Adicione pelo menos um item ao pedido');
      return;
    }
    const total_amount = items.reduce((sum, item) => sum + item.total_price, 0);
    onSave({ ...form, total_amount }, items);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Número do Pedido Externo *</Label>
        <Input
          value={form.numero_pedido_externo}
          onChange={(e) => setForm({ ...form, numero_pedido_externo: e.target.value.toUpperCase() })}
          placeholder="Ex: PED-2024-001"
        />
      </div>

      <ClientSearchSelect
        label="Cliente"
        value={form.client_id}
        onSelect={handleClientChange}
        placeholder="Digite nome, código ou CNPJ/CPF..."
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Vendedor</Label>
          <Select value={form.seller_id} onValueChange={handleSellerChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {sellers?.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Condição de Pagamento *</Label>
          <Select value={form.payment_condition_id} onValueChange={handlePaymentConditionChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {paymentConditions?.map(pc => (
                <SelectItem key={pc.id} value={pc.id}>
                  {pc.name} ({pc.installments}x)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Data de Entrega</Label>
        <Input
          type="date"
          value={form.delivery_date}
          onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Observações do pedido"
        />
      </div>

      <Separator />

      <div>
        <Label className="text-base font-semibold">Itens do Pedido</Label>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-6">
              <ProductSearchSelect
                value={currentItem.product_id}
                onSelect={handleProductChange}
                placeholder="Buscar produto..."
              />
            </div>
            <div className="col-span-2">
              <Input
                type="number"
                placeholder="Qtd"
                min="0.01"
                step="0.01"
                value={currentItem.qty}
                onChange={(e) => setCurrentItem({ ...currentItem, qty: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-3">
              <Input
                type="number"
                placeholder="Preço"
                min="0"
                step="0.01"
                value={currentItem.unit_price}
                onChange={(e) => setCurrentItem({ ...currentItem, unit_price: parseFloat(e.target.value) || '' })}
              />
            </div>
            <div className="col-span-1">
              <Button type="button" onClick={addItem} size="icon" className="w-full">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="border rounded-lg divide-y">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center p-3">
                  <div className="col-span-5">
                    <p className="font-medium text-sm">{item.product_name}</p>
                    <p className="text-xs text-slate-500">{item.product_sku}</p>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.qty}
                      onChange={(e) => updateItemQty(index, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItemPrice(index, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="font-semibold text-sm">
                      R$ {item.total_price.toFixed(2)}
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      className="h-8 w-8 text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between p-3 bg-slate-50 font-semibold">
                <span>Total</span>
                <span className="text-indigo-600">
                  R$ {items.reduce((sum, item) => sum + item.total_price, 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function SalesOrders() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [cancelWithOPsConfirm, setCancelWithOPsConfirm] = useState(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['sales-orders', companyId],
    queryFn: () => base44.entities.SalesOrder.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  const { data: sellers } = useQuery({
    queryKey: ['sellers', companyId],
    queryFn: () => base44.entities.Seller.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => base44.entities.Product.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  const { data: paymentConditions } = useQuery({
    queryKey: ['payment-conditions', companyId],
    queryFn: () => base44.entities.PaymentCondition.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async ({ orderData, items }) => {
      const orderNumber = `PED-${Date.now().toString().slice(-8)}`;
      const order = await base44.entities.SalesOrder.create({ ...orderData, company_id: companyId, order_number: orderNumber });
      
      // Criar itens
      for (const item of items) {
        await base44.entities.SalesOrderItem.create({
          company_id: companyId,
          order_id: order.id,
          product_id: item.product_id,
          product_sku: item.product_sku,
          product_name: item.product_name,
          qty: item.qty,
          unit_price: item.unit_price,
          total_price: item.total_price,
          fulfill_mode: 'AUTO'
        });
      }
      
      // Se pedido criado com status CONFIRMADO, criar ProductionRequests
      if (orderData.status === 'CONFIRMADO') {
        for (const item of items) {
          const requestNumber = `SOL-${Date.now().toString().slice(-8)}`;
          await base44.entities.ProductionRequest.create({
            company_id: companyId,
            request_number: requestNumber,
            origin_type: 'VENDA',
            origin_id: order.id,
            order_id: order.id,
            order_number: order.order_number,
            product_id: item.product_id,
            product_name: item.product_name,
            qty_requested: item.qty,
            status: 'PENDENTE',
            priority: 'NORMAL',
            due_date: orderData.delivery_date
          });
        }
      }
      
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
      queryClient.invalidateQueries({ queryKey: ['production-requests', companyId] });
      setDialogOpen(false);
      toast.success('Pedido criado com sucesso');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SalesOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
      setDialogOpen(false);
      setEditing(null);
      toast.success('Pedido atualizado com sucesso');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SalesOrder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
      setDeleteConfirm(null);
      toast.success('Pedido excluído com sucesso');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, cancelOPs }) => {
      const order = orders?.find(o => o.id === id);
      await base44.entities.SalesOrder.update(id, { status });
      
      // Se pedido passa para CONFIRMADO, criar ProductionRequest
      if (status === 'CONFIRMADO') {
        const items = await base44.entities.SalesOrderItem.filter({ company_id: companyId, order_id: id });
        if (items?.length > 0) {
          for (const item of items) {
              const requestNumber = `SOL-${Date.now().toString().slice(-8)}`;
              await base44.entities.ProductionRequest.create({
                company_id: companyId,
                request_number: requestNumber,
                origin_type: 'VENDA',
                origin_id: id,
                order_id: id,
                order_number: order?.order_number,
                product_id: item.product_id,
                product_name: item.product_name,
                qty_requested: item.qty,
                status: 'PENDENTE',
                priority: 'NORMAL',
                due_date: order?.delivery_date
              });
            }
        }
      }
      
      // Se cancelar pedido
      if (status === 'CANCELADO') {
        const requests = await base44.entities.ProductionRequest.filter({ company_id: companyId, order_id: id });

        if (requests && requests.length > 0) {
          for (const req of requests) {
            // Cancelar todas as solicitações vinculadas ao pedido
            await base44.entities.ProductionRequest.update(req.id, { status: 'CANCELADA' });

            // Cancelar OPs se solicitado
            if (cancelOPs) {
              const ops = await base44.entities.ProductionOrder.filter({ company_id: companyId, request_id: req.id });
              if (ops && ops.length > 0) {
                for (const op of ops) {
                  if (op.status !== 'ENCERRADA') {
                    await base44.entities.ProductionOrder.update(op.id, { 
                      status: 'CANCELADA',
                      cancellation_reason: 'Cancelamento do pedido de venda'
                    });
                  }
                }
              }
            } else {
              // Se manter OPs, registrar aviso
              const ops = await base44.entities.ProductionOrder.filter({ company_id: companyId, request_id: req.id });
              if (ops && ops.length > 0) {
                for (const op of ops) {
                  const currentNotes = op.notes || '';
                  const timestamp = new Date().toLocaleString('pt-BR');
                  const newNote = `[${timestamp}] AVISO: Pedido de venda foi cancelado, mas esta OP foi mantida por solicitação do usuário.`;
                  await base44.entities.ProductionOrder.update(op.id, { 
                    notes: currentNotes ? `${currentNotes}\n${newNote}` : newNote
                  });
                }
              }
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-kpi', companyId] });
      queryClient.invalidateQueries({ queryKey: ['recent-orders-widget', companyId] });
      queryClient.invalidateQueries({ queryKey: ['production-requests', companyId] });
      queryClient.invalidateQueries({ queryKey: ['production-requests-pending', companyId] });
      queryClient.invalidateQueries({ queryKey: ['production-orders', companyId] });
      toast.success('Status atualizado');
      setCancelWithOPsConfirm(null);
    },
  });

  const handleCancelOrder = async (order) => {
    const requests = await base44.entities.ProductionRequest.filter({ company_id: companyId, order_id: order.id });
    let hasOPs = false;
    
    for (const req of requests) {
      const ops = await base44.entities.ProductionOrder.filter({ company_id: companyId, request_id: req.id });
      if (ops && ops.length > 0) {
        hasOPs = true;
        break;
      }
    }
    
    if (hasOPs) {
      setCancelWithOPsConfirm(order);
    } else {
      updateStatusMutation.mutate({ id: order.id, status: 'CANCELADO' });
    }
  };

  const handleSave = (data, items) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate({ orderData: data, items });
    }
  };

  const filtered = orders?.filter(o => {
    const matchesSearch = o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pedidos de Venda</h1>
          <p className="text-slate-500">Gerencie seus pedidos de venda</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-2" />
          Novo Pedido
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por número ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div>
                        <span className="font-mono text-indigo-600 font-medium">
                          {order.order_number || `#${order.id.slice(0, 8)}`}
                        </span>
                        {order.numero_pedido_externo && (
                          <p className="text-xs text-slate-500">Ext: {order.numero_pedido_externo}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{order.client_name}</TableCell>
                    <TableCell className="text-slate-500">
                      {order.created_date ? format(new Date(order.created_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {order.delivery_date ? format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(order.total_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_CONFIG[order.status]?.color || 'bg-slate-100'}>
                        {STATUS_CONFIG[order.status]?.label || order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={createPageUrl(`SalesOrderDetail?id=${order.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </Link>
                          </DropdownMenuItem>
                          {order.status === 'RESERVADO' && (
                            <DropdownMenuItem asChild>
                              <Link to={createPageUrl(`PickingOptimized?order=${order.id}`)}>
                                <Package className="h-4 w-4 mr-2" />
                                Iniciar Separação
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {order.status === 'RASCUNHO' && (
                            <>
                              <DropdownMenuItem onClick={() => { setEditing(order); setDialogOpen(true); }}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'CONFIRMADO' })}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Confirmar
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          {order.status === 'RASCUNHO' && (
                            <DropdownMenuItem onClick={() => setDeleteConfirm(order)} className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                          {order.status !== 'CANCELADO' && order.status !== 'EXPEDIDO' && (
                            <DropdownMenuItem 
                              onClick={() => handleCancelOrder(order)}
                              className="text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancelar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Pedido' : 'Novo Pedido'}</DialogTitle>
          </DialogHeader>
          <OrderForm
            order={editing}
            clients={clients}
            sellers={sellers}
            products={products}
            paymentConditions={paymentConditions}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditing(null); }}
            loading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja excluir o pedido <strong>{deleteConfirm?.order_number}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteConfirm.id)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelWithOPsConfirm} onOpenChange={() => setCancelWithOPsConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Pedido com OPs Criadas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Este pedido tem Ordens de Produção criadas.</p>
            <p className="font-medium">O que deseja fazer?</p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                updateStatusMutation.mutate({ id: cancelWithOPsConfirm.id, status: 'CANCELADO', cancelOPs: false });
              }}
              disabled={updateStatusMutation.isPending}
            >
              Cancelar Pedido (manter OPs)
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                updateStatusMutation.mutate({ id: cancelWithOPsConfirm.id, status: 'CANCELADO', cancelOPs: true });
              }}
              disabled={updateStatusMutation.isPending}
            >
              Cancelar Tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}