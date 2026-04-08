import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useCompanyId } from '@/components/useCompanyId';
import {
  ArrowLeft, Save, Clock, CheckCircle, XCircle, Pause, Play, Wrench, User, Calendar, DollarSign, UserCog, History, Loader2, Camera, Trash2, FileText, ImageIcon, Clipboard, Printer
} from 'lucide-react';
import SignatureCanvas from '@/components/inventory/SignatureCanvas';
import ServiceOrderReport from '@/components/service/ServiceOrderReport';
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

  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
  const [formData, setFormData] = useState({});
  const [changeTechDialogOpen, setChangeTechDialogOpen] = useState(false);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [showSignature, setShowSignature] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['service-order', orderId],
    queryFn: async () => {
      const data = await base44.entities.ServiceOrder.filter({ id: orderId });
      return data?.[0] || null;
    },
    enabled: !!orderId,
  });

  const { data: linkedQuotes } = useQuery({
    queryKey: ['service-order-quotes', order?.os_number],
    queryFn: async () => {
      if (!order?.os_number) return [];
      const all = await base44.entities.Quote.filter({ company_id: companyId });
      return (all || []).filter(q => q.notes?.includes(order.os_number));
    },
    enabled: !!order?.os_number,
  });

  useEffect(() => {
    if (order) {
      setFormData(order);
    }
  }, [order]);

  const activeQuote = linkedQuotes?.find(q => q.status !== 'REJEITADO');
  const hasLinkedQuotes = linkedQuotes && linkedQuotes.length > 0;
  const hasOnlyRejected = hasLinkedQuotes && !activeQuote;

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
        if (newStatus === 'EM_ANDAMENTO' && order.request_id) {
          await base44.entities.ServiceRequest.update(order.request_id, {
            status: 'EM_ATENDIMENTO'
          });
        }
        if (newStatus === 'CONCLUIDA') {
          updates.completed_at = new Date().toISOString();
          if (order.request_id) {
            await base44.entities.ServiceRequest.update(order.request_id, {
              status: 'ENCERRADA'
            });
          }
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
      service_photos: formData.service_photos || [],
      client_signature: formData.client_signature || null,
    };
    updateMutation.mutate(updates);
  };

  const handleImageCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      setFormData(prev => ({
        ...prev,
        service_photos: [...(prev.service_photos || []), base64String]
      }));
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index) => {
    setFormData(prev => {
      const newPhotos = [...(prev.service_photos || [])];
      newPhotos.splice(index, 1);
      return { ...prev, service_photos: newPhotos };
    });
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
          <Button onClick={() => setShowReport(true)} variant="outline" className="border-indigo-200 text-indigo-700">
            <Clipboard className="h-4 w-4 mr-2" />
            Gerar Relatório
          </Button>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            {/* Seção de Fotos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-tight flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-indigo-500" /> Relatório Fotográfico
                </label>
                {order.status !== 'CONCLUIDA' && (
                  <Button variant="outline" size="sm" className="relative cursor-pointer">
                    <Camera className="h-4 w-4 mr-2" />
                    Adicionar Foto
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleImageCapture}
                    />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {formData.service_photos?.map((photo, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-xl border overflow-hidden bg-slate-50 shadow-sm transition-all hover:shadow-md">
                    <img src={photo} alt={`Serviço ${idx + 1}`} className="w-full h-full object-cover" />
                    {order.status !== 'CONCLUIDA' && (
                      <button
                        onClick={() => removePhoto(idx)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {(!formData.service_photos || formData.service_photos.length === 0) && (
                  <div className="col-span-full py-8 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-xs font-medium">Nenhuma foto anexada</p>
                  </div>
                )}
              </div>
            </div>

            {/* Seção de Assinatura */}
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-tight flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-500" /> Assinatura do Cliente
              </label>
              <div className="bg-white rounded-xl border shadow-sm min-h-[200px] flex flex-col items-center justify-center p-4 relative group">
                {formData.client_signature ? (
                  <img src={formData.client_signature} alt="Assinatura" className="max-h-[150px] object-contain" />
                ) : (
                  <div className="text-center text-slate-300">
                    <User className="h-12 w-12 mx-auto mb-2 opacity-10" />
                    <p className="text-xs">Aguardando assinatura</p>
                  </div>
                )}
                {order.status !== 'CONCLUIDA' && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => setShowSignature(true)}
                  >
                    {formData.client_signature ? 'Refazer Assinatura' : 'Coletar Assinatura'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <label className="text-sm font-medium text-slate-700">Horas Trabalhadas</label>
              <Input
                type="text"
                value={formData.labor_hours || ''}
                onChange={(e) => setFormData({ ...formData, labor_hours: e.target.value })}
                placeholder="Ex: 2.5"
                className="mt-1"
                disabled={order.status === 'CONCLUIDA' || order.status === 'CANCELADA'}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Custo Mão de Obra (R$)</label>
              <Input
                type="number"
                value={formData.labor_cost || 0}
                onChange={(e) => setFormData({ ...formData, labor_cost: e.target.value })}
                className="mt-1"
                disabled={order.status === 'CONCLUIDA' || order.status === 'CANCELADA'}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Custo Peças (R$)</label>
              <Input
                type="number"
                value={formData.parts_cost || 0}
                onChange={(e) => setFormData({ ...formData, parts_cost: e.target.value })}
                className="mt-1"
                disabled={order.status === 'CONCLUIDA' || order.status === 'CANCELADA'}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-6 border-t mt-6">
            <div className="flex flex-col">
              <p className="text-sm text-slate-500">Custo Total (Orçamentos)</p>
              <div className="text-2xl font-bold text-indigo-600">
                {activeQuote || (linkedQuotes && linkedQuotes.length > 0) ? (
                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    linkedQuotes.reduce((acc, q) => acc + (q.status !== 'REJEITADO' ? (Number(q.total_amount) || 0) : 0), 0)
                  )
                ) : (
                  <span className="text-amber-600 text-lg uppercase tracking-tight italic">A definir</span>
                )}
              </div>
              {/* Listagem de Orçamentos Vinculados */}
              {hasLinkedQuotes && (
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-semibold text-slate-700">Orçamentos Vinculados:</p>
                  <div className="flex flex-wrap gap-2">
                    {linkedQuotes.map(q => (
                      <Link 
                        key={q.id} 
                        to={createPageUrl(`QuoteDetail?id=${q.id}`)}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                      >
                        <FileText className="h-3 w-3 text-indigo-600" />
                        <span className="text-xs font-mono font-medium">{q.quote_number}</span>
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${
                          q.status === 'REJEITADO' ? 'bg-red-50 text-red-600 border-red-100' : 
                          q.status === 'CONVERTIDO' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>
                          {q.status}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 mt-4">
                <Button
                  variant="outline"
                  disabled={isGeneratingQuote}
                  onClick={async () => {
                    try {
                      const confirm = window.confirm(
                        activeQuote 
                          ? "Já existe um orçamento ativo para esta OS. Deseja gerar um ORÇAMENTO COMPLEMENTAR?"
                          : "Deseja gerar um orçamento a partir desta OS?"
                      );
                      if (!confirm) return;

                      setIsGeneratingQuote(true);
                      // 1. Gerar número do orçamento
                      const allQuotes = await base44.entities.Quote.filter({ company_id: companyId }, '-created_date');
                      let nextNumber = 1;
                      if (allQuotes && allQuotes.length > 0) {
                        const lastQuote = allQuotes[0];
                        if (lastQuote.quote_number) {
                          const match = lastQuote.quote_number.match(/ORC-(\d+)/);
                          if (match) nextNumber = parseInt(match[1]) + 1;
                        }
                      }
                      const quoteNumber = `ORC-${String(nextNumber).padStart(6, '0')}`;

                      // 2. Criar orçamento
                      await base44.entities.Quote.create({
                        company_id: companyId,
                        client_id: order.client_id,
                        client_name: order.client_name,
                        quote_number: quoteNumber,
                        status: 'RASCUNHO',
                        notes: `Gerado a partir da OS ${order.os_number}. ${activeQuote ? '[COMPLEMENTAR]' : ''} Diagnóstico: ${formData.diagnosis || ''}`,
                        total_amount: Number(formData.labor_cost || 0) + Number(formData.parts_cost || 0)
                      });

                      // 3. Vincular na OS usando o campo 'description' (histórico)
                      const newDesc = formData.description 
                        ? `${formData.description}\n[VINCULO ${activeQuote ? 'COMPLEMENTAR' : ''}: ${quoteNumber}]`
                        : `[VINCULO ${activeQuote ? 'COMPLEMENTAR' : ''}: ${quoteNumber}]`;
                      
                      await base44.entities.ServiceOrder.update(orderId, {
                        description: newDesc
                      });

                      setFormData(prev => ({ ...prev, description: newDesc }));
                      toast.success(`Orçamento ${quoteNumber} gerado com sucesso!`);
                      queryClient.invalidateQueries({ queryKey: ['service-order-quotes', order.os_number] });
                    } catch (err) {
                      toast.error("Erro ao gerar orçamento: " + err.message);
                    } finally {
                      setIsGeneratingQuote(false);
                    }
                  }}
                  className="border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                  {isGeneratingQuote ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  {isGeneratingQuote 
                    ? 'Gerando...' 
                    : activeQuote 
                      ? 'Orçamento Complementar' 
                      : hasOnlyRejected 
                        ? 'Gerar Novo Orçamento' 
                        : 'Gerar Orçamento'
                  }
                </Button>

                {order.status !== 'CONCLUIDA' && order.status !== 'CANCELADA' && (
                  <Button 
                    onClick={handleSave} 
                    disabled={updateMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature Dialog */}
      <Dialog open={showSignature} onOpenChange={setShowSignature}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Coletar Assinatura do Cliente</DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <SignatureCanvas 
              onSave={(sig) => {
                setFormData({ ...formData, client_signature: sig });
                setShowSignature(false);
              }}
              initialSignature={formData.client_signature}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Modal */}
      {showReport && (
        <ServiceOrderReport 
          order={order}
          history={techHistory}
          quotes={linkedQuotes}
          onClose={() => setShowReport(false)}
        />
      )}

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