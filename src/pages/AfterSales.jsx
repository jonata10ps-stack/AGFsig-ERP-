import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Wrench, ClipboardList, Package, FileText, 
  BarChart3, Search, TrendingUp, AlertCircle, 
  CheckCircle2, Clock, MapPin, Settings,
  ArrowUpRight, ArrowDownRight, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import moment from 'moment';
import { motion } from 'framer-motion';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AfterSales() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');

  // Queries
  const { data: serviceRequests } = useQuery({
    queryKey: ['aftersales-requests', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ServiceRequest.filter({ company_id: companyId }, '-created_date');
    },
    enabled: !!companyId,
  });

  const { data: serviceOrders } = useQuery({
    queryKey: ['aftersales-orders', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ServiceOrder.filter({ company_id: companyId }, '-created_date');
    },
    enabled: !!companyId,
  });

  // Data Processing
  const chartData = useMemo(() => {
    if (!serviceRequests) return [];
    const days = {};
    for (let i = 14; i >= 0; i--) {
      const date = moment().subtract(i, 'days').format('DD/MM');
      days[date] = 0;
    }
    serviceRequests.forEach(req => {
      const date = moment(req.created_date).format('DD/MM');
      if (days[date] !== undefined) days[date]++;
    });
    return Object.entries(days).map(([name, total]) => ({ name, total }));
  }, [serviceRequests]);

  const pieData = useMemo(() => {
    if (!serviceRequests || serviceRequests.length === 0) return [{ name: 'Nenhum', value: 0 }];
    const types = {};
    serviceRequests.forEach(req => {
      const type = req.type || 'OUTROS';
      types[type] = (types[type] || 0) + 1;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [serviceRequests]);

  const metrics = useMemo(() => {
    const total = serviceRequests?.length || 0;
    const open = serviceRequests?.filter(r => r.status === 'ABERTA').length || 0;
    const active = serviceOrders?.filter(o => o.status === 'EM_ANDAMENTO').length || 0;
    const instRate = total > 0 ? Math.round((serviceRequests.filter(r => r.type === 'INSTALACAO').length / total) * 100) : 0;
    return { total, open, active, instRate };
  }, [serviceRequests, serviceOrders]);

  const modules = [
    { title: 'Solicitações', sub: 'Assistência Técnica', icon: ClipboardList, page: 'ServiceRequests', count: metrics.open, colorClass: 'bg-indigo-500' },
    { title: 'Ordens de Serviço', sub: 'Execução Técnica', icon: Wrench, page: 'ServiceOrders', count: metrics.active, colorClass: 'bg-blue-500' },
    { title: 'Controle de Séries', sub: 'Rastreabilidade', icon: Package, page: 'SerialNumberControl', colorClass: 'bg-purple-500' },
    { title: 'Relatórios', sub: 'Indicadores BI', icon: BarChart3, page: 'ServiceReports', colorClass: 'bg-emerald-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Pós-Vendas & Serviços</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            Visão geral da operação
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Geral', val: metrics.total, icon: ClipboardList, color: 'indigo' },
          { label: 'Em Aberto', val: metrics.open, icon: Clock, color: 'amber' },
          { label: 'OS Ativas', val: metrics.active, icon: Activity, color: 'blue' },
          { label: 'Taxa Instalação', val: `${metrics.instRate}%`, icon: CheckCircle2, color: 'emerald' },
        ].map((m, idx) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
            <Card className="border-none shadow-sm relative overflow-hidden">
              <div className="p-6">
                <div className={`p-2 w-fit rounded-lg bg-slate-100 text-slate-600 mb-4`}>
                  <m.icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-black text-slate-900">{m.val}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{m.label}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm h-[400px]">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Volume de Atendimentos</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fill="url(#colorP)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Distribuição</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {modules.map((m) => (
          <Link key={m.title} to={createPageUrl(m.page)}>
            <Card className="border-none shadow-sm hover:shadow-md transition-all group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-indigo-600 group-hover:text-white transition-all`}>
                    <m.icon className="h-6 w-6" />
                  </div>
                  {m.count > 0 && <Badge className="bg-indigo-100 text-indigo-700 border-none">{m.count}</Badge>}
                </div>
                <div className="mt-6">
                  <h3 className="font-bold text-slate-900">{m.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{m.sub}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}