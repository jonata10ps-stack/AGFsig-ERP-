import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCompanyId } from '@/components/useCompanyId';
import { Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductionRouteSteps() {
  const { companyId } = useCompanyId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [editingStep, setEditingStep] = useState(null);
  const [formData, setFormData] = useState({
    sequence: '',
    name: '',
    description: '',
    resource_type: 'MAQUINA',
    resource_id: '',
    estimated_time: '',
  });

  const [loading, setLoading] = useState(false);

  // Fetch routes
  const { data: routes = [] } = useQuery({
    queryKey: ['productionRoutes', companyId],
    queryFn: () => base44.entities.ProductionRoute.filter({ company_id: companyId }, 'name', 1000),
    enabled: !!companyId,
  });

  // Fetch steps for selected route
  const { data: steps = [], refetch: refetchSteps } = useQuery({
    queryKey: ['routeSteps', selectedRoute],
    queryFn: () => base44.entities.ProductionRouteStep.filter({ route_id: selectedRoute }, 'sequence', 100),
    enabled: !!selectedRoute,
  });

  // Fetch resources
  const { data: resources = [] } = useQuery({
    queryKey: ['resources', companyId],
    queryFn: () => base44.entities.Resource.filter({ company_id: companyId }, 'name', 1000),
    enabled: !!companyId,
  });

  const openDialog = (step = null) => {
    if (step) {
      setEditingStep(step);
      setFormData({
        sequence: step.sequence,
        name: step.name,
        description: step.description || '',
        resource_type: step.resource_type,
        resource_id: step.resource_id || '',
        estimated_time: step.estimated_time || '',
      });
    } else {
      setEditingStep(null);
      setFormData({
        sequence: steps.length + 1,
        name: '',
        description: '',
        resource_type: 'MAQUINA',
        resource_id: '',
        estimated_time: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedRoute || !formData.name) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        company_id: companyId,
        route_id: selectedRoute,
        sequence: parseInt(formData.sequence),
        name: formData.name,
        description: formData.description,
        resource_type: formData.resource_type,
        resource_id: formData.resource_id,
        estimated_time: formData.estimated_time ? parseInt(formData.estimated_time) : 0,
      };

      if (editingStep) {
        await base44.entities.ProductionRouteStep.update(editingStep.id, payload);
        toast.success('Etapa atualizada com sucesso');
      } else {
        await base44.entities.ProductionRouteStep.create(payload);
        toast.success('Etapa criada com sucesso');
      }

      setDialogOpen(false);
      refetchSteps();
    } catch (e) {
      console.error('Erro ao salvar:', e);
      toast.error('Erro ao salvar etapa');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (stepId) => {
    if (!confirm('Deseja remover esta etapa?')) return;

    setLoading(true);
    try {
      await base44.entities.ProductionRouteStep.delete(stepId);
      toast.success('Etapa removida com sucesso');
      refetchSteps();
    } catch (e) {
      console.error('Erro ao remover:', e);
      toast.error('Erro ao remover etapa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Etapas de Roteiros</h1>
        <p className="text-slate-600">Gerencie as etapas de produção para cada roteiro</p>
      </div>

      {/* Route Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Roteiro</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedRoute || ''} onValueChange={setSelectedRoute}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Escolha um roteiro..." />
            </SelectTrigger>
            <SelectContent>
              {routes.map((route) => (
                <SelectItem key={route.id} value={route.id}>
                  {route.name} ({route.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Steps List */}
      {selectedRoute && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Etapas do Roteiro</CardTitle>
            <Button onClick={() => openDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Etapa
            </Button>
          </CardHeader>
          <CardContent>
            {steps.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 mb-4">Nenhuma etapa cadastrada</p>
                <Button onClick={() => openDialog()} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar primeira etapa
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step) => (
                  <div key={step.id} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{step.sequence}</Badge>
                        <h4 className="font-semibold text-slate-900">{step.name}</h4>
                      </div>
                      {step.description && (
                        <p className="text-sm text-slate-600 mb-2">{step.description}</p>
                      )}
                      <div className="flex gap-4 text-xs text-slate-500">
                        <span>Tipo: {step.resource_type}</span>
                        {step.resource_id && <span>Recurso: {step.resource_id}</span>}
                        {step.estimated_time && <span>Tempo: {step.estimated_time}min</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog(step)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(step.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStep ? 'Editar Etapa' : 'Nova Etapa'}</DialogTitle>
            <DialogDescription>Preencha os detalhes da etapa de produção</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Sequência *</Label>
              <Input
                type="number"
                value={formData.sequence}
                onChange={(e) => setFormData({ ...formData, sequence: e.target.value })}
                min="1"
              />
            </div>

            <div>
              <Label>Nome da Etapa *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Usinagem, Pintura, Montagem"
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalhes da etapa"
              />
            </div>

            <div>
              <Label>Tipo de Recurso *</Label>
              <Select value={formData.resource_type} onValueChange={(value) => setFormData({ ...formData, resource_type: value })}>
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

            <div>
              <Label>Recurso</Label>
              <Select value={formData.resource_id} onValueChange={(value) => setFormData({ ...formData, resource_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar recurso" />
                </SelectTrigger>
                <SelectContent>
                  {resources.map((resource) => (
                    <SelectItem key={resource.id} value={resource.id}>
                      {resource.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tempo Estimado (minutos)</Label>
              <Input
                type="number"
                value={formData.estimated_time}
                onChange={(e) => setFormData({ ...formData, estimated_time: e.target.value })}
                min="0"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1 gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}