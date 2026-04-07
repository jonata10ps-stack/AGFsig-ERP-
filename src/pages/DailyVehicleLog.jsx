import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Car, Plus, Check, Clock, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

export default function DailyVehicleLog() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [closingLog, setClosingLog] = useState(null);
  const [editingLog, setEditingLog] = useState(null);
  const [closeFormData, setCloseFormData] = useState({ km_end: 0, notes: '' });
  const [editFormData, setEditFormData] = useState({ km_start: '', km_end: 0, notes: '', is_company_vehicle: true });
  const [formData, setFormData] = useState({
    log_date: today,
    km_start: '',
    km_end: 0,
    is_company_vehicle: true,
    notes: '',
  });

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: sellers } = useQuery({
    queryKey: ['sellers', companyId],
    queryFn: () => companyId ? base44.entities.Seller.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ['daily-vehicle-logs', companyId],
    queryFn: () => companyId ? base44.entities.DailyVehicleLog.filter({ company_id: companyId }, '-log_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const currentSeller = useMemo(() => {
    if (!user || !sellers) return null;
    return sellers.find(s => 
      s.email?.toLowerCase() === user.email?.toLowerCase() || 
      s.name?.toLowerCase() === user.full_name?.toLowerCase()
    );
  }, [user, sellers]);

  const todayLog = useMemo(() => {
    if (!logs || !user) return null;
    if (currentSeller) {
      return logs.find(log => log.seller_id === currentSeller.id && log.log_date === today);
    }
    return logs.find(log => log.created_by === user.email && log.log_date === today);
  }, [logs, user, currentSeller, today]);

  const createMutation = useMutation({
      mutationFn: async (data) => {
        const payload = {
          ...data,
          company_id: companyId,
          created_by: user.email,
          km_start: data.km_start ? parseFloat(data.km_start) : 0,
        };

        if (currentSeller) {
          return await base44.entities.DailyVehicleLog.create({
            ...payload,
            seller_id: currentSeller.id,
            seller_name: currentSeller.name,
            status: 'ABERTO',
          });
        } else {
          return await base44.entities.DailyVehicleLog.create({
            ...payload,
            seller_id: user.id,
            seller_name: user.full_name || user.email,
            status: 'ABERTO',
          });
        }
      },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['daily-vehicle-logs', companyId] });
      toast.success('Registro iniciado com sucesso!');
      setDialogOpen(false);
      setFormData({
        log_date: today,
        km_start: '',
        km_end: 0,
        is_company_vehicle: true,
        notes: '',
      });
    },
    onError: (error) => {
      toast.error('Erro ao criar registro: ' + error.message);
    }
  });

  const closeMutation = useMutation({
    mutationFn: async ({ id, km_end, notes }) => {
      return await base44.entities.DailyVehicleLog.update(id, {
        km_end,
        notes,
        status: 'FECHADO',
      });
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['daily-vehicle-logs', companyId] });
       toast.success('Registro fechado com sucesso!');
     },
    onError: (error) => {
      toast.error('Erro ao fechar registro: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.DailyVehicleLog.update(id, data);
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['daily-vehicle-logs', companyId] });
       toast.success('Registro atualizado com sucesso!');
       setEditDialogOpen(false);
       setEditingLog(null);
     },
    onError: (error) => {
      toast.error('Erro ao atualizar registro: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.is_company_vehicle && (!formData.km_start || parseFloat(formData.km_start) <= 0)) {
      toast.error('Informe o KM inicial');
      return;
    }
    createMutation.mutate({
      ...formData,
      km_start: formData.km_start ? parseFloat(formData.km_start) : 0
    });
  };

  const openCloseDialog = (log) => {
    setClosingLog(log);
    setCloseFormData({ km_end: log.km_start, notes: log.notes || '' });
    setCloseDialogOpen(true);
  };

  const handleCloseSubmit = (e) => {
    e.preventDefault();
    if (closeFormData.km_end < closingLog.km_start) {
      toast.error('KM final deve ser maior ou igual ao KM inicial');
      return;
    }
    closeMutation.mutate({ 
      id: closingLog.id, 
      km_end: closeFormData.km_end, 
      notes: closeFormData.notes 
    });
    setCloseDialogOpen(false);
    setClosingLog(null);
  };

  const openEditDialog = (log) => {
    setEditingLog(log);
    setEditFormData({
      km_start: log.km_start || '',
      km_end: log.km_end || 0,
      notes: log.notes || '',
      is_company_vehicle: log.is_company_vehicle
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (editFormData.is_company_vehicle && (!editFormData.km_start || parseFloat(editFormData.km_start) <= 0)) {
      toast.error('Informe o KM inicial');
      return;
    }
    if (editFormData.km_end > 0 && editFormData.km_end < parseFloat(editFormData.km_start)) {
      toast.error('KM final deve ser maior ou igual ao KM inicial');
      return;
    }
    
    const kmEnd = editFormData.km_end || 0;
    const newStatus = kmEnd > 0 ? 'FECHADO' : 'ABERTO';
    
    updateMutation.mutate({
      id: editingLog.id,
      data: {
        km_start: editFormData.km_start ? parseFloat(editFormData.km_start) : 0,
        km_end: kmEnd,
        notes: editFormData.notes,
        is_company_vehicle: editFormData.is_company_vehicle,
        status: newStatus
      }
    });
  };

  const userLogs = useMemo(() => {
    if (!logs || !user) return [];
    if (currentSeller) {
      return logs.filter(log => log.seller_id === currentSeller.id);
    }
    return logs.filter(log => log.created_by === user.email);
  }, [logs, user, currentSeller]);

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registro de KM Diário</h1>
          <p className="text-slate-500">Controle de quilometragem do veículo</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Registro de KM</DialogTitle>
              <DialogDescription className="sr-only">Inicie o controle de quilometragem registrando o KM inicial do veículo.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Data</label>
                <Input
                  type="date"
                  value={formData.log_date}
                  onChange={(e) => setFormData({ ...formData, log_date: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_company_vehicle}
                  onChange={(e) => setFormData({ ...formData, is_company_vehicle: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm font-medium">Veículo da empresa</label>
              </div>
              {formData.is_company_vehicle && (
                <div>
                  <label className="text-sm font-medium">KM Inicial *</label>
                  <Input
                    type="number"
                    value={formData.km_start}
                    onChange={(e) => setFormData({ ...formData, km_start: e.target.value })}
                    className="mt-1"
                    required
                    min="0"
                    step="0.1"
                    placeholder="Ex: 12345"
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Observações</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-1"
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Salvando...' : 'Criar Registro'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {todayLog && (
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Car className="h-8 w-8 text-indigo-600" />
                <div>
                  <p className="font-medium text-slate-900">Registro de Hoje</p>
                  <p className="text-sm text-slate-600">
                    {todayLog.is_company_vehicle ? (
                      <>KM Inicial: {todayLog.km_start}{todayLog.km_end > 0 && ` → Final: ${todayLog.km_end}`}</>
                    ) : (
                      'Veículo particular'
                    )}
                  </p>
                  {todayLog.km_end > todayLog.km_start && (
                    <p className="text-sm font-medium text-indigo-600">
                      Percorrido: {(todayLog.km_end - todayLog.km_start).toFixed(1)} km
                    </p>
                  )}
                </div>
              </div>
              <div>
                {todayLog.status === 'ABERTO' && todayLog.is_company_vehicle ? (
                  <Button onClick={() => openCloseDialog(todayLog)} variant="outline">
                    <Check className="h-4 w-4 mr-2" />
                    Informar KM Final
                  </Button>
                ) : todayLog.status === 'ABERTO' && !todayLog.is_company_vehicle ? (
                  <Button onClick={() => closeMutation.mutate({ id: todayLog.id, km_end: 0, notes: todayLog.notes || '' })} variant="outline">
                    <Check className="h-4 w-4 mr-2" />
                    Fechar Dia
                  </Button>
                ) : (
                  <Badge className="bg-green-100 text-green-700">
                    <Check className="h-3 w-3 mr-1" />
                    Fechado
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar Registro do Dia</DialogTitle>
            <DialogDescription className="sr-only">Finalize o controle de quilometragem registrando o KM final do veículo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCloseSubmit} className="space-y-4">
            {closingLog?.is_company_vehicle && (
              <>
                <div>
                  <label className="text-sm font-medium">KM Inicial (informado)</label>
                  <Input
                    type="number"
                    value={closingLog?.km_start || 0}
                    disabled
                    className="mt-1 bg-slate-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">KM Final *</label>
                  <Input
                    type="number"
                    value={closeFormData.km_end}
                    onChange={(e) => setCloseFormData({ ...closeFormData, km_end: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                    required
                    min={closingLog?.km_start || 0}
                  />
                </div>
                {closeFormData.km_end > (closingLog?.km_start || 0) && (
                  <p className="text-sm text-slate-600">
                    Distância percorrida: {(closeFormData.km_end - (closingLog?.km_start || 0)).toFixed(1)} km
                  </p>
                )}
              </>
            )}
            <div>
              <label className="text-sm font-medium">Observações</label>
              <Textarea
                value={closeFormData.notes}
                onChange={(e) => setCloseFormData({ ...closeFormData, notes: e.target.value })}
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setCloseDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                Fechar Registro
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
            <DialogDescription className="sr-only">Altere as informações de quilometragem ou observações do registro.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Data</label>
              <Input
                type="date"
                value={editingLog?.log_date || ''}
                disabled
                className="mt-1 bg-slate-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editFormData.is_company_vehicle}
                onChange={(e) => setEditFormData({ ...editFormData, is_company_vehicle: e.target.checked })}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Veículo da empresa</label>
            </div>
            {editFormData.is_company_vehicle && (
              <>
                <div>
                  <label className="text-sm font-medium">KM Inicial *</label>
                  <Input
                    type="number"
                    value={editFormData.km_start}
                    onChange={(e) => setEditFormData({ ...editFormData, km_start: e.target.value })}
                    className="mt-1"
                    required
                    min="0"
                    step="0.1"
                    placeholder="Ex: 12345"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">KM Final</label>
                  <Input
                    type="number"
                    value={editFormData.km_end}
                    onChange={(e) => setEditFormData({ ...editFormData, km_end: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                    min="0"
                    step="0.1"
                    placeholder="Deixe 0 se ainda não finalizado"
                  />
                </div>
                {editFormData.km_end > 0 && editFormData.km_start && (
                  <p className="text-sm text-slate-600">
                    Distância percorrida: {(editFormData.km_end - parseFloat(editFormData.km_start)).toFixed(1)} km
                  </p>
                )}
              </>
            )}
            <div>
              <label className="text-sm font-medium">Observações</label>
              <Textarea
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Registros</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">KM Inicial</TableHead>
                <TableHead className="text-right">KM Final</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                userLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {/* Fix: Use T12:00:00 to avoid timezone shift in display */}
                      {new Date(`${log.log_date}T12:00:00`).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>{log.seller_name}</TableCell>
                    <TableCell>
                      {log.is_company_vehicle ? (
                        <Badge variant="outline">Empresa</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-100">Particular</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.is_company_vehicle ? log.km_start : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.is_company_vehicle && log.km_end > 0 ? log.km_end : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {log.is_company_vehicle && log.km_end > 0 ? 
                        `${(log.km_end - log.km_start).toFixed(1)} km` : '-'}
                    </TableCell>
                    <TableCell>
                      {log.status === 'ABERTO' ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          <Clock className="h-3 w-3 mr-1" />
                          Aberto
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          <Check className="h-3 w-3 mr-1" />
                          Fechado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => openEditDialog(log)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}