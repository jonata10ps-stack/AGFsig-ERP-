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
  CONTAGEM_1: { color: 'bg-amber-100 text-amber-700', label: '1ª Contagem' },
  CONTAGEM_2: { color: 'bg-orange-100 text-orange-700', label: '2ª Contagem' },
  RECONCILIACAO: { color: 'bg-indigo-100 text-indigo-700', label: 'Reconciliação' },
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

  const changeStatusMutation = useMutation({
    mutationFn: async (newStatus) => {
      await base44.entities.InventoryCount.update(countId, {
        status: newStatus
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-count', countId, companyId] });
      toast.success(`Estágio alterado para: ${STATUS_CONFIG[variables]?.label}`);
    },
    onError: (error) => {
      toast.error('Erro ao alterar estágio: ' + error.message);
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async (payload) => {
      const { itemId, data } = payload;
      await base44.entities.InventoryCountItem.update(itemId, data);
    },
    onSuccess: () => {
      refetchItems();
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const handleUpdateQty = (item, field) => {
    const val = parseFloat(editQty);
    if (isNaN(val) || val < 0) {
      toast.error('Quantidade inválida');
      return;
    }

    const data = { [field]: val };
    
    // Se for 1ª ou 2ª contagem, marcar status como contado
    if (field === 'qty_1' || field === 'qty_2') {
      data.status = 'CONTADO';
    }

    // Se for qty_final (reconciliação), recalcular a divergência baseada no sistema
    if (field === 'qty_final') {
      data.qty_divergence = val - (item.qty_system || 0);
      data.status = 'CONCILIADO';
    }

    updateItemMutation.mutate({ itemId: item.id, data });
    setEditingItem(null);
    setEditQty('');
  };

  const applyAdjustmentsMutation = useMutation({
    mutationFn: async () => {
      const itemsToAdjust = countItems.filter(item => 
        item.qty_final !== undefined && item.qty_final !== null
      );

      if (itemsToAdjust.length === 0) {
        throw new Error('Nenhum item reconciliado para aplicar ajustes');
      }

      for (const item of itemsToAdjust) {
        const divergence = (parseFloat(item.qty_final) || 0) - (parseFloat(item.qty_system) || 0);
        
        if (divergence === 0) {
           await base44.entities.InventoryCountItem.update(item.id, { status: 'AJUSTADO' });
           continue; 
        }

        const balance = stockBalances.find(b => 
          b.product_id === item.product_id && 
          b.location_id === item.location_id
        );

        if (!balance) {
          throw new Error(`Saldo não encontrado para ${item.product_name} em ${item.location_id}`);
        }

        // Criar movimento de inventário
        const moveData = {
          company_id: companyId,
          type: divergence > 0 ? 'ENTRADA' : 'SAIDA',
          product_id: item.product_id,
          qty: Math.abs(divergence),
          related_type: 'INVENTARIO',
          related_id: countId,
          reason: `Ajuste de Inventário ${count.count_number}`,
          unit_cost: balance.avg_cost || 0,
          warehouse_id: balance.warehouse_id,
          location_id: balance.location_id
        };

        if (divergence < 0) {
          moveData.from_warehouse_id = balance.warehouse_id;
          moveData.from_location_id = balance.location_id;
        } else {
          moveData.to_warehouse_id = balance.warehouse_id;
          moveData.to_location_id = balance.location_id;
        }

        await base44.entities.InventoryMove.create(moveData);

        // ATUALIZAR SALDO LOCALIZADO (Evita discrepância entre total e local)
        const newQty = Math.max(0, balance.qty_available + divergence);
        await base44.entities.StockBalance.update(balance.id, {
          qty_available: newQty,
          last_move_date: new Date().toISOString()
        });

        // Atualizar item da contagem
        await base44.entities.InventoryCountItem.update(item.id, {
          status: 'AJUSTADO'
        });
      }

      await base44.entities.InventoryCount.update(countId, {
        status: 'AJUSTADO'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-count'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
      setConfirmApplyOpen(false);
      toast.success('Ajustes aplicados e saldos localizados atualizados!');
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
              {count.created_date ? format(new Date(count.created_date), 'PPP', { locale: ptBR }) : 'Data não disponível'}
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

      {/* Workflow Actions */}
      <div className="flex gap-2">
        {count.status === 'ABERTO' && (
          <Button onClick={() => changeStatusMutation.mutate('CONTAGEM_1')} className="bg-amber-600 hover:bg-amber-700">
            Iniciar 1ª Contagem
          </Button>
        )}
        
        {count.status === 'CONTAGEM_1' && (
          <Button onClick={() => changeStatusMutation.mutate('CONTAGEM_2')} className="bg-orange-600 hover:bg-orange-700">
            Finalizar 1ª e Iniciar 2ª Contagem
          </Button>
        )}

        {count.status === 'CONTAGEM_2' && (
          <Button onClick={() => changeStatusMutation.mutate('RECONCILIACAO')} className="bg-indigo-600 hover:bg-indigo-700">
            Finalizar 2ª e Ir para Reconciliação
          </Button>
        )}

        {count.status === 'RECONCILIACAO' && (
          <Button 
            onClick={() => setConfirmApplyOpen(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Aplicar Ajustes Finais
          </Button>
        )}
      </div>

      {count.status === 'ABERTO' && (
        <Button onClick={() => setAddItemOpen(true)} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Item Manualmente
        </Button>
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
                    {count.status !== 'CONTAGEM_2' && <TableHead>Sistema</TableHead>}
                    {count.status !== 'CONTAGEM_2' && <TableHead>1ª Cont.</TableHead>}
                    {count.status !== 'CONTAGEM_1' && <TableHead>2ª Cont.</TableHead>}
                    {count.status === 'RECONCILIACAO' && <TableHead>Diverg. C1/C2</TableHead>}
                    {count.status === 'RECONCILIACAO' && <TableHead>Quantidade Final</TableHead>}
                    {count.status === 'AJUSTADO' && <TableHead>Final</TableHead>}
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countItems.map((item) => (
                    <TableRow key={item.id} className={(count.status === 'RECONCILIACAO' && item.qty_1 !== item.qty_2) ? 'bg-red-50' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-xs text-slate-500">{item.product_sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>{locations.find(l => l.id === item.location_id)?.barcode}</TableCell>
                      
                      {/* Sistema */}
                      {count.status !== 'CONTAGEM_2' && (
                        <TableCell className="font-mono">{item.qty_system || 0}</TableCell>
                      )}
                      
                      {/* 1ª Contagem */}
                      {count.status !== 'CONTAGEM_2' && (
                        <TableCell>
                          {editingItem?.id === item.id && editingItem?.field === 'qty_1' ? (
                            <Input
                              type="number"
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              className="w-20"
                              onBlur={() => handleUpdateQty(item, 'qty_1')}
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="cursor-pointer hover:underline text-indigo-600"
                              onClick={() => count.status === 'CONTAGEM_1' && (setEditingItem({ id: item.id, field: 'qty_1' }), setEditQty(item.qty_1 || ''))}
                            >
                              {item.qty_1 ?? '-'}
                            </span>
                          )}
                        </TableCell>
                      )}

                      {/* 2ª Contagem */}
                      {count.status !== 'CONTAGEM_1' && (
                        <TableCell>
                          {editingItem?.id === item.id && editingItem?.field === 'qty_2' ? (
                            <Input
                              type="number"
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              className="w-20"
                              onBlur={() => handleUpdateQty(item, 'qty_2')}
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="cursor-pointer hover:underline text-orange-600"
                              onClick={() => count.status === 'CONTAGEM_2' && (setEditingItem({ id: item.id, field: 'qty_2' }), setEditQty(item.qty_2 || ''))}
                            >
                              {item.qty_2 ?? '-'}
                            </span>
                          )}
                        </TableCell>
                      )}

                      {/* Diferença C1 vs C2 */}
                      {count.status === 'RECONCILIACAO' && (
                        <TableCell>
                          {item.qty_1 === item.qty_2 ? (
                            <Badge className="bg-emerald-100 text-emerald-700">Ok</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700">Divergente ({Math.abs((item.qty_1 || 0) - (item.qty_2 || 0))})</Badge>
                          )}
                        </TableCell>
                      )}

                      {/* Quantidade Final */}
                      {count.status === 'RECONCILIACAO' && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                             {editingItem?.id === item.id && editingItem?.field === 'qty_final' ? (
                               <Input
                                 type="number"
                                 value={editQty}
                                 onChange={(e) => setEditQty(e.target.value)}
                                 className="w-20"
                                 onBlur={() => handleUpdateQty(item, 'qty_final')}
                                 autoFocus
                               />
                             ) : (
                               <span 
                                 className="font-bold text-lg cursor-pointer hover:underline"
                                 onClick={() => setEditingItem({ id: item.id, field: 'qty_final' })}
                               >
                                 {item.qty_final ?? '?'}
                               </span>
                             )}
                             <Button size="sm" variant="outline" onClick={() => (setEditQty(item.qty_1), handleUpdateQty(item, 'qty_final'))} title="Usar 1ª">C1</Button>
                             <Button size="sm" variant="outline" onClick={() => (setEditQty(item.qty_2), handleUpdateQty(item, 'qty_final'))} title="Usar 2ª">C2</Button>
                          </div>
                        </TableCell>
                      )}

                      {count.status === 'AJUSTADO' && (
                        <TableCell className="font-bold">{item.qty_final}</TableCell>
                      )}

                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteItemMutation.mutate(item.id)}
                          className="text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
              {countItems.filter(i => i.qty_divergence && i.qty_divergence !== 0).map((item) => (
                <li key={item.id} className="flex justify-between border-b py-1 last:border-0">
                  <span>{item.product_name}</span>
                  <div className="flex gap-2">
                    <span className="text-xs text-slate-400">Sis: {item.qty_system} / Fin: {item.qty_final}</span>
                    <Badge className={item.qty_divergence > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                      {item.qty_divergence > 0 ? '+' : ''}{item.qty_divergence}
                    </Badge>
                  </div>
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