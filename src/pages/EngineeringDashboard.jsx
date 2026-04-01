import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar
} from 'recharts';
import {
  Cpu, Zap, Layers, Clock, CheckCircle2, AlertTriangle, PlayCircle,
  Eye, Plus, Package, History, TrendingUp, Users, BarChart2, MessageSquare
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  PLANEJAMENTO:  { label: 'Planejamento',   color: 'bg-slate-100 text-slate-700',    hex: '#94a3b8' },
  EM_ANDAMENTO:  { label: 'Em Andamento',   color: 'bg-blue-100 text-blue-700',      hex: '#3b82f6' },
  REVISAO:       { label: 'Em Revisão',     color: 'bg-amber-100 text-amber-700',    hex: '#f59e0b' },
  APROVADO:      { label: 'Aprovado',       color: 'bg-emerald-100 text-emerald-700',hex: '#10b981' },
  CONCLUIDO:     { label: 'Concluído',      color: 'bg-purple-100 text-purple-700',  hex: '#8b5cf6' },
  CANCELADO:     { label: 'Cancelado',      color: 'bg-red-100 text-red-700',        hex: '#ef4444' },
};

const TYPE_CONFIG = {
  MECANICO:          { label: 'Mecânico',         icon: Cpu,    color: 'text-blue-600',   hex: '#3b82f6' },
  ELETRICO:          { label: 'Elétrico',         icon: Zap,    color: 'text-amber-600',  hex: '#f59e0b' },
  MECANICO_ELETRICO: { label: 'Mec. + Elétrico', icon: Layers, color: 'text-purple-600', hex: '#8b5cf6' },
};

const UPDATE_TYPE_COLORS = {
  PROGRESSO:  'bg-blue-100 text-blue-700',
  REVISAO:    'bg-amber-100 text-amber-700',
  PROBLEMA:   'bg-red-100 text-red-700',
  APROVACAO:  'bg-emerald-100 text-emerald-700',
  COMENTARIO: 'bg-slate-100 text-slate-700',
};

const UPDATE_TYPE_LABELS = {
  PROGRESSO: 'Progresso', REVISAO: 'Revisão', PROBLEMA: 'Problema',
  APROVACAO: 'Aprovação', COMENTARIO: 'Comentário',
};

function KpiCard({ label, value, sub, icon: Icon, bgClass = 'bg-white', textClass = 'text-slate-900', subClass = 'text-slate-500' }) {
  return (
    <Card className={bgClass}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-sm font-medium ${subClass}`}>{label}</p>
            <p className={`text-3xl font-bold mt-1 ${textClass}`}>{value}</p>
            {sub && <p className={`text-xs mt-1 ${subClass}`}>{sub}</p>}
          </div>
          {Icon && <Icon className={`h-8 w-8 opacity-40 ${textClass}`} />}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EngineeringDashboard() {
  const { companyId } = useCompanyId();

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['engineering-projects', companyId],
    queryFn: () => base44.entities.EngineeringProject.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['eng-all-items', companyId],
    queryFn: () => base44.entities.EngineeringProjectItem.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: allUpdates = [], isLoading: loadingUpdates } = useQuery({
    queryKey: ['eng-all-updates', companyId],
    queryFn: () => base44.entities.EngineeringProjectUpdate.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const isLoading = loadingProjects || loadingItems || loadingUpdates;

  // ── Project metrics ──────────────────────────────────────
  const metrics = useMemo(() => {
    const active = projects.filter(p => p.status !== 'CANCELADO');
    const inProgress = projects.filter(p => p.status === 'EM_ANDAMENTO').length;
    const completed = projects.filter(p => p.status === 'CONCLUIDO').length;
    const delayed = projects.filter(p => {
      if (!p.estimated_end_date || p.status === 'CONCLUIDO' || p.status === 'CANCELADO') return false;
      return differenceInDays(new Date(), new Date(p.estimated_end_date)) > 0;
    }).length;

    const totalEstimated = active.reduce((s, p) => s + (p.estimated_hours || 0), 0);
    const totalActual = active.reduce((s, p) => s + (p.actual_hours || 0), 0);
    const avgProgress = active.length
      ? Math.round(active.reduce((s, p) => s + (p.progress_percent || 0), 0) / active.length)
      : 0;

    return { total: projects.length, inProgress, completed, delayed, totalEstimated, totalActual, avgProgress };
  }, [projects]);

  // ── Component metrics ─────────────────────────────────────
  const componentMetrics = useMemo(() => {
    const active = items.filter(i => !i.obsolete).length;
    const obsolete = items.filter(i => i.obsolete).length;
    const withDrawings = items.filter(i => i.drawings?.length > 0).length;
    const withoutDrawings = items.filter(i => !i.obsolete && (!i.drawings || i.drawings.length === 0)).length;
    return { total: items.length, active, obsolete, withDrawings, withoutDrawings };
  }, [items]);

  // ── Charts data ───────────────────────────────────────────
  const statusPieData = useMemo(() =>
    Object.entries(STATUS_CONFIG)
      .map(([key, cfg]) => ({ name: cfg.label, value: projects.filter(p => p.status === key).length, color: cfg.hex }))
      .filter(d => d.value > 0),
  [projects]);

  const typeBarData = useMemo(() =>
    Object.entries(TYPE_CONFIG).map(([key, cfg]) => ({
      name: cfg.label,
      value: projects.filter(p => p.type === key).length,
      fill: cfg.hex,
    })),
  [projects]);

  const hoursBarData = useMemo(() =>
    projects
      .filter(p => p.estimated_hours || p.actual_hours)
      .slice(0, 8)
      .map(p => ({
        name: p.code || p.name.slice(0, 12),
        Estimado: p.estimated_hours || 0,
        Realizado: p.actual_hours || 0,
      })),
  [projects]);

  const componentPieData = [
    { name: 'Ativos', value: componentMetrics.active, color: '#10b981' },
    { name: 'Obsoletos', value: componentMetrics.obsolete, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // ── Latest updates feed ───────────────────────────────────
  const projectMap = useMemo(() => {
    const m = {};
    projects.forEach(p => { m[p.id] = p; });
    return m;
  }, [projects]);

  const recentUpdates = useMemo(() =>
    [...allUpdates]
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, 10),
  [allUpdates]);

  // ── Delayed projects ──────────────────────────────────────
  const delayedProjects = useMemo(() =>
    projects
      .filter(p => {
        if (!p.estimated_end_date || p.status === 'CONCLUIDO' || p.status === 'CANCELADO') return false;
        return differenceInDays(new Date(), new Date(p.estimated_end_date)) > 0;
      })
      .sort((a, b) => new Date(a.estimated_end_date) - new Date(b.estimated_end_date)),
  [projects]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-sm">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard de Engenharia</h1>
          <p className="text-slate-500 mt-1">Visão consolidada dos projetos e componentes</p>
        </div>
        <Link to={createPageUrl('EngineeringProjects')}>
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />Novo Projeto
          </Button>
        </Link>
      </div>

      {/* KPI Row 1 — Projects */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total de Projetos" value={metrics.total} icon={Layers} sub="todos os status" />
        <KpiCard label="Em Andamento" value={metrics.inProgress} icon={PlayCircle}
          bgClass="bg-blue-50" textClass="text-blue-700" subClass="text-blue-500"
          sub={`${metrics.total ? Math.round(metrics.inProgress / metrics.total * 100) : 0}% do total`} />
        <KpiCard label="Atrasados" value={metrics.delayed} icon={AlertTriangle}
          bgClass="bg-red-50" textClass="text-red-700" subClass="text-red-500"
          sub="prazo excedido" />
        <KpiCard label="Concluídos" value={metrics.completed} icon={CheckCircle2}
          bgClass="bg-purple-50" textClass="text-purple-700" subClass="text-purple-500"
          sub={`${metrics.total ? Math.round(metrics.completed / metrics.total * 100) : 0}% do total`} />
      </div>

      {/* KPI Row 2 — Hours & Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Progresso Médio" value={`${metrics.avgProgress}%`} icon={TrendingUp}
          bgClass="bg-indigo-50" textClass="text-indigo-700" subClass="text-indigo-500"
          sub="média dos projetos ativos" />
        <KpiCard label="Horas Realizadas" value={`${metrics.totalActual}h`} icon={Clock}
          sub={`de ${metrics.totalEstimated}h estimadas`} />
        <KpiCard label="Componentes" value={componentMetrics.total} icon={Package}
          sub={`${componentMetrics.active} ativos · ${componentMetrics.obsolete} obsoletos`} />
      </div>

      {/* Progress bar — global hours */}
      {metrics.totalEstimated > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-500" />
                Horas Totais: Realizado vs. Estimado
              </span>
              <span className="text-sm font-bold text-indigo-700">
                {metrics.totalActual}h / {metrics.totalEstimated}h
                ({Math.min(100, Math.round(metrics.totalActual / metrics.totalEstimated * 100))}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
              <div
                className={`h-4 rounded-full transition-all ${metrics.totalActual > metrics.totalEstimated ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 to-indigo-600'}`}
                style={{ width: `${Math.min(100, Math.round(metrics.totalActual / metrics.totalEstimated * 100))}%` }}
              />
            </div>
            {metrics.totalActual > metrics.totalEstimated && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Horas realizadas excedem o estimado em {metrics.totalActual - metrics.totalEstimated}h
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Pie */}
        <Card>
          <CardHeader><CardTitle className="text-base">Por Status</CardTitle></CardHeader>
          <CardContent>
            {statusPieData.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">Sem dados</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                      {statusPieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1 mt-2">
                  {statusPieData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: d.color }} />
                        {d.name}
                      </span>
                      <span className="font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Components Active vs Obsolete */}
        <Card>
          <CardHeader><CardTitle className="text-base">Componentes</CardTitle></CardHeader>
          <CardContent>
            {componentPieData.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">Sem componentes</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={componentPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                      {componentPieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />Ativos</span>
                    <span className="font-medium">{componentMetrics.active}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />Obsoletos</span>
                    <span className="font-medium">{componentMetrics.obsolete}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-400 inline-block" />Com desenho</span>
                    <span className="font-medium">{componentMetrics.withDrawings}</span>
                  </div>
                  {componentMetrics.withoutDrawings > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      {componentMetrics.withoutDrawings} ativo(s) sem desenho
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Por tipo */}
        <Card>
          <CardHeader><CardTitle className="text-base">Por Tipo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={typeBarData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Projetos" radius={[4, 4, 0, 0]}>
                  {typeBarData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Hours per Project */}
      {hoursBarData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-indigo-500" />Horas por Projeto (Estimado vs. Realizado)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hoursBarData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="Estimado" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Realizado" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-200 inline-block" />Estimado</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-600 inline-block" />Realizado</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom Row: Delayed + Recent Updates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Delayed Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Projetos Atrasados
            </CardTitle>
            <Link to={createPageUrl('EngineeringProjects')}>
              <Button variant="outline" size="sm" className="h-7 text-xs">Ver todos</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {delayedProjects.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
                <p className="text-sm">Nenhum projeto atrasado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {delayedProjects.slice(0, 5).map(p => {
                  const days = differenceInDays(new Date(), new Date(p.estimated_end_date));
                  const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.PLANEJAMENTO;
                  return (
                    <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-red-100 bg-red-50/50">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
                          <span className="text-xs text-red-600 font-medium">{days}d de atraso</span>
                        </div>
                      </div>
                      <Link to={createPageUrl(`EngineeringProjectDetail?id=${p.id}`)}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 ml-2">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Updates Feed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              Últimas Atualizações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentUpdates.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">Nenhuma atualização registrada</p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {recentUpdates.map(u => {
                  const proj = projectMap[u.project_id];
                  return (
                    <div key={u.id} className="border-l-3 border-indigo-200 pl-3 py-1 border-l-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className={`text-xs px-1.5 py-0 ${UPDATE_TYPE_COLORS[u.type] || 'bg-slate-100 text-slate-700'}`}>
                              {UPDATE_TYPE_LABELS[u.type] || u.type}
                            </Badge>
                            <span className="text-sm font-medium text-slate-800 truncate">{u.title}</span>
                          </div>
                          {proj && (
                            <Link
                              to={createPageUrl(`EngineeringProjectDetail?id=${proj.id}`)}
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              {proj.name}
                            </Link>
                          )}
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                            <span>{u.author_name || u.author_email || '—'}</span>
                            <span>·</span>
                            <span>{format(new Date(u.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            {u.hours_logged > 0 && (
                              <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{u.hours_logged}h</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}