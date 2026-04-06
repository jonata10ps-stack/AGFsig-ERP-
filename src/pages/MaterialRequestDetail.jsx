import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  ArrowLeft, Plus, Trash2, Save, Printer, Package, CheckSquare, XCircle, Ban
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { QRCodeSVG } from 'qrcode.react';
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
import { Textarea } from '@/components/ui/textarea';
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
import QRScanner from '@/components/scanner/QRScanner';

const STATUS_CONFIG = {
  ABERTA: { color: 'bg-blue-100 text-blue-700', label: 'Aberta' },
  PARCIAL: { color: 'bg-amber-100 text-amber-700', label: 'Parcial' },
  ATENDIDA: { color: 'bg-emerald-100 text-emerald-700', label: 'Atendida' },
  CANCELADA: { color: 'bg-rose-100 text-rose-700', label: 'Cancelada' },
};

function ItemDialog({ open, onClose, products, onSave }) {
  const [form, setForm] = useState({
    product_id: '',
    product_sku: '',
    product_name: '',
    qty_requested: 1,
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.product_id || form.qty_requested <= 0) {
      toast.error('Produto e quantidade são obrigatórios');
      return;
    }
    onSave({
      ...form,
      qty_pending: form.qty_requested
    });
    setForm({ product_id: '', product_sku: '', product_name: '', qty_requested: 1, notes: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <QRScanner
              onScan={(code) => {
                const product = products?.find(p => p.sku === code);
                if (product) {
                  setForm({ 
                    ...form, 
                    product_id: product.id,
                    product_sku: product.sku,
                    product_name: product.name 
                  });
                  toast.success(`Produto ${product.sku} selecionado`);
                } else {
                  toast.error('Produto não encontrado');
                }
              }}
              placeholder="Escaneie o produto"
            />
            <ProductSearchSelect
              label="Ou busque manualmente"
              value={form.product_id}
              onSelect={(id, product) => setForm({ 
                ...form, 
                product_id: id,
                product_sku: product?.sku || '',
                product_name: product?.name || ''
              })}
              placeholder="Buscar por código ou descrição..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Quantidade *</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={form.qty_requested}
              onChange={(e) => setForm({ ...form, qty_requested: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ex: Urgente, cor específica..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Adicionar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MaterialRequestDetail() {
  const queryClient = useQueryClient();
  const printRef = useRef();
  const urlParams = new URLSearchParams(window.location.search);
  const requestId = urlParams.get('id');
  const isNew = !requestId;

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState(null);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [labelsDialogOpen, setLabelsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    description: '',
    requester: '',
    department: '',
    priority: 'NORMAL',
    needed_date: '',
    notes: ''
  });
  const [items, setItems] = useState([]);

  const { data: request, isLoading: loadingRequest } = useQuery({
    queryKey: ['material-request', requestId],
    queryFn: () => base44.entities.MaterialRequest.filter({ id: requestId }).then(r => r?.[0]),
    enabled: !!requestId,
  });

  const { data: requestItems, isLoading: loadingItems } = useQuery({
    queryKey: ['material-request-items', requestId],
    queryFn: () => base44.entities.MaterialRequestItem.filter({ request_id: requestId }),
    enabled: !!requestId,
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ active: true }),
  });

  React.useEffect(() => {
    if (request) setForm(request);
    if (requestItems) setItems(requestItems);
  }, [request, requestItems]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (items.length === 0) {
        throw new Error('Adicione pelo menos um item');
      }

      const user = await base44.auth.me();
      const requestNumber = `SOL-${Date.now().toString().slice(-8)}`;
      
      // 1. Criar a Solicitação
      const newRequest = await base44.entities.MaterialRequest.create({
        company_id: user.company_id,
        ...form,
        request_number: requestNumber,
        status: 'ABERTA'
      });

      // 2. Criar os Itens com colunas explícitas para garantir persistência
      const itemsToCreate = items.map(item => ({ 
        company_id: user.company_id,
        request_id: newRequest.id,
        product_id: item.product_id,
        product_sku: item.product_sku,
        product_name: item.product_name,
        qty_requested: item.qty_requested,
        qty_received: 0,
        qty_pending: item.qty_requested,
        notes: item.notes || ''
      }));

      await base44.entities.MaterialRequestItem.bulkCreate(itemsToCreate);

      return newRequest;
    },
    onSuccess: (newRequest) => {
      queryClient.invalidateQueries({ queryKey: ['material-requests'] });
      toast.success('Solicitação salva com sucesso');
      // Forçar recarregamento para entrar no modo de edição com o novo ID
      setTimeout(() => {
        window.location.href = `?id=${newRequest.id}`;
      }, 500);
    },
    onError: (err) => {
      toast.error('Erro ao salvar solicitação: ' + err.message);
      console.error('Save error:', err);
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }) => base44.entities.MaterialRequestItem.update(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-request-items', requestId] });
      toast.success('Item atualizado');
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId) => base44.entities.MaterialRequestItem.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-request-items', requestId] });
      setDeleteItemConfirm(null);
      toast.success('Item removido');
    },
  });

  const addItemToRequestMutation = useMutation({
    mutationFn: async (item) => {
      const user = await base44.auth.me();
      return await base44.entities.MaterialRequestItem.create({
        company_id: user.company_id,
        ...item,
        request_id: requestId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-request-items', requestId] });
      setItemDialogOpen(false);
      toast.success('Item adicionado');
    },
  });

  const clearResidueMutation = useMutation({
    mutationFn: (itemId) => base44.entities.MaterialRequestItem.update(itemId, { qty_pending: 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-request-items', requestId] });
      toast.success('Resíduo limpo');
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.MaterialRequest.update(requestId, { status: 'CANCELADA' });
      // Também marcar itens como pendência zero
      if (items.length > 0) {
        await Promise.all(items.map(item => 
          base44.entities.MaterialRequestItem.update(item.id, { qty_pending: 0 })
        ));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['material-request-items', requestId] });
      toast.success('Solicitação cancelada');
    },
  });

  const clearAllResiduesMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.MaterialRequest.update(requestId, { status: 'ATENDIDA' });
      if (items.length > 0) {
        await Promise.all(items.map(item => 
          base44.entities.MaterialRequestItem.update(item.id, { qty_pending: 0 })
        ));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['material-request-items', requestId] });
      toast.success('Todos os resíduos foram limpos e solicitação encerrada');
    },
  });

  const handleAddItem = (item) => {
    if (requestId) {
      addItemToRequestMutation.mutate(item);
    } else {
      setItems([...items, item]);
      setItemDialogOpen(false);
      toast.success('Item adicionado');
    }
  };

  const handleRemoveItem = (index, itemId) => {
    if (itemId) {
      deleteItemMutation.mutate(itemId);
    } else {
      setItems(items.filter((_, i) => i !== index));
      setDeleteItemConfirm(null);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Solicitação de Materiais</title>');
    printWindow.document.write('<style>body{font-family:Arial;padding:20px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:8px;text-align:left;}.header{margin-bottom:20px;}.title{font-size:20px;font-weight:bold;margin-bottom:10px;}</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(printRef.current.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  if (loadingRequest && requestId) {
    return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  }

  const canEdit = isNew || request?.status === 'ABERTA' || request?.status === 'PARCIAL';
  const displayItems = items; // Usar o estado 'items' que já é sincronizado pelo useEffect

  const pendingItems = displayItems?.filter(item => (item.qty_pending ?? item.qty_requested) > 0) || [];

  const handleReceiveItems = () => {
    if (selectedItems.length === 0) {
      toast.error('Selecione pelo menos um item para receber');
      return;
    }
    // Redireciona para recebimento com IDs selecionados
    const selectedIds = selectedItems.map(i => i.id).join(',');
    window.location.href = createPageUrl(`InventoryReceive?request=${requestId}&items=${selectedIds}`);
  };

  const toggleItemSelection = (item) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('MaterialRequests')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isNew ? 'Nova Solicitação' : `Solicitação ${request?.request_number}`}
            </h1>
            {request && (
              <Badge className={STATUS_CONFIG[request.status]?.color}>
                {STATUS_CONFIG[request.status]?.label}
              </Badge>
            )}
          </div>
        </div>
          <div className="flex gap-2">
            {!isNew && request?.status !== 'CANCELADA' && (
              <>
                <Button onClick={handlePrint} variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
                {request?.status !== 'ATENDIDA' && (
                  <>
                    <Button 
                      variant="outline" 
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        if (confirm('Tem certeza que deseja CALCELAR esta solicitação?')) {
                          cancelRequestMutation.mutate();
                        }
                      }}
                      disabled={cancelRequestMutation.isPending}
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      {cancelRequestMutation.isPending ? 'Cancelando...' : 'Cancelar Solicitação'}
                    </Button>
                    <Link to={createPageUrl(`InventoryReceive?request=${requestId}`)}>
                      <Button className="bg-emerald-600 hover:bg-emerald-700">
                        <Package className="h-4 w-4 mr-2" />
                        Receber
                      </Button>
                    </Link>
                  </>
                )}
              </>
            )}
            {isNew && (
              <Button 
                onClick={() => saveMutation.mutate()} 
                disabled={saveMutation.isPending || items.length === 0}
                className="bg-slate-900 text-white"
              >
                {saveMutation.isPending ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Gravando Solicitação...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Solicitação
                  </>
                )}
              </Button>
            )}
            {!isNew && request?.status === 'PARCIAL' && pendingItems.length > 0 && (
              <Button 
                variant="outline"
                className="text-amber-700 border-amber-200 hover:bg-amber-50"
                onClick={() => {
                  if (confirm('Deseja encerrar esta solicitação e limpar todos os resíduos pendentes?')) {
                    clearAllResiduesMutation.mutate();
                  }
                }}
                disabled={clearAllResiduesMutation.isPending}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                {clearAllResiduesMutation.isPending ? 'Limpando...' : 'Limpar Resíduos'}
              </Button>
            )}
          </div>
      </div>

      {/* Print Template */}
      <div ref={printRef} className="hidden print:block">
        <div className="header">
          <div className="title">Solicitação de Materiais - {request?.request_number}</div>
          <div>Solicitante: {request?.requester || form.requester}</div>
          <div>Departamento: {request?.department || form.department}</div>
          <div>Data: {format(new Date(), 'dd/MM/yyyy')}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produto</th>
              <th>Qtd Solicitada</th>
              <th>Qtd Recebida</th>
              <th>Qtd Pendente</th>
              <th>Obs</th>
            </tr>
          </thead>
          <tbody>
            {displayItems?.map((item, i) => (
              <tr key={i}>
                <td>{item.product_sku}</td>
                <td>{item.product_name}</td>
                <td>{item.qty_requested}</td>
                <td>{item.qty_received || 0}</td>
                <td>{item.qty_pending || item.qty_requested}</td>
                <td>{item.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Informações da Solicitação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ex: Materiais para produção"
                />
              </div>
              <div className="space-y-2">
                <Label>Solicitante</Label>
                <Input
                  value={form.requester}
                  onChange={(e) => setForm({ ...form, requester: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BAIXA">Baixa</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="URGENTE">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Necessária</Label>
                <Input
                  type="date"
                  value={form.needed_date}
                  onChange={(e) => setForm({ ...form, needed_date: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Itens Solicitados</CardTitle>
          {canEdit && (
            <Button onClick={() => setItemDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loadingItems ? (
            <div className="p-6"><Skeleton className="h-32 w-full" /></div>
          ) : displayItems?.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">Nenhum item adicionado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd Solicitada</TableHead>
                  <TableHead className="text-right">Qtd Recebida</TableHead>
                  <TableHead className="text-right">Qtd Pendente</TableHead>
                  <TableHead>Observações</TableHead>
                  {(!isNew && request?.status !== 'CANCELADA') && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayItems?.map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell className="font-mono text-indigo-600">{item.product_sku}</TableCell>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell className="text-right">{item.qty_requested}</TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-blue-100 text-blue-700">
                        {item.qty_received || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={(item.qty_pending || item.qty_requested) > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>
                        {item.qty_pending ?? item.qty_requested}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.notes || '-'}</TableCell>
                    {isNew ? (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(index, null)}
                          className="text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    ) : canEdit && request?.status !== 'ATENDIDA' ? (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteItemConfirm({ id: item.id, index })}
                          className="text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    ) : request?.status !== 'CANCELADA' && (item.qty_pending > 0) && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => clearResidueMutation.mutate(item.id)}
                          className="text-xs text-red-600"
                        >
                          Limpar Resíduo
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Receiving Section */}
      {!isNew && pendingItems.length > 0 && request?.status !== 'CANCELADA' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Itens para Recebimento</CardTitle>
            <Button 
              onClick={handleReceiveItems}
              disabled={selectedItems.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Package className="h-4 w-4 mr-2" />
              Gerar Etiquetas ({selectedItems.length})
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd Pendente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingItems.map((item) => {
                  const isSelected = selectedItems.find(i => i.id === item.id);
                  return (
                    <TableRow 
                      key={item.id} 
                      className={isSelected ? 'bg-emerald-50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={!!isSelected}
                          onCheckedChange={() => toggleItemSelection(item)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-indigo-600">{item.product_sku}</TableCell>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-amber-100 text-amber-700">
                          {item.qty_pending ?? item.qty_requested}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ItemDialog
        open={itemDialogOpen}
        onClose={() => setItemDialogOpen(false)}
        products={products}
        onSave={handleAddItem}
      />

      <Dialog open={!!deleteItemConfirm} onOpenChange={() => setDeleteItemConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja remover este item da solicitação?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItemConfirm(null)}>Cancelar</Button>
            <Button 
              variant="destructive" 
              onClick={() => handleRemoveItem(deleteItemConfirm.index, deleteItemConfirm.id)}
              disabled={deleteItemMutation.isPending}
            >
              {deleteItemMutation.isPending ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Labels Dialog */}
      <Dialog open={labelsDialogOpen} onOpenChange={setLabelsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Etiquetas de Recebimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button 
              onClick={() => window.print()} 
              className="w-full print:hidden"
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Etiquetas
            </Button>
            
            <div className="grid grid-cols-2 gap-4 print:grid-cols-3">
              {selectedItems.map((item) => (
                <div 
                  key={item.id} 
                  className="border-2 border-slate-300 rounded-lg p-4 print:border-black print:break-inside-avoid"
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <QRCodeSVG 
                      value={item.product_sku} 
                      size={120} 
                      level="M"
                    />
                    <div className="w-full">
                      <p className="text-xs text-slate-500">SKU</p>
                      <p className="font-mono font-bold text-sm">{item.product_sku}</p>
                    </div>
                    <div className="w-full">
                      <p className="text-xs text-slate-500">Produto</p>
                      <p className="font-medium text-xs">{item.product_name}</p>
                    </div>
                    <div className="w-full border-t pt-2 mt-2">
                      <p className="text-xs text-slate-400">Qtd: ____________</p>
                      <p className="text-xs text-slate-400 mt-1">Local: ____________</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}