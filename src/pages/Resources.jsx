import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Plus, Edit, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function ResourceForm({ resource, onSave, onCancel, loading }) {
  const [form, setForm] = useState(resource || {
    code: '',
    name: '',
    type: 'MAQUINA',
    cost_per_hour: 0,
    active: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      toast.error('Código e Nome são obrigatórios');
      return;
    }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Código *</Label>
        <Input
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          placeholder="Ex: MAQ-001"
        />
      </div>

      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Torno CNC"
        />
      </div>

      <div className="space-y-2">
        <Label>Tipo *</Label>
        <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MAQUINA">Máquina</SelectItem>
            <SelectItem value="OPERADOR">Operador</SelectItem>
            <SelectItem value="CENTRO_TRABALHO">Centro de Trabalho</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Custo por Hora (R$)</Label>
        <Input
          type="number"
          step="0.01"
          value={form.cost_per_hour}
          onChange={(e) => setForm({ ...form, cost_per_hour: parseFloat(e.target.value) || 0 })}
        />
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

export default function Resources() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterType, setFilterType] = useState('all');

  const { data: resources, isLoading } = useQuery({
    queryKey: ['resources', companyId],
    queryFn: () => companyId ? base44.entities.Resource.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Resource.create({ ...data, company_id: companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', companyId] });
      setDialogOpen(false);
      setEditingResource(null);
      toast.success('Recurso criado');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Resource.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', companyId] });
      setDialogOpen(false);
      setEditingResource(null);
      toast.success('Recurso atualizado');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Resource.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', companyId] });
      setDeleteConfirm(null);
      toast.success('Recurso excluído');
    },
  });

  const handleSave = (data) => {
    if (editingResource) {
      updateMutation.mutate({ id: editingResource.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filtered = resources?.filter(r => filterType === 'all' || r.type === filterType);

  const RESOURCE_TYPES = {
    MAQUINA: { label: 'Máquina', color: 'bg-blue-100 text-blue-700' },
    OPERADOR: { label: 'Operador', color: 'bg-purple-100 text-purple-700' },
    CENTRO_TRABALHO: { label: 'Centro de Trabalho', color: 'bg-amber-100 text-amber-700' }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recursos de Produção</h1>
          <p className="text-slate-500">Máquinas, operadores e centros de trabalho</p>
        </div>
        <Button onClick={() => { setEditingResource(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Recurso
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="MAQUINA">Máquinas</SelectItem>
              <SelectItem value="OPERADOR">Operadores</SelectItem>
              <SelectItem value="CENTRO_TRABALHO">Centros de Trabalho</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Custo/Hora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((resource) => (
                <TableRow key={resource.id}>
                  <TableCell className="font-mono text-indigo-600">{resource.code}</TableCell>
                  <TableCell className="font-medium">{resource.name}</TableCell>
                  <TableCell>
                    <Badge className={RESOURCE_TYPES[resource.type]?.color}>
                      {RESOURCE_TYPES[resource.type]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    R$ {Number(resource.cost_per_hour || 0).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge className={resource.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                      {resource.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingResource(resource); setDialogOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(resource)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingResource ? 'Editar Recurso' : 'Novo Recurso'}</DialogTitle>
          </DialogHeader>
          <ResourceForm
            resource={editingResource}
            onSave={handleSave}
            onCancel={() => setDialogOpen(false)}
            loading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p>Excluir o recurso <strong>{deleteConfirm?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteConfirm.id)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}