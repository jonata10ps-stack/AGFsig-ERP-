import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

function StepForm({ step, onSave, onCancel, loading, resources = [] }) {
  const [form, setForm] = useState(step || {
    sequence: '',
    name: '',
    description: '',
    resource_type: 'MAQUINA',
    resource_id: '',
    estimated_time: '',
    alternative_resource_ids: [],
    depends_on_step_ids: []
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.sequence || !form.name) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    const dataToSave = {
      ...form,
      estimated_time: form.estimated_time ? parseFloat(form.estimated_time) : null
    };
    onSave(dataToSave);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Sequência *</Label>
          <Input
            type="number"
            min="1"
            value={form.sequence}
            onChange={(e) => setForm({ ...form, sequence: parseInt(e.target.value) })}
            placeholder="1, 2, 3..."
          />
        </div>
        <div className="space-y-2">
          <Label>Nome da Etapa *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Corte, Soldagem..."
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Descreva a etapa..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Recurso</Label>
          <Select value={form.resource_type} onValueChange={(v) => setForm({ ...form, resource_type: v })}>
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
          <Label>Recurso Principal</Label>
          <Select value={form.resource_id} onValueChange={(v) => setForm({ ...form, resource_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {resources.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tempo Estimado (minutos)</Label>
        <Input
          type="number"
          min="0"
          step="0.5"
          value={form.estimated_time}
          onChange={(e) => setForm({ ...form, estimated_time: parseFloat(e.target.value) })}
          placeholder="Ex: 30"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Salvando...' : 'Salvar Etapa'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export default function RouteSteps() {
  const { companyId } = useCompanyId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const routeId = urlParams.get('route');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState(null);

  const { data: route, isLoading: loadingRoute } = useQuery({
    queryKey: ['route', routeId, companyId],
    queryFn: () => base44.entities.ProductionRoute.filter({ company_id: companyId, id: routeId }),
    select: (data) => data?.[0],
    enabled: !!routeId && !!companyId,
  });

  const { data: steps = [], isLoading: loadingSteps } = useQuery({
    queryKey: ['route-steps', routeId, companyId],
    queryFn: () => base44.entities.ProductionRouteStep.filter({ company_id: companyId, route_id: routeId }),
    enabled: !!routeId && !!companyId,
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['resources', companyId],
    queryFn: () => base44.entities.Resource.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProductionRouteStep.create({ ...data, route_id: routeId, company_id: companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-steps'] });
      setDialogOpen(false);
      setEditingStep(null);
      toast.success('Etapa criada');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ProductionRouteStep.update(editingStep.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-steps'] });
      setDialogOpen(false);
      setEditingStep(null);
      toast.success('Etapa atualizada');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductionRouteStep.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-steps'] });
      toast.success('Etapa deletada');
    },
  });

  const handleSave = (formData) => {
    if (editingStep) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  if (loadingRoute || loadingSteps) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Roteiro não encontrado</p>
      </div>
    );
  }

  const sortedSteps = [...steps].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Etapas do Roteiro</h1>
            <p className="text-slate-600">{route.code} - {route.name}</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditingStep(null);
            setDialogOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Etapa
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {sortedSteps.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhuma etapa cadastrada</p>
              <Button
                onClick={() => {
                  setEditingStep(null);
                  setDialogOpen(true);
                }}
                variant="outline"
                className="mt-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeira Etapa
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Seq</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tempo (min)</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSteps.map((step) => (
                  <TableRow key={step.id}>
                    <TableCell className="font-bold text-indigo-600">{step.sequence}</TableCell>
                    <TableCell className="font-medium">{step.name}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{step.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {step.resource_type?.toLowerCase().replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{step.estimated_time || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingStep(step);
                            setDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(step.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStep ? 'Editar Etapa' : 'Nova Etapa'}</DialogTitle>
          </DialogHeader>
          <StepForm
            step={editingStep}
            onSave={handleSave}
            onCancel={() => setDialogOpen(false)}
            loading={createMutation.isPending || updateMutation.isPending}
            resources={resources}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}