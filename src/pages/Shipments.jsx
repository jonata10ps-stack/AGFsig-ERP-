import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Plus, Search, Eye, Edit2, Trash2, MoreHorizontal, Truck,
  CheckCircle, Package, ArrowRight, XCircle, RotateCcw,
  AlertCircle, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ClientSearchSelect from '@/components/clients/ClientSearchSelect';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';
import { Separator } from '@/components/ui/separator';
import { useCompanyId } from '@/components/useCompanyId';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  RASCUNHO: { color: 'bg-slate-100 text-slate-700', label: 'Rascunho' },
  CONFIRMADO: { color: 'bg-blue-100 text-blue-700', label: 'Confirmado' },
  SEPARANDO: { color: 'bg-amber-100 text-amber-700', label: 'Separando' },
  SEPARADO: { color: 'bg-emerald-100 text-emerald-700', label: 'Separado' },
  EXPEDIDO: { color: 'bg-teal-100 text-teal-700', label: 'Expedido' },
  CANCELADO: { color: 'bg-rose-100 text-rose-700', label: 'Cancelado' },
};

const SHIPMENT_TYPES = [
  { value: 'DEMONSTRACAO', label: 'Demonstração' },
  { value: 'MOSTRUARIO', label: 'Mostruário' },
  { value: 'GARANTIA', label: 'Garantia' },
  { value: 'CONSERTO', label: 'Remessa para Conserto' },
  { value: 'OUTROS', label: 'Outros' },
];

function ShipmentForm({ order, initialItems = [], clients, products, onSave, onCancel, loading }) {
  const [form, setForm] = useState(order || {
    numero_pedido_externo: '',
    client_id: '',
    client_name: '',
    delivery_date: '',
    notes: '',
    status: 'RASCUNHO',
    is_shipment: true,
    shipment_type: 'DEMONSTRACAO',
    moves_stock: true,
    requires_return: false
  });
  
  const [items, setItems] = useState(initialItems);
  const [currentItem, setCurrentItem] = useState({
    product_id: '',
    qty: 1,
    unit_price: 0
  });

  // Sincronizar itens iniciais quando carregados (edição)
  useEffect(() => {
    if (initialItems?.length > 0) {
      setItems(initialItems);
    }
  }, [initialItems]);

  const handleClientChange = (clientId) => {
    const client = clients?.find(c => c.id === clientId);
    setForm({ ...form, client_id: clientId, client_name: client?.name || '' });
  };

  const handleProductChange = (productId) => {
    const product = products?.find(p => p.id === productId);
    setCurrentItem({
      ...currentItem,
      product_id: productId,
      product_sku: product?.sku || '',
      product_name: product?.name || '',
      unit_price: product?.cost_price || 0
    });
  };

  const addItem = () => {
    if (!currentItem.product_id || currentItem.qty <= 0) {
      toast.error('Selecione um produto e quantidade válida');
      return;
    }
    const total_price = currentItem.qty * currentItem.unit_price;
    setItems([...items, { ...currentItem, total_price }]);
    setCurrentItem({ product_id: '', qty: 1, unit_price: 0 });
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.client_id) {
      toast.error('Destinatário é obrigatório');
      return;
    }
    if (items.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }
    const total_amount = items.reduce((sum, item) => sum + item.total_price, 0);
    onSave({ ...form, total_amount }, items);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Remessa</Label>
          <Select 
            value={form.shipment_type} 
            onValueChange={(v) => setForm({ ...form, shipment_type: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {SHIPMENT_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Referência Externa (Opcional)</Label>
          <Input
            value={form.numero_pedido_externo}
            onChange={(e) => setForm({ ...form, numero_pedido_externo: e.target.value.toUpperCase() })}
            placeholder="Ex: NF-123"
          />
        </div>
      </div>

      <ClientSearchSelect
        label="Destinatário (Cliente)"
        value={form.client_id}
        onSelect={handleClientChange}
        placeholder="Digite nome, código ou CNPJ/CPF..."
        required
      />

      <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-bold">Movimenta Estoque?</Label>
            <p className="text-xs text-slate-500">Se desativado, não baixará saldo no Kardex.</p>
          </div>
          <Switch 
            checked={form.moves_stock} 
            onCheckedChange={(v) => setForm({ ...form, moves_stock: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-bold">Exige Retorno?</Label>
            <p className="text-xs text-slate-500">Habilita controle no menu de Retornos.</p>
          </div>
          <Switch 
            checked={form.requires_return} 
            onCheckedChange={(v) => setForm({ ...form, requires_return: v })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Data Solicitada</Label>
        <Input
          type="date"
          value={form.delivery_date}
          onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
        />
      </div>

      <Separator />

      <div>
        <Label className="text-base font-semibold">Itens da Remessa</Label>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-8">
              <ProductSearchSelect
                value={currentItem.product_id}
                onSelect={handleProductChange}
                placeholder="Buscar produto..."
              />
            </div>
            <div className="col-span-3">
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Qtd"
                  value={currentItem.qty}
                  onChange={(e) => setCurrentItem({ ...currentItem, qty: parseFloat(e.target.value) || 0 })}
                  className="pr-8"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">un</span>
              </div>
            </div>
            <div className="col-span-1">
              <Button type="button" onClick={addItem} size="icon" className="w-full bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="border rounded-lg divide-y bg-white/50">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 hover:bg-white transition-colors">
                  <div className="col-span-8">
                    <p className="font-bold text-sm text-slate-900">{item.product_name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{item.product_sku}</p>
                  </div>
                  <div className="col-span-3 text-right">
                    <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {item.qty} un
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      className="h-8 w-8 text-slate-300 hover:text-rose-500 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="border-slate-200">Cancelar</Button>
        <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">
          {loading ? (
             <span className="flex items-center gap-2">
               <Package className="h-4 w-4 animate-bounce" /> Salvando...
             </span>
          ) : order?.id ? 'Atualizar Remessa' : 'Criar Remessa'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function Shipments() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  const { data: shipments, isLoading } = useQuery({
    queryKey: ['shipments', companyId],
    queryFn: () => base44.entities.SalesOrder.filter({ company_id: companyId, is_shipment: true }, '-created_date'),
    enabled: !!companyId,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => base44.entities.Product.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  const { data: editingItems } = useQuery({
    queryKey: ['shipment-items', editingOrder?.id],
    queryFn: () => base44.entities.SalesOrderItem.filter({ order_id: editingOrder.id }),
    enabled: !!editingOrder?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ orderData, items }) => {
      let order;
      if (editingOrder?.id) {
        // Atualizar existente
        order = await base44.entities.SalesOrder.update(editingOrder.id, orderData);
        
        // Substituir itens de forma otimizada com única chamada ao banco
        await base44.entities.SalesOrderItem.deleteBy({ order_id: editingOrder.id });
      } else {
        // Criar novo
        const orderNumber = `REM-${Date.now().toString().slice(-8)}`;
        order = await base44.entities.SalesOrder.create({ 
          ...orderData, 
          company_id: companyId, 
          order_number: orderNumber,
          status: 'RASCUNHO'
        });
      }
      
      // Criar itens
      // Criar itens em lote (bulk) para performance
      if (items && items.length > 0) {
        await base44.entities.SalesOrderItem.bulkCreate(items.map(item => ({
          company_id: companyId,
          order_id: order.id,
          product_id: item.product_id,
          product_sku: item.product_sku,
          product_name: item.product_name,
          qty: item.qty,
          unit_price: item.unit_price || 0,
          total_price: (item.qty * (item.unit_price || 0)),
          qty_returned: 0
        })));
      }
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', companyId] });
      setDialogOpen(false);
      setEditingOrder(null);
      toast.success(editingOrder?.id ? 'Remessa atualizada' : 'Remessa criada com sucesso');
    },
    onError: (err) => {
       toast.error('Erro ao salvar remessa: ' + err.message);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.SalesOrder.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', companyId] });
      toast.success('Status atualizado');
    },
  });

  const handleSave = (data, items) => {
    saveMutation.mutate({ orderData: data, items });
  };

  const handleEdit = (shipment) => {
    setEditingOrder(shipment);
    setDialogOpen(true);
  };

  const filtered = shipments?.filter(s => 
    s.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-indigo-950">Gestão de Remessas</h1>
          <div className="flex items-center gap-2 text-slate-500 mt-1">
             <Truck className="h-4 w-4" />
             <span>Demonstrações, garantias e consertos</span>
          </div>
        </div>
        <Button onClick={() => { setEditingOrder(null); setDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100">
          <Plus className="h-4 w-4 mr-2" />
          Nova Remessa
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por número ou destinatário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-sm border-slate-200 focus:ring-indigo-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0 text-slate-600">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/50">
              <Truck className="h-12 w-12 mx-auto text-slate-200 mb-4" />
              <p className="text-slate-500 font-medium">Nenhuma remessa encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="py-4 px-6 text-xs font-bold uppercase tracking-wider">Número / Tipo</TableHead>
                  <TableHead className="py-4 px-6 text-xs font-bold uppercase tracking-wider">Destinatário</TableHead>
                  <TableHead className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-center">Configurações</TableHead>
                  <TableHead className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-center">Status</TableHead>
                  <TableHead className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-right w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((shipment) => (
                  <TableRow key={shipment.id} className="hover:bg-indigo-50/30 transition-colors">
                    <TableCell className="px-6">
                      <div className="flex flex-col">
                        <span className="font-mono text-indigo-600 font-bold text-sm tracking-tight">
                          {shipment.order_number}
                        </span>
                        <Badge variant="secondary" className="w-fit text-[9px] mt-1.5 uppercase font-extrabold tracking-widest px-1.5 py-0">
                          {SHIPMENT_TYPES.find(t => t.value === shipment.shipment_type)?.label || shipment.shipment_type}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="px-6">
                       <span className="font-bold text-slate-800 text-sm">{shipment.client_name}</span>
                       {shipment.numero_pedido_externo && (
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                             <History className="h-3 w-3" /> {shipment.numero_pedido_externo}
                          </div>
                       )}
                    </TableCell>
                    <TableCell className="px-6">
                      <div className="flex justify-center gap-1.5">
                        <Badge variant="outline" className={cn(
                          "text-[10px] px-2 py-0",
                          shipment.moves_stock ? "border-indigo-200 text-indigo-700 bg-indigo-50" : "border-slate-200 text-slate-400 bg-slate-50"
                        )}>
                          {shipment.moves_stock ? "Estoque" : "Admin"}
                        </Badge>
                        {shipment.requires_return && (
                          <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-700 bg-amber-50">
                            Exige Retorno
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 text-center">
                      <Badge className={cn("text-[10px] font-bold uppercase px-2", STATUS_CONFIG[shipment.status]?.color)}>
                        {STATUS_CONFIG[shipment.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover:bg-slate-100 rounded-full">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem asChild>
                            <Link to={createPageUrl(`SalesOrderDetail?id=${shipment.id}`)}>
                              <Eye className="h-4 w-4 mr-2 text-slate-400" />
                              Ver Detalhes
                            </Link>
                          </DropdownMenuItem>
                          
                          {shipment.status === 'RASCUNHO' && (
                            <>
                              <DropdownMenuItem onClick={() => handleEdit(shipment)}>
                                <Edit2 className="h-4 w-4 mr-2 text-indigo-400" />
                                Editar Rascunho
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-indigo-600 font-semibold"
                                onClick={() => updateStatusMutation.mutate({ id: shipment.id, status: 'CONFIRMADO' })}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Confirmar Pedido
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {(shipment.status === 'SEPARADO' || shipment.status === 'CONFIRMADO') && (
                            <DropdownMenuItem asChild>
                              <Link to={createPageUrl(`Shipping?order=${shipment.id}`)} className="text-emerald-600 font-semibold">
                                <Truck className="h-4 w-4 mr-2" />
                                Ir para Expedição
                              </Link>
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

      <Dialog open={dialogOpen} onOpenChange={(val) => { 
        if (!val) { setEditingOrder(null); }
        setDialogOpen(val); 
      }}>
        <DialogContent className="max-w-4xl p-0 gap-0 flex flex-col max-h-[90vh]" aria-describedby={undefined}>
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-400" />
              {editingOrder ? `Editando Remessa ${editingOrder.order_number}` : 'Nova Remessa de Saída'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
            <ShipmentForm
              order={editingOrder}
              initialItems={editingItems}
              clients={clients}
              products={products}
              onSave={handleSave}
              onCancel={() => { setDialogOpen(false); setEditingOrder(null); }}
              loading={saveMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
