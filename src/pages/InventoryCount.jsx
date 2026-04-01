import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Plus, Eye, CheckCircle, AlertTriangle, Calendar, Package, MapPin, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  ABERTO: { color: 'bg-blue-100 text-blue-700', label: 'Aberto' },
  EM_CONTAGEM: { color: 'bg-amber-100 text-amber-700', label: 'Em Contagem' },
  CONCLUIDO: { color: 'bg-emerald-100 text-emerald-700', label: 'Concluído' },
  AJUSTADO: { color: 'bg-purple-100 text-purple-700', label: 'Ajustado' },
  CANCELADO: { color: 'bg-slate-100 text-slate-700', label: 'Cancelado' },
};

const TYPE_CONFIG = {
  GERAL: { icon: Package, label: 'Inventário Geral' },
  CICLICO: { icon: Calendar, label: 'Inventário Cíclico' },
  POR_LOCALIZACAO: { icon: MapPin, label: 'Por Localização' },
  POR_PRODUTO: { icon: Package, label: 'Por Produto' },
};

function CreateCountDialog({ open, onClose, companyId }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    type: 'CICLICO',
    warehouse_id: '',
    location_id: '',
    product_id: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => companyId ? base44.entities.Warehouse.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => companyId ? base44.entities.Location.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId && form.type === 'POR_LOCALIZACAO',
  });

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId && form.type === 'POR_PRODUTO',
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const warehouse = warehouses?.find(w => w.id === data.warehouse_id);
      const user = await base44.auth.me();
      
      const countNumber = `INV-${Date.now().toString().slice(-6)}`;
      
      const countData = {
         company_id: companyId,
         count_number: countNumber,
         type: data.type,
         warehouse_id: data.warehouse_id,
         warehouse_name: warehouse?.name,
         scheduled_date: data.scheduled_date,
         notes: data.notes,
         responsible: user.full_name || user.email,
         status: 'ABERTO'
       };

      if (data.type === 'POR_LOCALIZACAO' && data.location_id) {
        countData.location_id = data.location_id;
      }
      
      if (data.type === 'POR_PRODUTO' && data.product_id) {
        countData.product_id = data.product_id;
      }

      const count = await base44.entities.InventoryCount.create(countData);

      // Gerar itens a contar baseado no tipo
      let stockBalances = [];
      
      if (data.type === 'GERAL') {
        stockBalances = await base44.entities.StockBalance.filter({
          company_id: companyId,
          warehouse_id: data.warehouse_id
        });
      } else if (data.type === 'POR_LOCALIZACAO' && data.location_id) {
        stockBalances = await base44.entities.StockBalance.filter({
          company_id: companyId,
          warehouse_id: data.warehouse_id,
          location_id: data.location_id
        });
      } else if (data.type === 'POR_PRODUTO' && data.product_id) {
        stockBalances = await base44.entities.StockBalance.filter({
          company_id: companyId,
          warehouse_id: data.warehouse_id,
          product_id: data.product_id
        });
      } else if (data.type === 'CICLICO') {
        // Inventário cíclico: pegar localizações/produtos aleatórios
        const allBalances = await base44.entities.StockBalance.filter({
          company_id: companyId,
          warehouse_id: data.warehouse_id
        });
        // Pegar 20% dos itens aleatoriamente
        const sampleSize = Math.max(5, Math.floor(allBalances.length * 0.2));
        stockBalances = allBalances.sort(() => 0.5 - Math.random()).slice(0, sampleSize);
      }

      // Criar itens de contagem
      for (const balance of stockBalances) {
        const product = await base44.entities.Product.filter({ id: balance.product_id });
        const location = await base44.entities.Location.filter({ id: balance.location_id });
        
        await base44.entities.InventoryCountItem.create({
          company_id: companyId,
          count_id: count.id,
          product_id: balance.product_id,
          product_sku: product[0]?.sku,
          product_name: product[0]?.name,
          location_id: balance.location_id,
          location_barcode: location[0]?.barcode,
          qty_system: balance.qty_available || 0,
          qty_counted: 0,
          qty_divergence: 0,
          status: 'PENDENTE'
        });
      }

      await base44.entities.InventoryCount.update(count.id, {
        total_items: stockBalances.length
      });

      return count;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-counts'] });
      onClose();
      toast.success('Inventário criado com sucesso!');
      setForm({
        type: 'CICLICO',
        warehouse_id: '',
        location_id: '',
        product_id: '',
        scheduled_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    },
    onError: (error) => {
      toast.error('Erro ao criar inventário: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.warehouse_id) {
      toast.error('Selecione o armazém');
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Inventário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Inventário *</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CICLICO">Cíclico (amostra 20%)</SelectItem>
                <SelectItem value="GERAL">Geral (tudo)</SelectItem>
                <SelectItem value="POR_LOCALIZACAO">Por Localização</SelectItem>
                <SelectItem value="POR_PRODUTO">Por Produto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Armazém *</Label>
            <Select value={form.warehouse_id} onValueChange={(v) => setForm({ ...form, warehouse_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {warehouses?.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.type === 'POR_LOCALIZACAO' && (
            <div className="space-y-2">
              <Label>Localização *</Label>
              <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {locations?.filter(l => l.warehouse_id === form.warehouse_id).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.barcode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.type === 'POR_PRODUTO' && (
            <div className="space-y-2">
              <Label>Produto *</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {products?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Data Programada</Label>
            <Input
              type="date"
              value={form.scheduled_date}
              onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Observações..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Criando...' : 'Criar Inventário'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function InventoryCount() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [countToDelete, setCountToDelete] = useState(null);

  const { data: counts, isLoading } = useQuery({
    queryKey: ['inventory-counts', companyId],
    queryFn: () => companyId ? base44.entities.InventoryCount.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const filteredCounts = counts?.filter(c => 
    filterStatus === 'all' || c.status === filterStatus
  );

  const deleteMutation = useMutation({
    mutationFn: async (countId) => {
      if (!countId || typeof countId !== 'string') {
        throw new Error('ID do inventário inválido');
      }

      // 1. Buscar todos os itens do inventário
      const items = await base44.entities.InventoryCountItem.filter({
        company_id: companyId,
        count_id: countId
      });

      // 2. Reverter ajustes de estoque (se status AJUSTADO)
      const counts = await base44.entities.InventoryCount.filter({ 
        company_id: companyId,
        id: countId 
      });
      if (counts[0]?.status === 'AJUSTADO') {
        // Buscar movimentos de ajuste relacionados
        const moves = await base44.entities.InventoryMove.filter({
          company_id: companyId,
          related_type: 'AJUSTE',
          related_id: countId
        });

        for (const move of moves) {
          // Reverter o saldo
          const balances = await base44.entities.StockBalance.filter({
            company_id: companyId,
            product_id: move.product_id,
            location_id: move.to_location_id || move.from_location_id
          });

          if (balances[0]) {
            const newQty = move.type === 'ENTRADA' 
              ? balances[0].qty_available - move.qty
              : balances[0].qty_available + move.qty;

            await base44.entities.StockBalance.update(balances[0].id, {
              qty_available: Math.max(0, newQty)
            });
          }

          // Deletar movimento
          await base44.entities.InventoryMove.delete({ id: move.id });
        }
      }

      // 3. Deletar todos os itens
      for (const item of items) {
        await base44.entities.InventoryCountItem.delete({ id: item.id });
      }

      // 4. Deletar o inventário
      await base44.entities.InventoryCount.delete({ id: countId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-counts'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-moves'] });
      toast.success('Inventário excluído e ajustes revertidos com sucesso');
      setDeleteDialogOpen(false);
      setCountToDelete(null);
    },
    onError: (error) => {
      toast.error('Erro ao excluir inventário: ' + error.message);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventário Físico</h1>
          <p className="text-slate-500">Contagem e ajuste de estoque</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-indigo-600">
          <Plus className="h-4 w-4 mr-2" />
          Novo Inventário
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {['ABERTO', 'EM_CONTAGEM', 'CONCLUIDO', 'AJUSTADO'].map(status => {
          const count = counts?.filter(c => c.status === status).length || 0;
          const config = STATUS_CONFIG[status];
          return (
            <Card key={status}>
              <CardContent className="p-4">
                <p className="text-sm text-slate-500">{config.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Inventários</CardTitle>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ABERTO">Abertos</SelectItem>
                <SelectItem value="EM_CONTAGEM">Em Contagem</SelectItem>
                <SelectItem value="CONCLUIDO">Concluídos</SelectItem>
                <SelectItem value="AJUSTADO">Ajustados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Carregando...</div>
          ) : filteredCounts?.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Package className="h-12 w-12 mx-auto text-slate-300 mb-2" />
              <p>Nenhum inventário encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Armazém</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Divergências</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCounts?.map(count => {
                  const TypeIcon = TYPE_CONFIG[count.type]?.icon;
                  return (
                    <TableRow key={count.id}>
                      <TableCell className="font-mono font-bold text-indigo-600">
                        {count.count_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {TypeIcon && <TypeIcon className="h-4 w-4 text-slate-400" />}
                          {TYPE_CONFIG[count.type]?.label}
                        </div>
                      </TableCell>
                      <TableCell>{count.warehouse_name}</TableCell>
                      <TableCell>
                        {count.scheduled_date ? format(new Date(count.scheduled_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell>{count.total_items || 0}</TableCell>
                      <TableCell>
                        {count.items_with_divergence > 0 ? (
                          <Badge className="bg-red-100 text-red-700">
                            {count.items_with_divergence}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_CONFIG[count.status]?.color}>
                          {STATUS_CONFIG[count.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Link to={createPageUrl(`InventoryCountDetail?id=${count.id}`)}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setCountToDelete(count);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateCountDialog open={createOpen} onClose={() => setCreateOpen(false)} companyId={companyId} />

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Inventário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-600">
              Tem certeza que deseja excluir o inventário <strong>{countToDelete?.count_number}</strong>?
            </p>
            {countToDelete?.status === 'AJUSTADO' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900">Atenção!</p>
                    <p className="text-sm text-amber-700">
                      Este inventário já foi ajustado. Todos os ajustes de estoque serão revertidos.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <p className="text-sm text-slate-500">
              Esta ação irá:
            </p>
            <ul className="text-sm text-slate-600 space-y-1 ml-4">
              <li>• Excluir todos os itens do inventário</li>
              {countToDelete?.status === 'AJUSTADO' && (
                <li>• Reverter todos os ajustes de estoque realizados</li>
              )}
              <li>• Esta ação não pode ser desfeita</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (countToDelete?.id) {
                  deleteMutation.mutate(countToDelete.id);
                }
              }}
              disabled={deleteMutation.isPending || !countToDelete?.id}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir Inventário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}