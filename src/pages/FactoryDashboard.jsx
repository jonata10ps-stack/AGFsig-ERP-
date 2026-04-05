import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompanyId } from '@/components/useCompanyId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, CheckCircle2, Factory, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { format, isBefore, parseISO } from 'date-fns';

const STATUS_COLORS = {
  ABERTA: 'hsl(var(--primary))',
  EM_ANDAMENTO: '#2c5670',
  PAUSADA: '#f59e0b',
  ENCERRADA: '#10b981',
  CANCELADA: '#ef4444',
};

const STATUS_LABELS = {
  ABERTA: 'Aberta',
  EM_ANDAMENTO: 'Em Andamento',
  PAUSADA: 'Pausada',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
};

export default function FactoryDashboard() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  // Real-time subscriptions
  useEffect(() => {
    const u1 = base44.entities.ProductionOrder.subscribe(() => queryClient.invalidateQueries({ queryKey: ['factory-ops'] }));
    const u2 = base44.entities.ProductionStep.subscribe(() => queryClient.invalidateQueries({ queryKey: ['factory-steps'] }));
    return () => { u1(); u2(); };
  }, [queryClient]);

  const { data: ops = [], isFetching, refetch } = useQuery({
    queryKey: ['factory-ops', companyId],
    queryFn: () => base44.entities.ProductionOrder.filter({ company_id: companyId }, '-created_date', 2000),
    enabled: !!companyId,
  });

  const { data: steps = [] } = useQuery({
    queryKey: ['factory-steps', companyId],
    queryFn: () => base44.entities.ProductionStep.filter({ company_id: companyId }, null, 5000),
    enabled: !!companyId,
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['factory-resources', companyId],
    queryFn: () => base44.entities.Resource.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  // --- Calculations ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeOPs = ops.filter(op => ['ABERTA', 'EM_ANDAMENTO', 'PAUSADA'].includes(op.status));
  const lateOPs = activeOPs.filter(op => op.due_date && isBefore(parseISO(op.due_date), today));
  const inProgressOPs = activeOPs.filter(op => op.status === 'EM_ANDAMENTO');

  // OPs by status (all, for pie chart)
  const byStatus = Object.entries(
    ops.reduce((acc, op) => {
      acc[op.status] = (acc[op.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({ name: STATUS_LABELS[status] || status, value: count, status }));

  // Work center occupation: count EM_ANDAMENTO steps per resource
  const resourceMap = {};
  resources.forEach(r => { resourceMap[r.id] = r.name; });

  const stepsByResource = steps
    .filter(s => s.status === 'EM_ANDAMENTO' && s.resource_id)
    .reduce((acc, s) => {
      const name = resourceMap[s.resource_id] || s.resource_name || s.resource_id;
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

  const occupationData = Object.entries(stepsByResource)
    .map(([name, count]) => ({ name, etapas: count }))
    .sort((a, b) => b.etapas - a.etapas)
    .slice(0, 10);

  // Late OPs table sorted by due_date
  const lateOPsSorted = [...lateOPs]
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-white/20 shadow-sm mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-primary tracking-tight">Dashboard da Fábrica</h1>
          <p className="text-slate-500 mt-1 font-medium italic text-sm">Indicadores de desempenho em tempo real</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="rounded-xl border-primary/20 hover:bg-primary/5 transition-all">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card shadow-sm border-none overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Factory className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-slate-500">OPs Abertas</p>
                <p className="text-2xl font-bold text-primary">{activeOPs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card shadow-sm border-none overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Em Andamento</p>
                <p className="text-2xl font-bold text-primary">{inProgressOPs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">OPs Atrasadas</p>
                <p className="text-2xl font-bold text-red-600">{lateOPs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card shadow-sm border-none overflow-hidden hover:shadow-lg transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Encerradas</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {ops.filter(op => op.status === 'ENCERRADA').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* OPs by Status - Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">OPs por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {byStatus.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={byStatus}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {byStatus.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Work Center Occupation - Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ocupação dos Centros de Trabalho</CardTitle>
            <p className="text-xs text-slate-400">Etapas em andamento por recurso</p>
          </CardHeader>
          <CardContent>
            {occupationData.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Nenhuma etapa em andamento</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={occupationData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="etapas" name="Etapas" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Late OPs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            OPs Atrasadas ({lateOPs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lateOPsSorted.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Nenhuma OP atrasada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500 text-xs">
                    <th className="text-left py-2 pr-4">OP</th>
                    <th className="text-left py-2 pr-4">Produto</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-left py-2 pr-4">Prazo</th>
                    <th className="text-right py-2">Qtd Planejada</th>
                  </tr>
                </thead>
                <tbody>
                  {lateOPsSorted.map(op => {
                    const daysLate = Math.floor((today - new Date(op.due_date)) / 86400000);
                    return (
                      <tr key={op.id} className="border-b last:border-0 hover:bg-red-50">
                        <td className="py-2 pr-4 font-mono font-semibold text-slate-800">{op.numero_op_externo || op.op_number}</td>
                        <td className="py-2 pr-4 text-slate-700">{op.product_name}</td>
                        <td className="py-2 pr-4">
                          <Badge style={{ backgroundColor: `${STATUS_COLORS[op.status]}20`, color: STATUS_COLORS[op.status], border: `1px solid ${STATUS_COLORS[op.status]}40` }}>
                            {STATUS_LABELS[op.status]}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-red-600 font-medium flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {format(parseISO(op.due_date), 'dd/MM/yyyy')}
                          <span className="text-xs text-red-400 ml-1">({daysLate}d)</span>
                        </td>
                        <td className="py-2 text-right font-semibold text-slate-700">{op.qty_planned}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {lateOPs.length > 10 && (
                <p className="text-xs text-slate-400 mt-2">Exibindo 10 de {lateOPs.length} OPs atrasadas</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}