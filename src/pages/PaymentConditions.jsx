import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Plus, Search, Edit2, Trash2, DollarSign } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import PaymentConditionForm from '@/components/payment/PaymentConditionForm';

const TIPO_COLORS = {
  ENTRADA: 'bg-blue-100 text-blue-700',
  PARCELA: 'bg-indigo-100 text-indigo-700',
  SALDO: 'bg-amber-100 text-amber-700',
};

function ParcelaSummary({ parcelas }) {
  if (!parcelas || parcelas.length === 0) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {parcelas.map((p, idx) => (
        <Badge key={idx} className={`text-xs px-1.5 py-0 font-normal ${TIPO_COLORS[p.tipo] || TIPO_COLORS.PARCELA}`}>
          {p.percentual}% / {p.dias === 0 ? 'ato' : `${p.dias}d`}
        </Badge>
      ))}
    </div>
  );
}

export default function PaymentConditions() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: conditions, isLoading } = useQuery({
    queryKey: ['payment-conditions', companyId],
    queryFn: () => companyId ? base44.entities.PaymentCondition.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PaymentCondition.create({ ...data, company_id: companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-conditions', companyId] });
      setDialogOpen(false);
      toast.success('Condição criada com sucesso');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PaymentCondition.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-conditions', companyId] });
      setDialogOpen(false);
      setEditing(null);
      toast.success('Condição atualizada com sucesso');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PaymentCondition.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-conditions', companyId] });
      setDeleteConfirm(null);
      toast.success('Condição excluída com sucesso');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) => base44.entities.PaymentCondition.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-conditions', companyId] }),
  });

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filtered = conditions?.filter(c =>
    c.code?.toLowerCase().includes(search.toLowerCase()) ||
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Condições de Pagamento</h1>
          <p className="text-slate-500">Gerencie as condições com entradas, parcelas e saldos</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-2" />
          Nova Condição
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por código ou nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhuma condição encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Juros</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((condition) => (
                  <TableRow key={condition.id}>
                    <TableCell className="font-mono text-indigo-600 font-medium">
                      {condition.code}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{condition.name}</p>
                        {condition.description && (
                          <p className="text-xs text-slate-500">{condition.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ParcelaSummary parcelas={condition.parcelas} />
                    </TableCell>
                    <TableCell>
                      {condition.discount_percentage > 0 ? (
                        <Badge className="bg-green-100 text-green-700">{condition.discount_percentage}%</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {condition.interest_percentage > 0 ? (
                        <Badge className="bg-amber-100 text-amber-700">{condition.interest_percentage}%</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`cursor-pointer ${condition.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                        onClick={() => toggleActiveMutation.mutate({ id: condition.id, active: !condition.active })}
                      >
                        {condition.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(condition); setDialogOpen(true); }}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(condition)} className="text-red-500 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Condição' : 'Nova Condição de Pagamento'}</DialogTitle>
          </DialogHeader>
          <PaymentConditionForm
            condition={editing}
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
          <p>Tem certeza que deseja excluir a condição <strong>{deleteConfirm?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteConfirm.id)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}