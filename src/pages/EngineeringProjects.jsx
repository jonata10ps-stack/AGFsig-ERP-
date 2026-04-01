import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, Eye, Cpu, Zap, Layers, Clock, Calendar, User, AlertTriangle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  PLANEJAMENTO:  { label: 'Planejamento',  color: 'bg-slate-100 text-slate-700' },
  EM_ANDAMENTO:  { label: 'Em Andamento',  color: 'bg-blue-100 text-blue-700' },
  REVISAO:       { label: 'Em Revisão',    color: 'bg-amber-100 text-amber-700' },
  APROVADO:      { label: 'Aprovado',      color: 'bg-emerald-100 text-emerald-700' },
  CONCLUIDO:     { label: 'Concluído',     color: 'bg-purple-100 text-purple-700' },
  CANCELADO:     { label: 'Cancelado',     color: 'bg-red-100 text-red-700' },
};

const TYPE_CONFIG = {
  MECANICO:          { label: 'Mecânico',         icon: Cpu,    color: 'text-blue-600', bg: 'bg-blue-50' },
  ELETRICO:          { label: 'Elétrico',         icon: Zap,    color: 'text-amber-600', bg: 'bg-amber-50' },
  MECANICO_ELETRICO: { label: 'Mec. + Elétrico', icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50' },
};

const PRIORITY_CONFIG = {
  BAIXA:   { label: 'Baixa',   color: 'bg-slate-100 text-slate-600' },
  NORMAL:  { label: 'Normal',  color: 'bg-blue-100 text-blue-600' },
  ALTA:    { label: 'Alta',    color: 'bg-orange-100 text-orange-600' },
  URGENTE: { label: 'Urgente', color: 'bg-red-100 text-red-700' },
};

const emptyForm = {
  code: '', name: '', type: 'MECANICO', status: 'PLANEJAMENTO', priority: 'NORMAL',
  product_name: '', product_description: '', responsible_name: '',
  start_date: '', estimated_end_date: '', estimated_hours: '',
  description: '', notes: '',
};

export default function EngineeringProjects() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['engineering-projects', companyId],
    queryFn: () => base44.entities.EngineeringProject.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.code || !form.name) throw new Error('Código e nome são obrigatórios');
      await base44.entities.EngineeringProject.create({
        ...form,
        company_id: companyId,
        estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : undefined,
        progress_percent: 0,
        actual_hours: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engineering-projects', companyId] });
      toast.success('Projeto criado com sucesso!');
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchType = filterType === 'all' || p.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Projetos de Engenharia</h1>
          <p className="text-slate-500 mt-1">Gestão de projetos mecânicos e elétricos</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-2" />
          Novo Projeto
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar projeto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="all">Todos os Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="all">Todos os Tipos</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <p className="text-center text-slate-500 py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-500 py-12">Nenhum projeto encontrado</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => {
            const typeCfg = TYPE_CONFIG[p.type] || TYPE_CONFIG.MECANICO;
            const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.PLANEJAMENTO;
            const priorityCfg = PRIORITY_CONFIG[p.priority] || PRIORITY_CONFIG.NORMAL;
            const TypeIcon = typeCfg.icon;
            const isDelayed = p.estimated_end_date &&
              p.status !== 'CONCLUIDO' && p.status !== 'CANCELADO' &&
              differenceInDays(new Date(), new Date(p.estimated_end_date)) > 0;

            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg ${typeCfg.bg}`}>
                      <TypeIcon className={`h-5 w-5 ${typeCfg.color}`} />
                    </div>
                    <div className="flex gap-2">
                      {isDelayed && <Badge className="bg-red-100 text-red-700 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Atrasado</Badge>}
                      <Badge className={priorityCfg.color}>{priorityCfg.label}</Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-mono">{p.code}</p>
                    <h3 className="font-semibold text-slate-900 mt-0.5">{p.name}</h3>
                    {p.product_name && <p className="text-sm text-slate-500 mt-0.5">{p.product_name}</p>}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{p.responsible_name || '—'}</span>
                    {p.estimated_end_date && (
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(p.estimated_end_date), 'dd/MM/yyyy')}</span>
                    )}
                  </div>
                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Progresso</span>
                      <span>{p.progress_percent || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${p.progress_percent || 0}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
                    <div className="flex gap-2">
                      {p.estimated_hours && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />{p.actual_hours || 0}/{p.estimated_hours}h
                        </span>
                      )}
                      <Link to={createPageUrl(`EngineeringProjectDetail?id=${p.id}`)}>
                        <Button size="sm" variant="outline"><Eye className="h-4 w-4" /></Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Projeto de Engenharia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código *</Label>
                <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="ENG-001" />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nome do projeto" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label>Produto/Máquina</Label>
              <Input value={form.product_name} onChange={e => setForm({...form, product_name: e.target.value})} placeholder="Nome do produto ou máquina" />
            </div>
            <div>
              <Label>Descrição do Produto/Máquina</Label>
              <Textarea value={form.product_description} onChange={e => setForm({...form, product_description: e.target.value})} rows={3} placeholder="Descreva o produto ou máquina..." />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={form.responsible_name} onChange={e => setForm({...form, responsible_name: e.target.value})} placeholder="Nome do responsável" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Data de Início</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
              </div>
              <div>
                <Label>Previsão de Fim</Label>
                <Input type="date" value={form.estimated_end_date} onChange={e => setForm({...form, estimated_end_date: e.target.value})} />
              </div>
              <div>
                <Label>Horas Estimadas</Label>
                <Input type="number" value={form.estimated_hours} onChange={e => setForm({...form, estimated_hours: e.target.value})} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>Descrição Geral</Label>
              <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} placeholder="Descrição geral do projeto..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} className="bg-indigo-600 hover:bg-indigo-700" disabled={createMutation.isPending}>
              Criar Projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}