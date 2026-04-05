import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  ArrowLeft, Plus, Trash2, Package, CheckCircle, AlertCircle, Save
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';
import WarehouseSearchSelect from '@/components/warehouses/WarehouseSearchSelect';
import { executeInventoryTransaction } from '@/utils/inventoryTransactionUtils';
import { Edit2, X, RefreshCw, Warehouse } from 'lucide-react';

const STATUS_CONFIG = {
  ABERTA: { color: 'bg-blue-100 text-blue-700', label: 'Aberta' },
  RECEBIDA: { color: 'bg-amber-100 text-amber-700', label: 'Recebida' },
  ANALISADA: { color: 'bg-purple-100 text-purple-700', label: 'Analisada' },
  APROVADA: { color: 'bg-emerald-100 text-emerald-700', label: 'Aprovada' },
  REJEITADA: { color: 'bg-rose-100 text-rose-700', label: 'Rejeitada' },
  FECHADA: { color: 'bg-slate-100 text-slate-700', label: 'Fechada' },
};

const CONDITION_CONFIG = {
  NOVO: { color: 'bg-emerald-100 text-emerald-700', label: 'Novo' },
  BOM: { color: 'bg-blue-100 text-blue-700', label: 'Bom' },
  DANIFICADO: { color: 'bg-amber-100 text-amber-700', label: 'Danificado' },
  INUTILIZAVEL: { color: 'bg-rose-100 text-rose-700', label: 'Inutilizável' },
};

function AddItemDialog({ open, onOpenChange, products, onAdd, loading }) {
  const [form, setForm] = useState({
    product_id: '',
    product_sku: '',
    product_name: '',
    qty: 1,
    unit_price: 0,
    condition: 'BOM',
    serial_number: '',
    item_notes: ''
  });

  const handleProductChange = (productId) => {
    const product = products?.find(p => p.id === productId);
    setForm({
      ...form,
      product_id: productId,
      product_sku: product?.sku || '',
      product_name: product?.name || '',
      unit_price: product?.sale_price || 0
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.product_id || form.qty <= 0) {
      toast.error('Produto e quantidade são obrigatórios');
      return;
    }
    onAdd(form);
    setForm({
      product_id: '',
      product_sku: '',
      product_name: '',
      qty: 1,
      unit_price: 0,
      condition: 'BOM',
      serial_number: '',
      item_notes: ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Item à Devolução</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ProductSearchSelect
            label="Produto"
            value={form.product_id}
            onSelect={handleProductChange}
            placeholder="Buscar produto..."
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantidade</Label>
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
            <Label>Condição do Produto</Label>
            <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NOVO">Novo</SelectItem>
                <SelectItem value="BOM">Bom</SelectItem>
                <SelectItem value="DANIFICADO">Danificado</SelectItem>
                <SelectItem value="INUTILIZAVEL">Inutilizável</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Número de Série (Se houver)</Label>
            <Input
              value={form.serial_number}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
              placeholder="Digite o número de série..."
            />
          </div>

          <div className="space-y-2">
            <Label>Notas do Item</Label>
            <Input
              value={form.item_notes}
              onChange={(e) => setForm({ ...form, item_notes: e.target.value })}
              placeholder="Observações específicas..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ReturnDetail() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const returnId = urlParams.get('id');

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

  const { data: returnData, isLoading: loadingReturn } = useQuery({
    queryKey: ['return', returnId],
    queryFn: () => base44.entities.Return.filter({ id: returnId }),
    select: (data) => {
      const resp = data?.[0];
      if (resp && Object.keys(formData).length === 0) {
        setFormData({
          reason: resp.reason || '',
          reason_description: resp.reason_description || '',
          return_date: resp.return_date || '',
          notes: resp.notes || '',
          warehouse_id: resp.warehouse_id || ''
        });
        setSelectedWarehouseId(resp.warehouse_id || '');
      }
      return resp;
    },
    enabled: !!returnId,
  });

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['return-items', returnId],
    queryFn: () => base44.entities.ReturnItem.filter({ return_id: returnId }),
    enabled: !!returnId,
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ active: true }),
  });

  const addItemMutation = useMutation({
    mutationFn: async (data) => {
      await base44.entities.ReturnItem.create({ ...data, return_id: returnId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-items', returnId] });
      setItemDialogOpen(false);
      toast.success('Item adicionado');
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId) => base44.entities.ReturnItem.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-items', returnId] });
      setDeleteItemConfirm(null);
      toast.success('Item removido');
    },
  });

  const updateReturnMutation = useMutation({
    mutationFn: (data) => base44.entities.Return.update(returnId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return', returnId] });
      setIsEditing(false);
      toast.success('Devolução atualizada');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status) => {
      const updates = { status };
      if (status === 'RECEBIDA') {
        if (!selectedWarehouseId) {
          throw new Error('Selecione um armazém para o recebimento.');
        }

        updates.received_at = new Date().toISOString();
        updates.warehouse_id = selectedWarehouseId;

        // Processar Entrada de Estoque para cada item
        for (const item of items || []) {
          await executeInventoryTransaction({
            type: 'ENTRADA',
            product_id: item.product_id,
            qty: item.qty,
            to_warehouse_id: selectedWarehouseId,
            related_type: 'DEVOLUCAO',
            related_id: returnId,
            reason: `Recebimento de Devolução ${returnData.return_number}`,
            notes: item.serial_number ? `Série: ${item.serial_number}` : ''
          }, returnData.company_id);

          // Se tiver número de série, atualizar status do item
          if (item.serial_number) {
            const serials = await base44.entities.SerialNumber.filter({ 
              serial_number: item.serial_number,
              product_id: item.product_id
            });
            if (serials?.[0]) {
              await base44.entities.SerialNumber.update(serials[0].id, {
                status: 'EM_ESTOQUE',
                client_id: null,
                client_name: null,
                order_id: null,
                order_number: null
              });
            }
          }
        }
      } else if (status === 'ANALISADA') {
        updates.analyzed_at = new Date().toISOString();
        const me = await base44.auth.me();
        updates.analyzed_by = me?.email || 'sistema';
      } else if (status === 'FECHADA') {
        updates.closed_at = new Date().toISOString();
      }
      return base44.entities.Return.update(returnId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return', returnId] });
      toast.success('Status atualizado e estoque processado');
    },
    onError: (err) => {
      toast.error('Erro ao atualizar: ' + err.message);
    }
  });

  const updateResolutionMutation = useMutation({
    mutationFn: async ({ resolution, creditAmount }) => {
      const updates = { resolution };
      if (resolution === 'CREDITO' && creditAmount) {
        updates.credit_amount = creditAmount;
      }
      return base44.entities.Return.update(returnId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return', returnId] });
      toast.success('Resolução registrada');
    },
  });

  if (loadingReturn) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!returnData) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Devolução não encontrada</p>
        <Link to={createPageUrl('Returns')}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const totalValue = items?.reduce((sum, item) => sum + ((item.qty || 0) * (item.unit_price || 0)), 0) || 0;
  const canEdit = returnData.status === 'ABERTA' || returnData.status === 'RECEBIDA';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl('Returns')}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Devolução {returnData.return_number || `#${returnData.id.slice(0, 8)}`}
              </h1>
              <Badge className={STATUS_CONFIG[returnData.status]?.color}>
                {STATUS_CONFIG[returnData.status]?.label || returnData.status}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              canEdit && (
                <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar Devolução
                </Button>
              )
            ) : (
              <>
                <Button onClick={() => setIsEditing(false)} variant="ghost" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={() => updateReturnMutation.mutate(formData)} size="sm" className="bg-indigo-600">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </Button>
              </>
            )}
          </div>
        </div>

      {/* Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informações da Devolução</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-500">Cliente</Label>
                  <p className="font-semibold text-lg">{returnData.client_name}</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Motivo da Devolução</Label>
                  {isEditing ? (
                    <Select value={formData.reason} onValueChange={(v) => setFormData({ ...formData, reason: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEFEITO">Defeito</SelectItem>
                        <SelectItem value="NAO_CONFORMIDADE">Não Conformidade</SelectItem>
                        <SelectItem value="ARREPENDIMENTO">Arrependimento</SelectItem>
                        <SelectItem value="DANO_TRANSPORTE">Dano no Transporte</SelectItem>
                        <SelectItem value="OUTRO">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium p-2 bg-slate-50 rounded border">{returnData.reason}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Data da Devolução</Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={formData.return_date}
                      onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                    />
                  ) : (
                    <p className="font-medium p-2 bg-slate-50 rounded border">
                      {returnData.return_date ? format(new Date(returnData.return_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Descrição / Problema</Label>
                  {isEditing ? (
                    <textarea
                      className="w-full min-h-[100px] p-2 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={formData.reason_description}
                      onChange={(e) => setFormData({ ...formData, reason_description: e.target.value })}
                      placeholder="Descreva o motivo detalhado..."
                    />
                  ) : (
                    <p className="font-medium p-2 bg-slate-50 rounded border min-h-[45px]">
                      {returnData.reason_description || 'Sem descrição'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Observações Internas</Label>
                  {isEditing ? (
                    <Input
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Notas para controle interno..."
                    />
                  ) : (
                    <p className="font-medium p-2 bg-slate-50 rounded border">
                      {returnData.notes || '-'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Itens</span>
              <span className="font-medium">{items?.length || 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg">
              <span className="font-medium">Total</span>
              <span className="font-bold text-indigo-600">
                R$ {Number(totalValue).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status and Resolution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atualizar Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Alterar Status</Label>
              <Select 
                value={returnData.status} 
                onValueChange={(status) => updateStatusMutation.mutate(status)}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABERTA">Aberta</SelectItem>
                  <SelectItem value="RECEBIDA">Recebida</SelectItem>
                  <SelectItem value="ANALISADA">Analisada</SelectItem>
                  <SelectItem value="APROVADA">Aprovada</SelectItem>
                  <SelectItem value="REJEITADA">Rejeitada</SelectItem>
                  <SelectItem value="FECHADA">Fechada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {returnData.status === 'ABERTA' && (
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg space-y-3">
                <p className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                  <Warehouse className="h-4 w-4" />
                  Configuração de Recebimento
                </p>
                <WarehouseSearchSelect
                  label="Armazém de Destino"
                  placeholder="Selecione onde o estoque será creditado..."
                  value={selectedWarehouseId}
                  onSelect={setSelectedWarehouseId}
                />
                <p className="text-[11px] text-indigo-600 italic">
                  Ao mudar para "Recebida", o estoque será creditado neste armazém.
                </p>
              </div>
            )}

            {returnData.warehouse_id && (
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded border border-dashed">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Estoque destinado ao Armazém ID: <span className="font-mono text-xs">{returnData.warehouse_id.slice(0,8)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resolução</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {returnData.resolution ? (
              <div>
                <Badge className="mb-2">
                  {returnData.resolution === 'CREDITO' && <CheckCircle className="h-3 w-3 mr-1" />}
                  {returnData.resolution === 'REENVIO' && <AlertCircle className="h-3 w-3 mr-1" />}
                  {returnData.resolution}
                </Badge>
                {returnData.credit_amount && (
                  <p className="text-sm text-slate-600">
                    Crédito: <span className="font-semibold">R$ {Number(returnData.credit_amount).toFixed(2)}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Select 
                  onValueChange={(resolution) => {
                    if (resolution === 'CREDITO') {
                      updateResolutionMutation.mutate({ resolution, creditAmount: totalValue });
                    } else {
                      updateResolutionMutation.mutate({ resolution });
                    }
                  }}
                  disabled={updateResolutionMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREDITO">Gerar Crédito</SelectItem>
                    <SelectItem value="REENVIO">Reenvio</SelectItem>
                    <SelectItem value="REPARO">Reparo</SelectItem>
                    <SelectItem value="REJEICAO">Rejeição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Itens da Devolução</CardTitle>
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
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Nº Série</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Condição</TableHead>
                  {canEdit && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-indigo-600">{item.product_sku}</TableCell>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell>
                      {item.serial_number ? (
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {item.serial_number}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell className="text-right">R$ {Number(item.unit_price || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">
                      R$ {(Number(item.qty || 0) * Number(item.unit_price || 0)).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={CONDITION_CONFIG[item.condition]?.color}>
                        {CONDITION_CONFIG[item.condition]?.label || item.condition}
                      </Badge>
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        products={products}
        onAdd={(data) => addItemMutation.mutate(data)}
        loading={addItemMutation.isPending}
      />

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
    </div>
  );
}