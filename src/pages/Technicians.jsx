import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Plus, Search, Edit, Trash2, Loader2, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

export default function Technicians() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState(null);
  const [deletingTechnician, setDeletingTechnician] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    specialties: [],
    active: true
  });

  const { data: technicians, isLoading, error } = useQuery({
    queryKey: ['technicians', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      // O fallback de sorting já é tratado globalmente no base44Client
      return await base44.entities.Technician.filter({ company_id: companyId }, '-created_at');
    },
    enabled: !!companyId,
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      email: '',
      phone: '',
      specialties: [],
      active: true
    });
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Technician.create({ ...data, company_id: companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians', companyId] });
      setDialogOpen(false);
      resetForm();
      toast.success('Técnico criado com sucesso');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Technician.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians', companyId] });
      setDialogOpen(false);
      setEditingTechnician(null);
      resetForm();
      toast.success('Técnico atualizado');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Technician.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians', companyId] });
      setDeleteDialogOpen(false);
      setDeletingTechnician(null);
      toast.success('Técnico removido');
    },
  });

  const handleEdit = (tech) => {
    setEditingTechnician(tech);
    // Garantir que specialties seja um array
    let specs = [];
    if (Array.isArray(tech.specialties)) {
      specs = tech.specialties;
    } else if (typeof tech.specialties === 'string') {
      specs = tech.specialties.split(',').map(s => s.trim()).filter(Boolean);
    }

    setFormData({
      code: tech.code || '',
      name: tech.name || '',
      email: tech.email || '',
      phone: tech.phone || '',
      specialties: specs,
      active: tech.active !== false
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTechnician) {
      updateMutation.mutate({ id: editingTechnician.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredTechnicians = technicians?.filter(tech =>
    !search || 
    tech?.name?.toLowerCase().includes(search.toLowerCase()) ||
    tech?.code?.toLowerCase().includes(search.toLowerCase())
  );

  // Auxiliar para normalizar especialidades para renderização segura
  const renderSpecialties = (tech) => {
    let specs = [];
    if (Array.isArray(tech.specialties)) {
      specs = tech.specialties;
    } else if (typeof tech.specialties === 'string' && tech.specialties.length > 0) {
      specs = tech.specialties.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (specs.length === 0) return <span className="text-slate-400">-</span>;

    return (
      <div className="flex gap-1 flex-wrap">
        {specs.map((spec, idx) => (
          <Badge key={idx} variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 border-none">
            {spec}
          </Badge>
        ))}
      </div>
    );
  };

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">Erro ao carregar técnicos. Por favor, tente novamente.</p>
        <Button onClick={() => queryClient.invalidateQueries(['technicians'])} className="mt-4">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-premium">Técnicos</h1>
          <p className="text-slate-500">Gestão da equipe técnica de serviço</p>
        </div>
        <Button 
          onClick={() => { setEditingTechnician(null); resetForm(); setDialogOpen(true); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Técnico
        </Button>
      </div>

      <Card className="glass-card border-slate-200/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
              <p className="text-slate-500 text-sm">Carregando técnicos...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-slate-50/30">
                  <TableHead className="font-semibold text-slate-700 w-[120px] pl-6">Código</TableHead>
                  <TableHead className="font-semibold text-slate-700">Nome</TableHead>
                  <TableHead className="font-semibold text-slate-700">Contato</TableHead>
                  <TableHead className="font-semibold text-slate-700">Especialidades</TableHead>
                  <TableHead className="font-semibold text-slate-700">Status</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700 pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filteredTechnicians?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                      Nenhum técnico encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTechnicians.map((tech) => (
                    <TableRow key={tech.id} className="hover:bg-indigo-50/20 transition-colors">
                      <TableCell className="font-mono text-[11px] text-slate-500 pl-6">{tech.code}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{tech.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-700">{tech.email || '-'}</span>
                          <span className="text-xs text-slate-400">{tech.phone || ''}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {renderSpecialties(tech)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={tech.active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}>
                          {tech.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(tech)} className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => { setDeletingTechnician(tech); setDeleteDialogOpen(true); }}
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Formulário */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-indigo-600" />
              {editingTechnician ? 'Editar Técnico' : 'Novo Técnico'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Código</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="TEC-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Nome Completo</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do técnico"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="usuario@email.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Telefone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Especialidades (separadas por vírgula)</label>
              <Input
                value={formData.specialties.join(', ')}
                onChange={(e) => setFormData({
                  ...formData,
                  specialties: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                })}
                placeholder="Ex: Elétrica, Mecânica, Ar Condicionado"
              />
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <input
                id="tech-active"
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <label htmlFor="tech-active" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                Técnico Ativo
              </label>
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                {editingTechnician ? 'Salvar Alterações' : 'Criar Técnico'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">
              Tem certeza que deseja remover o técnico <strong className="text-slate-900">{deletingTechnician?.name}</strong>?
            </p>
            <p className="text-xs text-slate-400 mt-2">Esta ação não poderá ser desfeita.</p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteMutation.mutate(deletingTechnician.id)}
              disabled={deleteMutation.isPending}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}