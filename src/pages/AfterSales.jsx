import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Wrench, ClipboardList, Package, BarChart3, 
  Search, TrendingUp, AlertCircle, CheckCircle2, 
  Clock, Activity, DollarSign, Users, Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import moment from 'moment';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function AfterSales() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');

  // Queries - Fetching data for deeper analysis
  const { data: serviceRequests } = useQuery({
    queryKey: ['as-requests', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ServiceRequest.filter({ company_id: companyId }, '-created_date');
    },
    enabled: !!companyId,
  });

  const { data: serviceOrders } = useQuery({
    queryKey: ['as-orders', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ServiceOrder.filter({ company_id: companyId }, '-created_date');
    },
    enabled: !!companyId,
  });

  // Managerial Processing
  const stats = useMemo(() => {
    if (!serviceOrders || !serviceRequests) return { labor: 0, parts: 0, avgHours: 0 };
    
    let labor = 0;
    let parts = 0;
    let totalHours = 0;
    let ordersWithHours = 0;

    serviceOrders.forEach(o => {
      labor += parseFloat(o.labor_cost || 0);
      parts += parseFloat(o.parts_cost || 0);
      const hours = parseFloat(o.labor_hours || 0);
      if (hours > 0) {
        totalHours += hours;
        ordersWithHours++;
      }
    });

    return {
      labor,
      parts,
      totalCost: labor + parts,
      avgHours: ordersWithHours > 0 ? (totalHours / ordersWithHours).toFixed(1) : 0
    };
  }, [serviceOrders, serviceRequests]);

  const technicianData = useMemo(() => {
    if (!serviceOrders) return [];
    const techMap = {};
    serviceOrders.forEach(o => {
      const name = o.technician_name || 'Não Atribuído';
      techMap[name] = (techMap[name] || 0) + 1;
    });
    return Object.entries(techMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [serviceOrders]);

  const typeDistribution = useMemo(() => {
    if (!serviceRequests) return [];
    const types = {};
    serviceRequests.forEach(r => {
      const t = r.type || 'Outros';
      types[t] = (types[t] || 0) + 1;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [serviceRequests]);

  const trendData = useMemo(() => {
    const last7Days = {};
    for (let i = 6; i >= 0; i--) {
      const d = moment().subtract(i, 'days').format('DD/MM');
      last7Days[d] = 0;
    }
    serviceRequests?.forEach(r => {
      const d = moment(r.created_date).format('DD/MM');
      if (last7Days[d] !== undefined) last7Days[d]++;
    });
    return Object.entries(last7Days).map(([name, total]) => ({ name, total }));
  }, [serviceRequests]);

  return (
    <div className="p-6 space-y-8 bg-slate-50 min-h-screen">
      {/* Header Gerencial */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-indigo-700 p-8 rounded-3xl shadow-xl shadow-indigo-100 text-white">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Gestão de Pós-Vendas</h1>
          <p className="opacity-80 font-medium">Análise tática e operacional da equipe técnica</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Custo Total (Mês)</p>
            <p className="text-xl font-black">R$ {stats.totalCost?.toLocaleString('pt-BR')}</p>
          </div>
          <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Média de Horas/OS</p>
            <p className="text-xl font-black">{stats.avgHours}h</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Solicitações Totais', value: serviceRequests?.length || 0, icon: ClipboardList, color: 'text-indigo-600', bg: 'bg-indigo-100' },
          { label: 'Ordens em Aberto', value: serviceOrders?.filter(o => o.status !== 'Finalizada').length || 0, icon: Timer, color: 'text-amber-600', bg: 'bg-amber-100' },
          { label: 'Custo de Peças', value: `R$ ${stats.parts?.toLocaleString()}`, icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-100' },
          { label: 'Garantias Ativas', value: serviceRequests?.filter(r => r.type === 'GARANTIA').length || 0, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-100' },
        ].map((kpi, i) => (
          <Card key={i} className="border-none shadow-md hover:scale-105 transition-transform duration-300">
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`p-4 rounded-2xl ${kpi.bg} ${kpi.color}`}>
                <kpi.icon className="h-6 w-6 font-bold" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{kpi.value}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart */}
        <Card className="lg:col-span-2 border-none shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-700">Tendência de Chamados (7 Dias)</CardTitle>
            <TrendingUp className="h-5 w-5 text-indigo-500" />
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} />
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Area type="monotone" dataKey="total" stroke="#4F46E5" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Technician Bar Chart */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-700">Carga por Técnico (Top 5)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={technicianData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{fill: '#64748B', fontSize: 11, fontWeight: 'bold'}} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={20}>
                  {technicianData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Distribution and Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Pie Chart Distribution */}
        <Card className="lg:col-span-1 border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-700">Mix de Pedidos</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeDistribution}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {typeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick Actions Grid */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: 'Solicitações', desc: 'Gerenciar chamados', icon: ClipboardList, page: 'ServiceRequests', color: 'bg-indigo-600' },
            { title: 'Ordens de Serviço', desc: 'Execução técnica', icon: Wrench, page: 'ServiceOrders', color: 'bg-blue-600' },
            { title: 'Relatórios', desc: 'BI e Exportação', icon: BarChart3, page: 'ServiceReports', color: 'bg-emerald-600' },
          ].map((action, i) => (
            <Link key={i} to={createPageUrl(action.page)} className="group">
              <Card className="h-full border-none shadow-md group-hover:shadow-xl transition-all border-l-4 border-l-transparent group-hover:border-l-indigo-500">
                <CardContent className="p-8 flex flex-col items-center text-center">
                  <div className={`p-4 rounded-3xl ${action.color} text-white shadow-lg shadow-indigo-100 mb-4 group-hover:scale-110 transition-transform`}>
                    <action.icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">{action.title}</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tighter">{action.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}