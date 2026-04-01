import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, Edit, Trash2, GitBranch, Eye } from 'lucide-react';
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

function RouteForm({ route, onSave, onCancel, loading }) {
  const [form, setForm] = useState(route || {
    code: '',
    name: '',
    active: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      toast.error('Preencha todos os campos obrigatórios');
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
          placeholder="Ex: ROT-001"
        />
      </div>

      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Processo de Montagem"
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

export default function ProductionRoutes() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: routes, isLoading } = useQuery({
    queryKey: ['production-routes', companyId],
    queryFn: () => companyId ? base44.entities.ProductionRoute.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProductionRoute.create({ ...data, company_id: companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-routes', companyId] });
      setDialogOpen(false);
      setEditingRoute(null);
      toast.success('Roteiro criado com sucesso');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductionRoute.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-routes', companyId] });
      setDialogOpen(false);
      setEditingRoute(null);
      toast.success('Roteiro atualizado');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductionRoute.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-routes', companyId] });
      setDeleteConfirm(null);
      toast.success('Roteiro excluído');
    },
  });

  const handleSave = (data) => {
    if (editingRoute) {
      updateMutation.mutate({ id: editingRoute.id, data });
    } else {
      createMutation.mutate(data);
    }
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Roteiros de Produção</h1>
          <p className="text-slate-500">Gerencie os roteiros e etapas de produção</p>
        </div>
        <Button onClick={() => { setEditingRoute(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Roteiro
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes?.map((route) => (
                <TableRow key={route.id}>
                  <TableCell className="font-mono text-indigo-600">{route.code}</TableCell>
                  <TableCell className="font-medium">{route.name}</TableCell>
                  <TableCell>
                    <Badge className={route.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                      {route.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link to={createPageUrl(`RouteSteps?route=${route.id}`)}>
                        <Button variant="ghost" size="icon">
                          <GitBranch className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => { setEditingRoute(route); setDialogOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(route)}>
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
            <DialogTitle>{editingRoute ? 'Editar Roteiro' : 'Novo Roteiro'}</DialogTitle>
          </DialogHeader>
          <RouteForm
            route={editingRoute}
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
          <p>Tem certeza que deseja excluir o roteiro <strong>{deleteConfirm?.name}</strong>?</p>
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