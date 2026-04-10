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
  const urlParams = new URLSearchParams(window.location.search);
  const requestId = urlParams.get('id');
  const isNew = !requestId;

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState(null);
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
      
      const newRequest = await base44.entities.MaterialRequest.create({
        company_id: user.company_id,
        ...form,
        request_number: requestNumber,
        status: 'ABERTA'
      });

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
      setTimeout(() => {
        window.location.href = `?id=${newRequest.id}`;
      }, 500);
    },
    onError: (err) => {
      toast.error('Erro ao salvar solicitação: ' + err.message);
    }
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
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    const statusLabel = STATUS_CONFIG[request?.status]?.label || 'Aberta';
    
    doc.write(`
      <html>
        <head>
          <title>Solicitação - ${request?.request_number || ''}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            
            @media print {
              body { margin: 0; padding: 0; }
              @page { margin: 20mm; }
              .no-print { display: none; }
              tr { page-break-inside: avoid; }
              .footer { page-break-inside: avoid; }
            }

            body { 
              font-family: 'Inter', sans-serif; 
              color: #1e293b; 
              line-height: 1.5;
              padding: 0;
            }

            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-start;
              border-bottom: 2px solid #e2e8f0; 
              padding-bottom: 20px; 
              margin-bottom: 30px; 
            }

            .company-info h1 { 
              margin: 0; 
              font-size: 24px; 
              color: #0f172a;
              font-weight: 700;
              letter-spacing: -0.025em;
            }

            .doc-info { text-align: right; }
            .doc-info .doc-id { 
              font-size: 18px; 
              font-weight: 700; 
              color: #4f46e5;
              margin-bottom: 4px;
            }

            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin-bottom: 30px;
              background: #f8fafc;
              padding: 15px;
              border-radius: 8px;
            }

            .meta-item { font-size: 12px; }
            .meta-item strong { color: #64748b; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 2px; }
            .meta-item span { font-weight: 600; color: #1e293b; font-size: 13px; }

            table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            th { 
              background: #f1f5f9; 
              color: #475569; 
              text-transform: uppercase; 
              font-size: 10px; 
              font-weight: 700; 
              padding: 12px 10px;
              text-align: left;
              border-bottom: 2px solid #e2e8f0;
            }
            td { 
              padding: 12px 10px; 
              font-size: 11px; 
              border-bottom: 1px solid #f1f5f9;
              vertical-align: middle;
            }
            
            .sku { font-family: monospace; color: #4f46e5; font-weight: 600; }
            .qty { font-weight: 700; text-align: right; }
            .notes { color: #64748b; font-style: italic; max-width: 200px; }

            .footer { 
              margin-top: 60px; 
              display: flex; 
              justify-content: space-between; 
              gap: 40px;
            }
            .sign-box { 
              flex: 1;
              border-top: 1px solid #cbd5e1; 
              padding-top: 8px; 
              text-align: center; 
              font-size: 10px;
              color: #64748b;
            }

            .badge {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              background: #e2e8f0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <h1>AGF EQUIPAMENTOS</h1>
              <p style="font-size: 11px; color: #64748b; margin-top: 4px;">Solicitação de Materiais Interna</p>
            </div>
            <div class="doc-info">
              <div class="doc-id">${request?.request_number || ''}</div>
              <div class="badge">${statusLabel}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <strong>Solicitante</strong>
              <span>${request?.requester || form.requester || 'Não informado'}</span>
            </div>
            <div class="meta-item">
              <strong>Departamento</strong>
              <span>${request?.department || form.department || 'Não informado'}</span>
            </div>
            <div class="meta-item">
              <strong>Prioridade</strong>
              <span>${form.priority || 'NORMAL'}</span>
            </div>
            <div class="meta-item">
              <strong>Data de Emissão</strong>
              <span>${format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th width="15%">SKU</th>
                <th width="40%">Produto</th>
                <th width="10%" style="text-align:right">Solicitado</th>
                <th width="10%" style="text-align:right">Recebido</th>
                <th width="10%" style="text-align:right">Pendente</th>
                <th width="15%">Observações</th>
              </tr>
            </thead>
            <tbody>
              ${(items || []).map(item => `
                <tr>
                  <td class="sku">${item.product_sku || 'N/A'}</td>
                  <td style="font-weight: 600;">${item.product_name || 'Item sem nome'}</td>
                  <td class="qty">${item.qty_requested || 0}</td>
                  <td class="qty">${item.qty_received || 0}</td>
                  <td class="qty" style="color: ${(item.qty_pending ?? item.qty_requested) > 0 ? '#b45309' : '#059669'}">
                    ${item.qty_pending ?? item.qty_requested}
                  </td>
                  <td class="notes">${item.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 30px; font-size: 11px;">
            <strong style="color: #64748b; font-size: 10px; display: block; margin-bottom: 5px;">Observações Gerais:</strong>
            <p>${form.notes || 'Sem observações adicionais.'}</p>
          </div>

          <div class="footer">
            <div class="sign-box">
              <strong>${request?.requester || form.requester || 'Solicitante'}</strong><br/>
              Assinatura do Solicitante
            </div>
            <div class="sign-box">
              <strong>Almoxarifado</strong><br/>
              Conferência e Recebimento
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();
    
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
    }, 1000);
  };

  if (loadingRequest && requestId) {
    return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  }

  const canEdit = isNew || request?.status === 'ABERTA' || request?.status === 'PARCIAL';
  const pendingItems = items?.filter(item => (item.qty_pending ?? item.qty_requested) > 0) || [];

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

      <div className="grid gap-6">
        {canEdit && (
          <Card>
            <CardHeader>
              <CardTitle>Informações da Solicitação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            ) : items?.length === 0 ? (
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
                    {canEdit && <TableHead className="w-12"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((item, index) => (
                    <TableRow key={item.id || index}>
                      <TableCell className="font-mono text-indigo-600">{item.product_sku}</TableCell>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-right">{item.qty_requested}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-blue-50">
                          {item.qty_received || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={(item.qty_pending ?? item.qty_requested) > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>
                          {item.qty_pending ?? item.qty_requested}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.notes || '-'}</TableCell>
                      {canEdit && (
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
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}