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
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AfterSales() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');

  // Queries
  const { data: serviceRequests } = useQuery({
    queryKey: ['service-requests', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ServiceRequest.filter({ company_id: companyId }, '-created_date');
    },
    enabled: !!companyId,
  });

  const { data: serviceOrders } = useQuery({
    queryKey: ['service-orders', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ServiceOrder.filter({ company_id: companyId }, '-created_date');
    },
    enabled: !!companyId,
  });

  // Data Processing for Charts
  const chartData = useMemo(() => {
    if (!serviceRequests) return [];
    const days = {};
    // Last 15 days
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
    if (!serviceRequests) return [];
    const types = {};
    serviceRequests.forEach(req => {
      const type = req.type || 'OUTROS';
      types[type] = (types[type] || 0) + 1;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [serviceRequests]);

  // Key Metrics
  const metrics = {
    totalRequests: serviceRequests?.length || 0,
    openRequests: serviceRequests?.filter(r => r.status === 'ABERTA').length || 0,
    completedRequests: serviceRequests?.filter(r => r.status === 'CONCLUIDA' || r.status === 'ENCERRADA').length || 0,
    activeOrders: serviceOrders?.filter(o => o.status === 'EM_ANDAMENTO').length || 0,
    installationRate: serviceRequests ? Math.round((serviceRequests.filter(r => r.type === 'INSTALACAO').length / serviceRequests.length) * 100) : 0
  };

  const dashboardModules = [
    { title: 'Solicitações', sub: 'Assistência Técnica', icon: ClipboardList, page: 'ServiceRequests', count: metrics.openRequests, color: 'indigo' },
    { title: 'Ordens de Serviço', sub: 'Execução Técnica', icon: Wrench, page: 'ServiceOrders', count: metrics.activeOrders, color: 'blue' },
    { title: 'Controle de Séries', sub: 'Rastreabilidade', icon: Package, page: 'SerialNumberControl', color: 'purple' },
    { title: 'Relatórios', sub: 'Indicadores BI', icon: BarChart3, page: 'ServiceReports', color: 'emerald' },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Pós-Vendas & Serviços</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            Visão geral da operação de assistência e instalações
          </p>
        </motion.div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar chamado ou OS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            />
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 rounded-xl">
             Novo Chamado
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total de Solicitações', value: metrics.totalRequests, icon: ClipboardList, color: 'indigo', trend: '+12%', up: true },
          { label: 'Em Aberto', value: metrics.openRequests, icon: Clock, color: 'amber', trend: '-5%', up: false },
          { label: 'OS em Andamento', value: metrics.activeOrders, icon: Activity, color: 'blue', trend: '+8%', up: true },
          { label: 'Taxa de Instalação', value: `${metrics.installationRate}%`, icon: CheckCircle2, color: 'emerald', trend: '+2%', up: true },
        ].map((m, idx) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="relative overflow-hidden border-none shadow-sm hover:shadow-md transition-all group">
              <div className={`absolute top-0 left-0 w-1 h-full bg-${m.color}-500`} />
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className={`p-2 rounded-lg bg-${m.color}-50 text-${m.color}-600`}>
                    <m.icon className="h-5 w-5" />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-bold ${m.up ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {m.trend}
                    {m.up ? <TrendingUp className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-black text-slate-900">{m.value}</p>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">{m.label}</p>
                </div>
                <div className={`absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500`}>
                  <m.icon className="h-24 w-24" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm h-[400px]">
          <CardHeader className="flex flex-row items-center justify-between pb-8">
            <div>
              <CardTitle className="text-lg font-bold">Volumes de Atendimento</CardTitle>
              <CardDescription>Fluxo de solicitações nos últimos 15 dias</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-indigo-50 border-indigo-100 text-indigo-600 uppercase text-[10px]">Pós-Vendas</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Categories Pie Chart */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Tipos de Serviço</CardTitle>
            <CardDescription>Distribuição por categoria</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase truncate">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module Shortcuts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardModules.map((m, idx) => (
          <motion.div key={m.title} whileHover={{ y: -5 }}>
            <Link to={createPageUrl(m.page)}>
              <Card className="border-none shadow-sm hover:shadow-indigo-100 hover:shadow-lg transition-all cursor-pointer bg-white group h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-2xl bg-${m.color}-50 text-${m.color}-600 group-hover:bg-${m.color}-500 group-hover:text-white transition-all duration-300`}>
                      <m.icon className="h-6 w-6" />
                    </div>
                    {m.count !== undefined && (
                      <Badge className={`bg-${m.color}-100 text-${m.color}-700 border-none`}>
                        {m.count} Pendentes
                      </Badge>
                    )}
                  </div>
                  <div className="mt-8">
                    <h3 className="font-bold text-slate-900 text-lg">{m.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">{m.sub}</p>
                    <div className="flex items-center gap-1 text-indigo-500 text-xs font-bold mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      Acessar agora <ArrowUpRight className="h-3 w-3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Latest Activity Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Service Requests */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Solicitações Recentes</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="text-indigo-600 text-xs hover:bg-slate-50" asChild>
              <Link to={createPageUrl('ServiceRequests')}>Ver Tudo</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50">
              {serviceRequests?.slice(0, 5).map((req) => (
                <div key={req.id} className="p-4 hover:bg-slate-50/50 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      {req.client_name?.substring(0, 2) || 'CL'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm leading-none mb-1">{req.client_name}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[200px]">{req.description || 'Sem descrição detalhada'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={req.status === 'ABERTA' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}>
                      {req.status}
                    </Badge>
                    <p className="text-[10px] text-slate-400 font-medium">{moment(req.created_date).fromNow()}</p>
                  </div>
                </div>
              ))}
              {(!serviceRequests || serviceRequests.length === 0) && (
                <div className="p-8 text-center text-slate-400 text-sm italic">Nenhuma solicitação encontrada</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Service Orders */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">OS em Andamento</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="text-indigo-600 text-xs hover:bg-slate-50" asChild>
               <Link to={createPageUrl('ServiceOrders')}>Ver Tudo</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50">
              {serviceOrders?.filter(o => o.status === 'EM_ANDAMENTO').slice(0, 5).map((os) => (
                <div key={os.id} className="p-4 hover:bg-slate-50/50 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm leading-none mb-1">OS-{os.os_number}</p>
                      <p className="text-xs text-slate-400">{os.client_name}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="border-orange-200 text-orange-600 text-[10px]">
                      {os.type}
                    </Badge>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <MapPin className="h-3 w-3" /> São Paulo, SP
                    </div>
                  </div>
                </div>
              ))}
              {(!serviceOrders || serviceOrders.filter(o => o.status === 'EM_ANDAMENTO').length === 0) && (
                <div className="p-8 text-center text-slate-400 text-sm italic">Nenhuma ordem em andamento no momento</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
rd>
      </div>
    </div>
  );
}