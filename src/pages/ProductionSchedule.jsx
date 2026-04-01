import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar, CheckCircle2, X, ChevronDown, Play, Pause,
  AlertTriangle, Clock, Activity, Search, Filter, RefreshCw,
  ExternalLink, Layers
} from 'lucide-react';
import { useCompanyId } from '@/components/useCompanyId';
import moment from 'moment';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const OP_STATUS_CONFIG = {
  ABERTA: { label: 'Aberta', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  EM_ANDAMENTO: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  PAUSADA: { label: 'Pausada', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  ENCERRADA: { label: 'Encerrada', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  CANCELADA: { label: 'Cancelada', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

const STEP_STATUS_CONFIG = {
  PENDENTE: { label: 'Pendente', color: 'bg-amber-100 text-amber-700', bar: '#F59E0B' },
  EM_ANDAMENTO: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700', bar: '#3B82F6' },
  CONCLUIDA: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700', bar: '#10B981' },
  PULADA: { label: 'Pulada', color: 'bg-slate-100 text-slate-500', bar: '#94A3B8' },
  CANCELADA: { label: 'Cancelada', color: 'bg-red-100 text-red-700', bar: '#EF4444' },
  CANCELADA_USUARIO: { label: 'Cancelada pelo usuário', color: 'bg-orange-100 text-orange-700', bar: '#F97316' },
  ATRASADA: { label: 'Atrasada', color: 'bg-red-100 text-red-700', bar: '#DC2626' },
};

// Mini Gantt bar for a step within a timeline
function GanttBar({ step, timeStart, totalDays }) {
  if (!step.scheduled_start_date || !step.scheduled_end_date) return null;
  const start = moment(step.scheduled_start_date);
  const end = moment(step.scheduled_end_date);
  const offsetDays = start.diff(timeStart, 'days');
  const durationDays = Math.max(end.diff(start, 'days') + 1, 1);
  const left = Math.max((offsetDays / totalDays) * 100, 0);
  const width = Math.min((durationDays / totalDays) * 100, 100 - left);
  if (left > 100) return null;
  const cfg = STEP_STATUS_CONFIG[step.computedStatus] || STEP_STATUS_CONFIG.PENDENTE;
  return (
    <div
      className="absolute h-full rounded flex items-center px-1 overflow-hidden"
      style={{ left: `${left}%`, width: `${width}%`, backgroundColor: cfg.bar, opacity: 0.85 }}
      title={`${step.name}: ${moment(step.scheduled_start_date).format('DD/MM')} → ${moment(step.scheduled_end_date).format('DD/MM')}`}
    >
      <span className="text-white text-xs font-medium truncate hidden sm:block" style={{ fontSize: 10 }}>
        {step.name}
      </span>
    </div>
  );
}

export default function ProductionSchedule() {
  const { companyId } = useCompanyId();
  const [expandedOPs, setExpandedOPs] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [activeKPI, setActiveKPI] = useState(null); // 'late','inprogress','pending','done'
  const [editingStep, setEditingStep] = useState(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'gantt'

  const { data: steps = [], isLoading, refetch } = useQuery({
    queryKey: ['productionSteps', companyId],
    queryFn: () => companyId ? base44.entities.ProductionStep.filter({ company_id: companyId }, '-created_date', 2000) : [],
    enabled: !!companyId,
    refetchInterval: 30000,
  });

  const { data: ordersMap = {} } = useQuery({
    queryKey: ['productionOrders', companyId],
    queryFn: async () => {
      if (!companyId) return {};
      const data = await base44.entities.ProductionOrder.filter({ company_id: companyId }, '-created_date', 1000);
      return Object.fromEntries(data.map(o => [o.id, o]));
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    const unsub = base44.entities.ProductionStep.subscribe(() => refetch());
    return unsub;
  }, []);

  const today = moment().startOf('day');

  const enriched = useMemo(() => steps.map(step => {
    const op = ordersMap[step.op_id];
    const end = step.scheduled_end_date ? moment(step.scheduled_end_date) : null;
    let computedStatus = step.status;
    if (op?.status === 'CANCELADA') {
      computedStatus = 'CANCELADA';
    } else if (op?.status === 'ENCERRADA' && !['CONCLUIDA', 'PULADA', 'CANCELADA'].includes(step.status)) {
      computedStatus = 'CANCELADA_USUARIO';
    } else if (['PENDENTE', 'EM_ANDAMENTO'].includes(computedStatus) && end && end.isBefore(today)) {
      computedStatus = 'ATRASADA';
    }
    return { ...step, op, computedStatus };
  }), [steps, ordersMap, today]);

  // KPI counts
  const activeOPs = useMemo(() => Object.values(ordersMap).filter(o => ['ABERTA', 'EM_ANDAMENTO', 'PAUSADA'].includes(o.status)), [ordersMap]);
  const late = enriched.filter(s => s.computedStatus === 'ATRASADA').length;
  const inProgress = enriched.filter(s => s.computedStatus === 'EM_ANDAMENTO').length;
  const pending = enriched.filter(s => s.computedStatus === 'PENDENTE').length;
  const done = enriched.filter(s => s.computedStatus === 'CONCLUIDA').length;

  const pieData = [
    { name: 'Concluída', value: done, color: '#10B981' },
    { name: 'Em Andamento', value: inProgress, color: '#3B82F6' },
    { name: 'Pendente', value: pending, color: '#F59E0B' },
    { name: 'Atrasada', value: late, color: '#DC2626' },
  ].filter(d => d.value > 0);

  // Group by OP
  const grouped = useMemo(() => {
    const g = {};
    enriched.forEach(step => {
      if (!g[step.op_id]) g[step.op_id] = [];
      g[step.op_id].push(step);
    });
    Object.keys(g).forEach(id => g[id].sort((a, b) => a.sequence - b.sequence));
    return g;
  }, [enriched]);

  // Timeline range for Gantt
  const ganttStart = useMemo(() => today.clone().subtract(3, 'days'), [today]);
  const ganttTotalDays = 30;
  const ganttDays = useMemo(() => Array.from({ length: ganttTotalDays }, (_, i) => ganttStart.clone().add(i, 'days')), [ganttStart]);

  // All OP IDs: those with steps + those without steps (excluding cancelled)
  const allOPIds = useMemo(() => {
    const withSteps = new Set(Object.keys(grouped));
    // Include all ops from ordersMap that aren't already in grouped
    const allFromOrders = Object.keys(ordersMap).filter(id => !withSteps.has(id));
    // Combine and deduplicate
    const combined = [...Array.from(withSteps), ...allFromOrders];
    return combined;
  }, [grouped, ordersMap]);

  // Filter OPs
  const filteredOPIds = useMemo(() => {
    return allOPIds.filter(opId => {
      const op = ordersMap[opId];
      if (!op) return false;
      const matchSearch = !searchTerm ||
        op.numero_op_externo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.op_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.product_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'TODOS' || op.status === statusFilter;
      const opSteps = grouped[opId] || [];
      let matchKPI = true;
      if (activeKPI === 'late') matchKPI = opSteps.some(s => s.computedStatus === 'ATRASADA');
      if (activeKPI === 'inprogress') matchKPI = opSteps.some(s => s.computedStatus === 'EM_ANDAMENTO');
      if (activeKPI === 'pending') matchKPI = opSteps.some(s => s.computedStatus === 'PENDENTE') || opSteps.length === 0;
      if (activeKPI === 'done') matchKPI = opSteps.length > 0 && opSteps.every(s => ['CONCLUIDA','PULADA','CANCELADA'].includes(s.computedStatus));
      return matchSearch && matchStatus && matchKPI;
    }).sort((a, b) => {
      const aSteps = grouped[a] || [];
      const bSteps = grouped[b] || [];
      const aLate = aSteps.some(s => s.computedStatus === 'ATRASADA');
      const bLate = bSteps.some(s => s.computedStatus === 'ATRASADA');
      if (aLate !== bLate) return aLate ? -1 : 1;
      const aAct = aSteps.some(s => s.computedStatus === 'EM_ANDAMENTO');
      const bAct = bSteps.some(s => s.computedStatus === 'EM_ANDAMENTO');
      if (aAct !== bAct) return aAct ? -1 : 1;
      return 0;
    });
  }, [grouped, ordersMap, searchTerm, statusFilter, activeKPI]);

  const startStep = async (stepId) => { await base44.entities.ProductionStep.update(stepId, { status: 'EM_ANDAMENTO', started_at: new Date().toISOString() }); refetch(); };
  const pauseStep = async (stepId) => { await base44.entities.ProductionStep.update(stepId, { status: 'PENDENTE' }); refetch(); };
  const completeStep = async (stepId) => { await base44.entities.ProductionStep.update(stepId, { status: 'CONCLUIDA', completed_at: new Date().toISOString() }); refetch(); };
  const skipStep = async (stepId) => { await base44.entities.ProductionStep.update(stepId, { status: 'PULADA' }); refetch(); };

  const handleSaveDates = async () => {
    if (!editingStep) return;
    await base44.entities.ProductionStep.update(editingStep.id, { scheduled_start_date: editStartDate || null, scheduled_end_date: editEndDate || null });
    refetch(); setEditingStep(null);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
        <p className="text-slate-500">Carregando cronograma...</p>
      </div>
    </div>
  );

  // status pills for quick filter
  const quickFilters = [
    { key: null, label: 'Todos', count: allOPIds.length, color: 'bg-slate-100 text-slate-700 hover:bg-slate-200', activeColor: 'bg-indigo-600 text-white' },
    { key: 'late', label: '🔴 Atrasadas', count: late, color: 'bg-red-50 text-red-700 hover:bg-red-100', activeColor: 'bg-red-600 text-white' },
    { key: 'inprogress', label: '🔵 Em Andamento', count: inProgress, color: 'bg-blue-50 text-blue-700 hover:bg-blue-100', activeColor: 'bg-blue-600 text-white' },
    { key: 'pending', label: '🟡 Pendentes', count: pending, color: 'bg-amber-50 text-amber-700 hover:bg-amber-100', activeColor: 'bg-amber-500 text-white' },
    { key: 'done', label: '🟢 Concluídas', count: done, color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100', activeColor: 'bg-emerald-600 text-white' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cronograma de Produção</h1>
          <p className="text-slate-400 text-sm mt-0.5">{moment().format('dddd, DD [de] MMMM [de] YYYY')} · {filteredOPIds.length} OPs exibidas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Lista</button>
            <button onClick={() => setViewMode('gantt')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'gantt' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Gantt</button>
          </div>
        </div>
      </div>

      {/* KPI summary row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="col-span-2 md:col-span-1 bg-white border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{activeOPs.length}</p>
            <p className="text-xs text-slate-500">OPs Ativas</p>
          </div>
        </div>
        <div className={`bg-white border rounded-xl p-4 flex items-center gap-3 ${late > 0 ? 'border-red-200' : 'border-slate-200'}`}>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${late > 0 ? 'bg-red-100' : 'bg-slate-100'}`}>
            <AlertTriangle className={`h-5 w-5 ${late > 0 ? 'text-red-600' : 'text-slate-400'}`} />
          </div>
          <div>
            <p className={`text-2xl font-bold ${late > 0 ? 'text-red-600' : 'text-slate-900'}`}>{late}</p>
            <p className="text-xs text-slate-500">Atrasadas</p>
          </div>
        </div>
        <div className="bg-white border border-blue-100 rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Play className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-700">{inProgress}</p>
            <p className="text-xs text-slate-500">Em Andamento</p>
          </div>
        </div>
        <div className="bg-white border border-amber-100 rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-700">{pending}</p>
            <p className="text-xs text-slate-500">Pendentes</p>
          </div>
        </div>
        <div className="bg-white border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-700">{done}</p>
            <p className="text-xs text-slate-500">Concluídas</p>
          </div>
        </div>
      </div>

      {/* Quick filter pills + alert */}
      <div className="flex flex-wrap gap-2 items-center">
        {quickFilters.map(f => (
          <button
            key={String(f.key)}
            onClick={() => setActiveKPI(prev => prev === f.key ? (f.key === null ? null : null) : f.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${activeKPI === f.key ? f.activeColor + ' border-transparent shadow-sm' : f.color + ' border-transparent'}`}
          >
            {f.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeKPI === f.key ? 'bg-white/20' : 'bg-white/60'}`}>{f.count}</span>
          </button>
        ))}
        {late > 0 && (
          <span className="ml-auto text-xs text-red-600 font-medium flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> {late} etapa{late > 1 ? 's' : ''} com prazo vencido
          </span>
        )}
      </div>

      {/* Search + status filter */}
      <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-xl px-4 py-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar OP, produto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-8" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-8">
            <Filter className="h-3.5 w-3.5 mr-1 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todas as OPs</SelectItem>
            <SelectItem value="ABERTA">Aberta</SelectItem>
            <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
            <SelectItem value="PAUSADA">Pausada</SelectItem>
            <SelectItem value="ENCERRADA">Encerrada</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        {(statusFilter !== 'TODOS' || searchTerm || activeKPI) && (
          <Button variant="ghost" size="sm" className="h-8 text-slate-400 hover:text-slate-700"
            onClick={() => { setStatusFilter('TODOS'); setSearchTerm(''); setActiveKPI(null); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        )}
        <span className="text-xs text-slate-400 ml-auto">{filteredOPIds.length} resultados</span>
      </div>

      {/* GANTT VIEW */}
      {viewMode === 'gantt' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" /> Timeline Gantt (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Day header */}
              <div className="flex mb-2">
                <div className="w-48 flex-shrink-0" />
                <div className="flex-1 relative h-6">
                  {ganttDays.filter((_, i) => i % 5 === 0).map((d, i) => (
                    <span key={i} className="absolute text-xs text-slate-400 -translate-x-1/2" style={{ left: `${(i * 5 / ganttTotalDays) * 100}%` }}>
                      {d.format('DD/MM')}
                    </span>
                  ))}
                  {/* Today line marker */}
                  <div className="absolute top-0 bottom-0 w-px bg-red-500 opacity-60" style={{ left: `${(3 / ganttTotalDays) * 100}%` }} />
                </div>
              </div>
              {filteredOPIds.length === 0 && (
                <p className="text-center text-slate-400 py-8 text-sm">Nenhuma OP encontrada</p>
              )}
              {filteredOPIds.map(opId => {
                const op = ordersMap[opId];
                const opSteps = grouped[opId] || [];
                const cfg = OP_STATUS_CONFIG[op?.status];
                return (
                  <div key={opId} className="mb-1 flex items-center gap-0 group">
                    <div className="w-48 flex-shrink-0 pr-3 py-1">
                      <p className="text-xs font-semibold text-slate-700 truncate">{op?.numero_op_externo || op?.op_number}</p>
                      <p className="text-xs text-slate-400 truncate">{op?.product_name}</p>
                    </div>
                    <div className="flex-1 relative h-8 bg-slate-50 rounded border border-slate-100">
                      {/* Today vertical line */}
                      <div className="absolute top-0 bottom-0 w-px bg-red-400 opacity-40 z-10" style={{ left: `${(3 / ganttTotalDays) * 100}%` }} />
                      {opSteps.map(step => (
                        <GanttBar key={step.id} step={step} timeStart={ganttStart} totalDays={ganttTotalDays} />
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="mt-3 flex items-center gap-4 flex-wrap text-xs text-slate-500">
                {Object.entries(STEP_STATUS_CONFIG).filter(([k]) => k !== 'CANCELADA').map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: v.bar }} />
                    {v.label}
                  </span>
                ))}
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-px bg-red-500" /> Hoje</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {filteredOPIds.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-400">
                <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma OP encontrada com os filtros aplicados.</p>
                <button className="text-indigo-500 text-sm mt-2 underline" onClick={() => { setActiveKPI(null); setStatusFilter('TODOS'); setSearchTerm(''); }}>Limpar filtros</button>
              </CardContent>
            </Card>
          ) : (
            filteredOPIds.map(opId => {
              const op = ordersMap[opId];
              const opSteps = grouped[opId] || [];
              const isExpanded = expandedOPs[opId];
              const hasLate = opSteps.some(s => s.computedStatus === 'ATRASADA');
              const hasInProgress = opSteps.some(s => s.computedStatus === 'EM_ANDAMENTO');
              const total = opSteps.length;
              const done = opSteps.filter(s => ['CONCLUIDA', 'PULADA'].includes(s.computedStatus)).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const cfg = OP_STATUS_CONFIG[op?.status];

              return (
                <Card key={opId} className={`overflow-hidden ${hasLate ? 'border-red-200' : hasInProgress ? 'border-blue-200' : 'border-slate-200'}`}>
                  <div
                    className={`px-4 py-3 cursor-pointer flex items-center justify-between gap-3 transition-colors hover:bg-slate-50 ${hasLate ? 'bg-red-50/60' : hasInProgress ? 'bg-blue-50/40' : ''}`}
                    onClick={() => setExpandedOPs(prev => ({ ...prev, [opId]: !prev[opId] }))}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <ChevronDown className={`h-4 w-4 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{op?.numero_op_externo || op?.op_number || 'OP'}</span>
                          {cfg && <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>}
                          {hasLate && <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3" /> Atrasada</span>}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{op?.product_name} · Qtd: {op?.qty_planned}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="hidden sm:block text-right">
                        <p className="text-xs text-slate-400 mb-1">{done}/{total} etapas · {pct}%</p>
                        <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : hasLate ? 'bg-red-400' : 'bg-indigo-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <Link
                        to={createPageUrl(`ProductionOrderDetail?id=${opId}`)}
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5"
                      >
                        Ver OP <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {opSteps.length === 0 ? (
                        <p className="text-sm text-slate-400 px-6 py-4">Nenhuma etapa cadastrada</p>
                      ) : (
                        opSteps.map(step => {
                          const scfg = STEP_STATUS_CONFIG[step.computedStatus] || STEP_STATUS_CONFIG.PENDENTE;
                          const isLateStep = step.computedStatus === 'ATRASADA';
                          const daysLate = isLateStep && step.scheduled_end_date
                            ? today.diff(moment(step.scheduled_end_date), 'days')
                            : 0;

                          return (
                            <div key={step.id} className={`px-5 py-3 flex items-center justify-between gap-3 transition-colors hover:bg-slate-50/50 ${isLateStep ? 'bg-red-50/40' : ''}`}>
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {/* Status dot */}
                                <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: scfg.bar }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-slate-400 font-mono">#{step.sequence}</span>
                                    <span className="text-sm font-medium text-slate-800">{step.name}</span>
                                    {step.component_sku && (
                                      <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{step.component_sku}</span>
                                    )}
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${scfg.color}`}>{scfg.label}</span>
                                    {isLateStep && daysLate > 0 && (
                                      <span className="text-xs text-red-600 font-medium">{daysLate}d atraso</span>
                                    )}
                                  </div>
                                  {step.description && (
                                    <p className="text-xs text-slate-400 mt-0.5 truncate">{step.description}</p>
                                  )}
                                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                                    <button
                                      className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
                                      onClick={() => { setEditingStep(step); setEditStartDate(step.scheduled_start_date || ''); setEditEndDate(step.scheduled_end_date || ''); }}
                                    >
                                      <Calendar className="h-3 w-3" />
                                      {step.scheduled_start_date ? moment(step.scheduled_start_date).format('DD/MM') : '?'}
                                      {' → '}
                                      {step.scheduled_end_date ? moment(step.scheduled_end_date).format('DD/MM/YY') : '?'}
                                    </button>
                                    {step.started_at && <span className="text-blue-500">▶ {moment(step.started_at).format('DD/MM HH:mm')}</span>}
                                    {step.completed_at && <span className="text-emerald-500">✓ {moment(step.completed_at).format('DD/MM HH:mm')}</span>}
                                  </div>
                                </div>
                              </div>

                              {!['CANCELADA', 'CONCLUIDA', 'PULADA'].includes(step.computedStatus) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs flex-shrink-0">Ações</Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {['PENDENTE', 'ATRASADA'].includes(step.computedStatus) && (
                                      <DropdownMenuItem onClick={() => startStep(step.id)}>
                                        <Play className="h-4 w-4 mr-2 text-blue-600" /> Iniciar
                                      </DropdownMenuItem>
                                    )}
                                    {step.status === 'EM_ANDAMENTO' && (
                                      <>
                                        <DropdownMenuItem onClick={() => pauseStep(step.id)}>
                                          <Pause className="h-4 w-4 mr-2 text-amber-600" /> Pausar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => completeStep(step.id)}>
                                          <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" /> Finalizar
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    <DropdownMenuItem onClick={() => skipStep(step.id)} className="text-red-600">
                                      <X className="h-4 w-4 mr-2" /> Pular
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Edit dates dialog */}
      <Dialog open={!!editingStep} onOpenChange={open => !open && setEditingStep(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Datas da Etapa</DialogTitle>
            <DialogDescription>{editingStep?.name} — Seq. {editingStep?.sequence}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Data de Início</Label>
              <Input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Data de Término</Label>
              <Input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveDates} className="flex-1">Salvar</Button>
              <Button variant="outline" onClick={() => setEditingStep(null)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}