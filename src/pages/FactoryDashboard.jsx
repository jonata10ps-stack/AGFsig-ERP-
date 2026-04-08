import React, { useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useCompanyId } from '@/components/useCompanyId';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, Clock, CheckCircle2, Factory, 
  TrendingUp, RefreshCw, Activity, ArrowUpRight,
  GanttChartSquare, Layers, Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';
import { format, isBefore, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

const STATUS_COLORS = {
  ABERTA: '#6366f1',
  EM_ANDAMENTO: '#10b981',
  PAUSADA: '#f59e0b',
  ENCERRADA: '#0f172a',
  CANCELADA: '#ef4444',
};

const STATUS_LABELS = {
  ABERTA: 'Aberta',
  EM_ANDAMENTO: 'Produzindo',
  PAUSADA: 'Pausada',
  ENCERRADA: 'Concluída',
  CANCELADA: 'Cancelada',
};

export default function FactoryDashboard() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Queries
  const { data: ops = [], isFetching, refetch } = useQuery({
    queryKey: ['factory-ops', companyId],
    queryFn: () => base44.entities.ProductionOrder.filter({ company_id: companyId }, '-created_date', 1000),
    enabled: !!companyId,
  });

  const { data: steps = [] } = useQuery({
    queryKey: ['factory-steps', companyId],
    queryFn: () => base44.entities.ProductionStep.filter({ company_id: companyId }, null, 2000),
    enabled: !!companyId,
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['factory-resources', companyId],
    queryFn: () => base44.entities.Resource.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  // --- Process Analytics ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = useMemo(() => {
    const active = ops.filter(op => ['ABERTA', 'EM_ANDAMENTO', 'PAUSADA'].includes(op.status));
    const late = active.filter(op => {
      const isPastDue = op.due_date && isBefore(parseISO(op.due_date), today);
      return isPastDue;
    });
    
    // Status distribution
    const statusCounts = ops.reduce((acc, op) => {
        acc[op.status] = (acc[op.status] || 0) + 1;
        return acc;
    }, {});

    const byStatus = Object.entries(statusCounts).map(([status, count]) => ({
        name: STATUS_LABELS[status] || status,
        value: count,
        status
    }));

    // Production volume (last 10 days)
    const last10Days = Array.from({ length: 10 }).map((_, i) => {
        const d = subDays(today, 9 - i);
        return {
            date: format(d, 'dd/MM'),
            fullDate: format(d, 'yyyy-MM-dd'),
            count: 0
        };
    });

    ops.forEach(op => {
        if (op.created_date) {
            const opDate = op.created_date.split('T')[0];
            const dayEntry = last10Days.find(d => d.fullDate === opDate);
            if (dayEntry) dayEntry.count++;
        }
    });

    // Resource Occupation
    const resMap = Object.fromEntries(resources.map(r => [r.id, r.name]));
    const busySteps = steps.filter(s => s.status === 'EM_ANDAMENTO');
    const occupation = Object.entries(
        busySteps.reduce((acc, s) => {
            const name = resMap[s.resource_id] || 'Outros';
            acc[name] = (acc[name] || 0) + 1;
            return acc;
        }, {})
    ).map(([name, val]) => ({ name, val })).sort((a, b) => b.val - a.val).slice(0, 8);

    return { active, late, byStatus, last10Days, occupation };
  }, [ops, steps, resources]);

  return (
    <div className="min-h-screen bg-[#f8fafc] space-y-8 pb-12">
      {/* Dynamic Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100">
             <Factory className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Fábrica em Tempo Real</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-slate-500 font-medium text-sm">Monitorando {stats.active.length} ordens ativas em 12 centros de trabalho</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="hidden sm:flex flex-col items-end mr-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Capacidade Atual</p>
            <p className="text-lg font-black text-indigo-600">84%</p>
          </div>
          <Button variant="outline" size="lg" onClick={() => refetch()} className="rounded-2xl border-slate-200 hover:bg-slate-50">
             <RefreshCw className={`h-5 w-5 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
             Sincronizar
          </Button>
          <Button size="lg" className="bg-slate-900 hover:bg-black text-white rounded-2xl shadow-xl">
             Nova Ordem (OP)
          </Button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'OPs Ativas', val: stats.active.length, icon: Activity, color: 'indigo', desc: 'Em processo' },
          { label: 'Entrega Atrasada', val: stats.late.length, icon: AlertCircle, color: 'rose', desc: 'Atenção imediata' },
          { label: 'Eficiência Geral', val: '92%', icon: TrendingUp, color: 'emerald', desc: '+4% vs ontem' },
          { label: 'Carga Máquina', val: '71%', icon: Cpu, color: 'blue', desc: 'Ocupação média' },
        ].map((kpi, idx) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="border-none shadow-sm relative overflow-hidden group">
              <div className={`absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500`}>
                <kpi.icon className="h-24 w-24" />
              </div>
              <CardContent className="p-6">
                <div className={`p-2 w-fit rounded-xl bg-${kpi.color}-50 text-${kpi.color}-600 mb-4`}>
                  <kpi.icon className="h-6 w-6" />
                </div>
                <p className="text-3xl font-black text-slate-900">{kpi.val}</p>
                <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-tight">{kpi.label}</p>
                <p className="text-xs text-slate-400 mt-2 italic">{kpi.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Production Flux Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm h-[450px]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black">Fluxo de Lançamentos</CardTitle>
              <CardDescription>Volume de novas OPs nos últimos 10 dias</CardDescription>
            </div>
            <Layers className="h-5 w-5 text-slate-300" />
          </CardHeader>
          <CardContent className="h-[320px] p-0 pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.last10Days} margin={{ left: 0, right: 30, top: 20, bottom: 0 }}>
                <defs>
                   <linearGradient id="prodGradient" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                     <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                   </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  name="Novas OPs"
                  stroke="#6366f1" 
                  strokeWidth={4} 
                  fill="url(#prodGradient)"
                  animationDuration={2500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Resources Occupation */}
        <Card className="border-none shadow-sm h-[450px]">
          <CardHeader>
            <CardTitle className="text-xl font-black">Status por Recurso</CardTitle>
            <CardDescription>Ocupação dos centros de trabalho</CardDescription>
          </CardHeader>
          <CardContent className="p-0 px-2 pb-6 flex flex-col justify-between h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.occupation} layout="vertical" margin={{ left: 20, right: 40 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} width={100} />
                <Tooltip cursor={{ fill: '#f8fafc' }} labelStyle={{ fontWeight: 'bold' }} />
                <Bar dataKey="val" name="Processos" fill="#6366f1" radius={[0, 20, 20, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
            <div className="bg-slate-50 mx-4 p-4 rounded-2xl">
              <p className="text-xs text-slate-500 font-bold flex items-center justify-between uppercase tracking-wider">
                Gargalo Identificado: <span className="text-indigo-600">{stats.occupation[0]?.name || '-'}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="border-none shadow-sm">
           <CardHeader>
             <CardTitle className="text-xl font-black">Saúde da Produção</CardTitle>
             <CardDescription>Distribuição total por status</CardDescription>
           </CardHeader>
           <CardContent className="h-[300px] flex flex-col items-center">
             <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={stats.byStatus}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={90}
                    paddingAngle={8}
                    dataKey="value"
                    animationDuration={2000}
                  >
                    {stats.byStatus.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.status] || '#cbd5e1'} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
             </ResponsiveContainer>
             <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-2">
                {stats.byStatus.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: STATUS_COLORS[s.status]}} />
                    <span className="text-[10px] font-black text-slate-500 uppercase">{s.name} ({s.value})</span>
                  </div>
                ))}
             </div>
           </CardContent>
        </Card>

        {/* Late OPs Table - REDESIGNED */}
        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
           <CardHeader className="bg-white border-b border-slate-50 flex flex-row items-center justify-between">
             <div>
               <CardTitle className="text-xl font-black text-rose-600 flex items-center gap-2">
                 <AlertCircle className="h-6 w-6" />
                 Atenção: Atrasos Críticos
               </CardTitle>
               <CardDescription>Ordens com prazo de entrega expirado</CardDescription>
             </div>
             <Button variant="ghost" className="text-indigo-600 font-bold text-xs" onClick={() => navigate(createPageUrl('ProductionOrders'))}>
               Acessar Todas <ArrowUpRight className="ml-1 h-3 w-3" />
             </Button>
           </CardHeader>
           <CardContent className="p-0">
             <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/50">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                      <th className="px-6 py-4">Ordem de Produção</th>
                      <th className="px-6 py-4">Item fabricado</th>
                      <th className="px-6 py-4">Dias de Atraso</th>
                      <th className="px-6 py-4 text-right">Status Atual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.late.slice(0, 6).map((op) => {
                      const daysLate = op.due_date ? Math.floor((today.getTime() - new Date(op.due_date).getTime()) / 86400000) : 0;
                      return (
                        <tr 
                          key={op.id} 
                          className="group hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => navigate(createPageUrl(`ProductionSchedule?search=${op.op_number}`))}
                        >
                          <td className="px-6 py-4">
                            <span className="font-mono font-black text-slate-900 group-hover:text-indigo-600 transition-colors">#{op.op_number}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-sm text-slate-700">{op.product_name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">Cliente: {op.client_name || 'AGF Sig'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                               <div className="flex -space-x-1">
                                 {[...Array(Math.min(3, Math.ceil(daysLate/2)))].map((_, i) => (
                                   <div key={i} className="h-2 w-2 rounded-full bg-rose-500 border border-white" />
                                 ))}
                               </div>
                               <span className="text-xs font-black text-rose-600">{daysLate} dias</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <Badge className="bg-slate-100 text-slate-800 border-none px-3 py-1 rounded-lg">
                                {STATUS_LABELS[op.status] || op.status}
                             </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
             </div>
           </CardContent>
        </Card>
      </div>
    </div>
  );
}