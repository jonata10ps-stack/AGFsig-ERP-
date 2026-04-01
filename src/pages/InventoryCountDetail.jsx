import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Plus, Edit2, Trash2, Save, X, CheckCircle2, AlertCircle, ArrowLeft, Package, MapPin, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';

const STATUS_CONFIG = {
  ABERTO: { color: 'bg-blue-100 text-blue-700', label: 'Aberto' },
  EM_CONTAGEM: { color: 'bg-amber-100 text-amber-700', label: 'Em Contagem' },
  CONCLUIDO: { color: 'bg-emerald-100 text-emerald-700', label: 'Concluído' },
  AJUSTADO: { color: 'bg-purple-100 text-purple-700', label: 'Ajustado' },
  CANCELADO: { color: 'bg-slate-100 text-slate-700', label: 'Cancelado' },
};

export default function InventoryCountDetail() {
  const { companyId } = useCompanyId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const countId = urlParams.get('id');

  const [editingItem, setEditingItem] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newItemProductId, setNewItemProductId] = useState('');
  const [newItemLocationId, setNewItemLocationId] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);

  // Fetch count
  const { data: count, isLoading: loadingCount } = useQuery({
    queryKey: ['inventory-count', countId, companyId],
    queryFn: () => base44.entities.InventoryCount.filter({ company_id: companyId, id: countId }),
    select: (data) => data?.[0],
    enabled: !!countId && !!companyId,
  });

  // Fetch count items
  const { data: countItems = [], isLoading: loadingItems, refetch: refetchItems } = useQuery({
    queryKey: ['inventory-count-items', countId],
    queryFn: () => base44.entities.InventoryCountItem.filter({ count_id: countId }),
    enabled: !!countId,
  });

  // Fetch stock balances
  const { data: stockBalances = [] } = useQuery({
    queryKey: ['stock-balances', companyId],
    queryFn: () => base44.entities.StockBalance.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  // Fetch locations
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => base44.entities.Location.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => base44.entities.Product.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const startCountingMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.InventoryCount.update(countId, {
        status: 'EM_CONTAGEM'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-count', countId, companyId] });
      toast.success('Contagem iniciada');
    },
    onError: (error) => {
      toast.error('Erro ao iniciar contagem: ' + error.message);
    }
  });

  const completeCountingMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.InventoryCount.update(countId, {
        status: 'CONCLUIDO'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-count', countId, companyId] });
      toast.success('Contagem concluída');
    },
    onError: (error) => {
      toast.error('Erro ao concluir contagem: ' + error.message);
    }
  });

  const updateItemQtyMutation = useMutation({
    mutationFn: async () => {
      const newQty = parseFloat(editQty);
      if (isNaN(newQty) || newQty < 0) {
        throw new Error('Quantidade inválida');
      }

      const item = editingItem;
      const balance = stockBalances.find(b => 
        b.product_id === item.product_id && 
        b.location_id === item.location_id
      );
      const currentQty = balance?.qty_available || item.qty_system || 0;
      const divergence = newQty - currentQty;

      await base44.entities.InventoryCountItem.update(item.id, {
        qty_counted: newQty,
        qty_divergence: divergence,
        status: 'CONTADO'
      });

      setEditingItem(null);
      setEditQty('');
      refetchItems();
    },
    onSuccess: () => {
      toast.success('Item atualizado');
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const applyAdjustmentsMutation = useMutation({
    mutationFn: async () => {
      console.log('=== INICIANDO APLICAÇÃO DE AJUSTES ===');
      console.log('countId:', countId);
      console.log('companyId:', companyId);
      console.log('countItems total:', countItems.length);
      console.log('countItems:', countItems);

      const itemsWithDivergence = countItems.filter(item => 
        item.qty_divergence && item.qty_divergence !== 0
      );

      console.log('Items com divergência:', itemsWithDivergence.length);
      console.log('Items com divergência:', itemsWithDivergence);

      if (itemsWithDivergence.length === 0) {
        throw new Error('Nenhum item com divergência para ajustar');
      }

      for (const item of itemsWithDivergence) {
        console.log('\n--- Processando item:', item.product_name, '---');
        console.log('product_id:', item.product_id);
        console.log('location_id:', item.location_id);
        console.log('qty_divergence:', item.qty_divergence);

        const balance = stockBalances.find(b => 
          b.product_id === item.product_id && 
          b.location_id === item.location_id
        );

        console.log('Balance encontrado:', balance);

        if (!balance) {
          throw new Error(`Saldo não encontrado para ${item.product_name} na localização ${item.location_id}`);
        }

        // 1. Criar movimento de inventário com warehouse e location corretos
        const moveData = {
          company_id: companyId,
          type: 'AJUSTE',
          product_id: item.product_id,
          qty: Math.abs(item.qty_divergence),
          related_type: 'AJUSTE',
          related_id: countId,
          reason: `Ajuste de Inventário - Diferença: ${item.qty_divergence > 0 ? '+' : ''}${item.qty_divergence}`,
          unit_cost: balance.avg_cost || 0,
          warehouse_id: balance.warehouse_id,
          location_id: balance.location_id
        };

        // Se houver falta (saída), registrar origem da saída
        if (item.qty_divergence < 0) {
          moveData.from_warehouse_id = balance.warehouse_id;
          moveData.from_location_id = balance.location_id;
        } else {
          // Se houver excesso (entrada), registrar destino da entrada
          moveData.to_warehouse_id = balance.warehouse_id;
          moveData.to_location_id = balance.location_id;
        }

        console.log('Criando movimento:', moveData);
        const createdMove = await base44.entities.InventoryMove.create(moveData);
        console.log('Movimento criado:', createdMove);

        if (!createdMove || !createdMove.id) {
          throw new Error(`Falha ao criar movimento para ${item.product_name}`);
        }

        // 2. Atualizar saldo de estoque com o novo volume
        const newQty = Math.max(0, balance.qty_available + item.qty_divergence);
        console.log('Atualizando saldo. Antigo:', balance.qty_available, 'Novo qty:', newQty);
        await base44.entities.StockBalance.update(balance.id, {
          qty_available: newQty
        });

        // 3. Atualizar item de contagem com status ajustado
        await base44.entities.InventoryCountItem.update(item.id, {
          status: 'AJUSTADO'
        });

        console.log('Item ajustado com sucesso');
      }

      // 4. Atualizar status da contagem para concluído
      console.log('Atualizando status da contagem para AJUSTADO');
      await base44.entities.InventoryCount.update(countId, {
        status: 'AJUSTADO'
      });

      console.log('=== AJUSTES APLICADOS COM SUCESSO ===');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-count', countId, companyId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-count-items', countId] });
      queryClient.invalidateQueries({ queryKey: ['stock-balances', companyId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-moves'] });
      setConfirmApplyOpen(false);
      toast.success('Ajustes aplicados com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId) => {
      await base44.entities.InventoryCountItem.delete(itemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-count-items', countId] });
      toast.success('Item removido');
    },
    onError: (error) => {
      toast.error('Erro ao remover: ' + error.message);
    }
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!newItemProductId || !newItemLocationId || !newItemQty) {
        throw new Error('Preencha todos os campos');
      }

      const product = products.find(p => p.id === newItemProductId);
      const location = locations.find(l => l.id === newItemLocationId);

      if (!product || !location) {
        throw new Error('Produto ou localização inválidos');
      }

      const balance = stockBalances.find(b => 
        b.product_id === newItemProductId &&
        b.location_id === newItemLocationId
      );

      const currentQty = balance?.qty_available || 0;
      const countedQty = parseFloat(newItemQty);
      const divergence = countedQty - currentQty;

      await base44.entities.InventoryCountItem.create({
        company_id: companyId,
        count_id: countId,
        product_id: newItemProductId,
        product_sku: product.sku,
        product_name: product.name,
        location_id: newItemLocationId,
        stock_balance_id: balance?.id,
        qty_system: currentQty,
        qty_counted: countedQty,
        qty_divergence: divergence,
        status: 'CONTADO'
      });

      setAddItemOpen(false);
      setNewItemProductId('');
      setNewItemLocationId('');
      setNewItemQty('');
      refetchItems();
      toast.success('Item adicionado');
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  if (loadingCount || loadingItems) {
    return <Skeleton className="w-full h-96" />;
  }

  if (!count) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Contagem não encontrada</p>
        <Link to={createPageUrl('InventoryCount')}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const itemsOk = countItems.filter(i => !i.qty_divergence || i.qty_divergence === 0).length;
  const itemsWithDivergence = countItems.filter(i => i.qty_divergence && i.qty_divergence !== 0).length;
  const itemsAdjusted = countItems.filter(i => i.status === 'AJUSTADO').length;

  const statusConfig = STATUS_CONFIG[count.status] || { color: 'bg-slate-100 text-slate-700', label: count.status };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Contagem de Inventário</h1>
          <div className="flex items-center gap-3 mt-3">
            <Badge className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
            <span className="text-sm text-slate-500">
              {format(new Date(count.created_date), 'PPP', { locale: ptBR })}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-slate-500">Total de Itens</p>
              <p className="text-2xl font-bold text-slate-900">{countItems.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-emerald-600">Sem Divergência</p>
              <p className="text-2xl font-bold text-emerald-700">{itemsOk}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-amber-600">Com Divergência</p>
              <p className="text-2xl font-bold text-amber-700">{itemsWithDivergence}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-purple-600">Ajustados</p>
              <p className="text-2xl font-bold text-purple-700">{itemsAdjusted}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {count.status === 'ABERTO' && (
        <Button 
          onClick={() => startCountingMutation.mutate()}
          className="bg-blue-600 hover:bg-blue-700"
          disabled={startCountingMutation.isPending}
        >
          {startCountingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Iniciar Contagem
        </Button>
      )}

      {count.status === 'EM_CONTAGEM' && (
        <div className="flex gap-2">
          <Button 
            onClick={() => setAddItemOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Item
          </Button>
          <Button 
            onClick={() => completeCountingMutation.mutate()}
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={completeCountingMutation.isPending}
          >
            {completeCountingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Concluir Contagem
          </Button>
        </div>
      )}

      {count.status === 'CONCLUIDO' && itemsWithDivergence === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-900">Contagem sem divergências</p>
            <p className="text-sm text-emerald-700">Todos os itens conferem com o estoque</p>
          </div>
        </div>
      )}

      {count.status === 'CONCLUIDO' && itemsWithDivergence > 0 && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-900">Divergências encontradas</p>
              <p className="text-sm text-amber-700 mt-1">
                {itemsWithDivergence} item{itemsWithDivergence !== 1 ? 'ns' : ''} com diferença entre o esperado e o contado. Revise os itens abaixo e clique em "Aplicar Ajustes" para registrar as diferenças no sistema.
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setConfirmApplyOpen(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Aplicar Ajustes
          </Button>
        </div>
      )}

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Itens da Contagem</CardTitle>
        </CardHeader>
        <CardContent>
          {countItems.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Nenhum item adicionado</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Esperado</TableHead>
                    <TableHead>Contado</TableHead>
                    <TableHead>Divergência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {countItems.length > 0 && countItems
                     .sort((a, b) => {
                       // Mostrar itens com divergência primeiro
                       const aDivergence = a.qty_divergence && a.qty_divergence !== 0;
                       const bDivergence = b.qty_divergence && b.qty_divergence !== 0;
                       if (aDivergence && !bDivergence) return -1;
                       if (!aDivergence && bDivergence) return 1;
                       return 0;
                     })
                     .map((item) => (
                     <TableRow key={item.id} className={item.qty_divergence && item.qty_divergence !== 0 ? 'bg-amber-50' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900">{item.product_name}</p>
                          <p className="text-xs text-slate-500">{item.product_sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {locations.find(l => l.id === item.location_id)?.barcode || '-'}
                      </TableCell>
                      <TableCell>{item.qty_expected || 0}</TableCell>
                      <TableCell>
                        {editingItem?.id === item.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            className="w-20"
                            autoFocus
                          />
                        ) : (
                          item.qty_counted || 0
                        )}
                      </TableCell>
                      <TableCell>
                        {item.qty_divergence ? (
                          <Badge className={item.qty_divergence > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                            {item.qty_divergence > 0 ? '+' : ''}{item.qty_divergence}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          item.status === 'OK' ? 'bg-emerald-100 text-emerald-700' :
                          item.status === 'DIVERGENCIA' ? 'bg-amber-100 text-amber-700' :
                          'bg-purple-100 text-purple-700'
                        }>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex gap-2">
                        {editingItem?.id === item.id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => updateItemQtyMutation.mutate()}
                              disabled={updateItemQtyMutation.isPending}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingItem(null);
                                setEditQty('');
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {count.status === 'EM_CONTAGEM' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingItem(item);
                                  setEditQty(String(item.qty_counted || 0));
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                            {(count.status === 'ABERTO' || count.status === 'EM_CONTAGEM') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteItemMutation.mutate(item.id)}
                                disabled={deleteItemMutation.isPending}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Item à Contagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produto *</Label>
              <ProductSearchSelect
                value={newItemProductId}
                onChange={(id) => setNewItemProductId(id)}
              />
            </div>
            <div>
              <Label>Localização *</Label>
              <select
                value={newItemLocationId}
                onChange={(e) => setNewItemLocationId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Selecione...</option>
                {locations.filter(l => l.warehouse_id === count.warehouse_id).map(l => (
                  <option key={l.id} value={l.id}>{l.barcode}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Quantidade Contada *</Label>
              <Input
                type="number"
                step="0.01"
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => addItemMutation.mutate()}
              disabled={addItemMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {addItemMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Apply Dialog */}
      <Dialog open={confirmApplyOpen} onOpenChange={setConfirmApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Aplicar Ajustes de Inventário?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-slate-600">
              Serão criados {itemsWithDivergence} movimentos de ajuste:
            </p>
            <ul className="space-y-1 text-sm text-slate-600">
              {countItems.filter(i => i.status === 'DIVERGENCIA').map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span>{item.product_name}</span>
                  <Badge className={item.qty_divergence > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                    {item.qty_divergence > 0 ? '+' : ''}{item.qty_divergence}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded">
              Os movimentos serão registrados no Kardex e os saldos atualizados automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApplyOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => applyAdjustmentsMutation.mutate()}
              disabled={applyAdjustmentsMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {applyAdjustmentsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Aplicar Ajustes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}