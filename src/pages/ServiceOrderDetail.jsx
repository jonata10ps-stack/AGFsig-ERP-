import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useCompanyId } from '@/components/useCompanyId';
import {
  ArrowLeft, Save, Clock, CheckCircle, XCircle, Pause, Play, Wrench, User, Calendar, DollarSign, UserCog, History, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusColors = {
  PENDENTE: 'bg-slate-100 text-slate-700',
  EM_ANDAMENTO: 'bg-indigo-100 text-indigo-700',
  PAUSADA: 'bg-amber-100 text-amber-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const priorityColors = {
  BAIXA: 'bg-slate-100 text-slate-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  ALTA: 'bg-orange-100 text-orange-700',
  URGENTE: 'bg-red-100 text-red-700',
};

export default function ServiceOrderDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  const [formData, setFormData] = useState({});
  const [changeTechDialogOpen, setChangeTechDialogOpen] = useState(false);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [changeReason, setChangeReason] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['service-order', orderId],
    queryFn: async () => {
      const data = await base44.entities.ServiceOrder.filter({ id: orderId });
      const orderData = data?.[0];
      if (orderData) {
        setFormData(orderData);
      }
      return orderData;
    },
    enabled: !!orderId,
  });

  const { data: technicians } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.Technician.filter({ active: true }),
  });

  const { data: techHistory } = useQuery({
    queryKey: ['technician-history', orderId],
    queryFn: () => base44.entities.TechnicianHistory.filter({ service_order_id: orderId }, '-created_date'),
    enabled: !!orderId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      try {
        console.log('Enviando atualização de OS:', data);
        const result = await base44.entities.ServiceOrder.update(orderId, data);
        if (!result) throw new Error('Não foi possível atualizar o registro no banco.');
        return result;
      } catch (err) {
        console.error('Erro detalhado no updateMutation:', err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      toast.success('Ordem de serviço atualizada com sucesso');
      navigate(createPageUrl('ServiceOrders'));
    },
    onError: (error) => {
      toast.error(`Falha ao salvar: ${error.message}`);
    }
  });

  const changeStatusMutation = useMutation({
    mutationFn: async (newStatus) => {
      try {
        const updates = { status: newStatus };
        if (newStatus === 'EM_ANDAMENTO' && !order.started_at) {
          updates.started_at = new Date().toISOString();
        }
        if (newStatus === 'CONCLUIDA') {
          updates.completed_at = new Date().toISOString();
          updates.total_cost = Number(formData.labor_cost || 0) + Number(formData.parts_cost || 0);
        }
        return await base44.entities.ServiceOrder.update(orderId, updates);
      } catch (err) {
        console.error('Erro ao mudar status:', err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      toast.success('Status atualizado');
    },
    onError: (error) => {
      toast.error(`Erro ao mudar status: ${error.message}`);
    }
  });

  const handleSave = () => {
    const updates = {
      diagnosis: formData.diagnosis,
      solution: formData.solution,
      parts_used: formData.parts_used,
      labor_hours: formData.labor_hours || "0",
      labor_cost: Number(formData.labor_cost || 0),
      parts_cost: Number(formData.parts_cost || 0),
      total_cost: Number(formData.labor_cost || 0) + Number(formData.parts_cost || 0),
      scheduled_date: formData.scheduled_date,
    };
    updateMutation.mutate(updates);
  };
   const changeTechnicianMutation = useMutation({
    mutationFn: async () => {
      try {
        if (!selectedTechnicianId) {
          toast.error('Por favor, selecione um técnico');
          return;
        }

        // 1. Obter usuário e dados necessários
        const user = await base44.auth.me().catch(() => ({ email: 'Sistema' }));
        const newTech = technicians?.find(t => t.id === selectedTechnicianId);
        
        console.log('Iniciando troca de técnico...', { orderId, selectedTechnicianId });

        // 2. ATUALIZAR OS PRIMEIRO (Ação principal)
        // Isso garante que o técnico mude mesmo que o histórico falhe
        const updateResult = await base44.entities.ServiceOrder.update(orderId, {
          technician_id: selectedTechnicianId,
          technician_name: newTech?.name || 'Técnico'
        });

        if (!updateResult) throw new Error('Falha ao atualizar a Ordem de Serviço no banco de dados');

        // 3. REGISTRAR HISTÓRICO (Ação secundária)
        try {
          await base44.entities.TechnicianHistory.create({
            company_id: companyId,
            service_order_id: orderId,
            from_technician_id: order?.technician_id || null,
            from_technician_name: order?.technician_name || 'Não atribuído',
            to_technician_id: selectedTechnicianId,
            to_technician_name: newTech?.name || 'Técnico',
            reason: changeReason || 'Alteração manual pelo usuário',
            changed_by: user?.email || 'Usuário'
          });
        } catch (historyErr) {
          // Apenas log de aviso, não interrompe o sucesso da OS
          console.warn('Erro ao salvar histórico (ignorado):', historyErr);
        }

        return true;
      } catch (err) {
        console.error('Erro crítico na troca de técnico:', err);
        throw new Error(err.message || 'Erro desconhecido ao atualizar técnico');
      }
    },
    onSuccess: () => {
      toast.success('Alteração realizada com sucesso!');
      // Atualizar cache e fechar modal
      queryClient.invalidateQueries({ queryKey: ['service-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['technician-history', orderId] });
      setChangeTechDialogOpen(false);
      setSelectedTechnicianId('');
      setChangeReason('');
    },
    onError: (error) => {
      toast.error(`Falha: ${error.message}`);
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Ordem de serviço não encontrada</p>
        <Link to={createPageUrl('ServiceOrders')}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('ServiceOrders')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">OS {order.os_number}</h1>
            <div className="flex gap-2 mt-1">
              <Badge className={statusColors[order.status]}>{order.status}</Badge>
              <Badge className={priorityColors[order.priority]}>{order.priority}</Badge>
              <Badge variant="outline">{order.type}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {order.status === 'PENDENTE' && (
            <Button onClick={() => changeStatusMutation.mutate('EM_ANDAMENTO')} className="bg-indigo-600">
              <Play className="h-4 w-4 mr-2" />
              Iniciar
            </Button>
          )}
          {order.status === 'EM_ANDAMENTO' && (
            <>
              <Button onClick={() => changeStatusMutation.mutate('PAUSADA')} variant="outline">
                <Pause className="h-4 w-4 mr-2" />
                Pausar
              </Button>
              <Button onClick={() => changeStatusMutation.mutate('CONCLUIDA')} className="bg-emerald-600">
                <CheckCircle className="h-4 w-4 mr-2" />
                Concluir
              </Button>
            </>
          )}
          {order.status === 'PAUSADA' && (
            <Button onClick={() => changeStatusMutation.mutate('EM_ANDAMENTO')} className="bg-indigo-600">
              <Play className="h-4 w-4 mr-2" />
              Retomar
            </Button>
          )}
          {order.status !== 'CONCLUIDA' && order.status !== 'CANCELADA' && (
            <Button onClick={() => changeStatusMutation.mutate('CANCELADA')} variant="destructive">
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informações da OS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Cliente</p>
                <p className="font-medium">{order.client_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Produto</p>
                <p className="font-medium">{order.product_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Número de Série</p>
                <p className="font-medium">{order.serial_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Técnico</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{order.technician_name || 'Não atribuído'}</p>
                  {order.status !== 'CONCLUIDA' && order.status !== 'CANCELADA' && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setChangeTechDialogOpen(true)}
                      className="h-6 px-2"
                    >
                      <UserCog className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Data Criação</p>
                <p className="font-medium">
                  {order.created_date || order.created_at ? format(new Date(order.created_date || order.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Data Agendamento</label>
                <Input
                  type="date"
                  value={formData.scheduled_date || ''}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  disabled={order.status === 'CONCLUIDA' || order.status === 'CANCELADA'}
                />
              </div>
              </div>

            <Separator />

            <div>
              <p className="text-sm text-slate-500 mb-2">Descrição do Problema</p>
              <p className="text-sm">{order.description}</p>
            </div>
          </CardContent>
        </Card>

        {/* Technician History Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Timeline */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="mt-1">
                  <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-slate-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Criada</p>
                  <p className="text-xs text-slate-500">
                    {order.created_date || order.created_at ? format(new Date(order.created_date || order.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                  </p>
                </div>
              </div>

              {order.started_at && (
                <div className="flex gap-3">
                  <div className="mt-1">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Play className="h-4 w-4 text-indigo-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Iniciada</p>
                    <p className="text-sm font-medium text-slate-900">
                      {order.created_date ? format(new Date(order.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Não informada'}
                    </p>
                  </div>
                </div>
              )}

              {order.completed_at && (
                <div className="flex gap-3">
                  <div className="mt-1">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Concluída</p>
                    <p className="text-xs text-slate-500">
                      {order.completed_at ? format(new Date(order.completed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Technician Changes */}
            {techHistory && techHistory.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">Mudanças de Técnico</p>
                  {techHistory.map((change, idx) => (
                    <div key={change.id} className="flex gap-3">
                      <div className="mt-1">
                        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                          <UserCog className="h-4 w-4 text-amber-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="text-slate-500">De:</span> <span className="font-medium">{change.from_technician_name || 'Não atribuído'}</span>
                        </p>
                        <p className="text-sm">
                          <span className="text-slate-500">Para:</span> <span className="font-medium">{change.to_technician_name}</span>
                        </p>
                        {change.reason && (
                          <p className="text-xs text-slate-500 mt-1">{change.reason}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          {change.created_date || change.created_at ? format(new Date(change.created_date || change.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'} • {change.changed_by}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Service Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Detalhes do Serviço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Diagnóstico</label>
              <Textarea
                value={formData.diagnosis || ''}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                placeholder="Descreva o diagnóstico..."
                className="mt-1"
                rows={4}
                disabled={order.status === 'CONCLUIDA' || order.status === 'CANCELADA'}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Solução Aplicada</label>
              <Textarea
                value={formData.solution || ''}
                onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
                placeholder="Descreva a solução..."
                className="mt-1"
                rows={4}
                disabled={order.status === 'CONCLUIDA' || order.status === 'CANCELADA'}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Peças Utilizadas</label>
            <Textarea
              value={formData.parts_used || ''}
              onChange={(e) => setFormData({ ...formData, parts_used: e.target.value })}
              placeholder="Liste as peças utilizadas..."
              className="mt-1"
              rows={3}
              disabled={order.status === 'CONCLUIDA' || order.status === 'CANCELADA'}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Horas Trabalhadas</label>
              <Input
                type="number"
                value={formData.labor_hours || 0}
                onChange={(e) => setFormData({ ...formData, labor_hours: parseFloat(e.target.value) || 0 })}
                className="mt-1"
                disabled={order.status === 'CONCLUIDA' || order.status === 'CANCELADA'}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Custo Mão de Obra</label>
              <Input
                type="number"
                value={formData.labor_cost || 0}
                onChange={(e) => setFormData({ ...formData, labor_cost: parseFloat(e.target.value) || 0 })}
                className="mt-1"
                disabled={order.status === 'CONCLUIDA' || order.status === 'CANCELADA'}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Custo Peças</label>
              <Input
                type="number"
                value={formData.parts_cost || 0}
                onChange={(e) => setFormData({ ...formData, parts_cost: parseFloat(e.target.value) || 0 })}
                className="mt-1"
                disabled={order.status === 'CONCLUIDA' || order.status === 'CANCELADA'}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4">
            <div>
              <p className="text-sm text-slate-500">Custo Total</p>
              <p className="text-2xl font-bold text-indigo-600">
                R$ {(Number(formData.labor_cost || 0) + Number(formData.parts_cost || 0)).toFixed(2)}
              </p>
            </div>
            {order.status !== 'CONCLUIDA' && order.status !== 'CANCELADA' && (
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Technician Dialog */}
      <Dialog open={changeTechDialogOpen} onOpenChange={setChangeTechDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Alterar Técnico
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500 mb-2">Técnico Atual</p>
              <p className="font-medium">{order.technician_name || 'Não atribuído'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Novo Técnico</label>
              <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione um técnico" />
                </SelectTrigger>
                <SelectContent>
                  {technicians?.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Motivo da Mudança</label>
              <Textarea
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Descreva o motivo..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setChangeTechDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => changeTechnicianMutation.mutate()}
                disabled={!selectedTechnicianId || changeTechnicianMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]"
              >
                {changeTechnicianMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </div>
                ) : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}