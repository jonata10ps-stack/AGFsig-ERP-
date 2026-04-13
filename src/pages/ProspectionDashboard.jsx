import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { useAuth } from '@/lib/AuthContext';
import { TrendingUp, Calendar, Users, FileText, Target, Car, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

const statusColors = {
  PLANEJADA: '#4F46E5',
  REALIZADA: '#10B981',
  CANCELADA: '#6B7280',
};

const resultColors = {
  MUITO_POSITIVO: '#10B981',
  POSITIVO: '#22C55E',
  NEUTRO: '#6B7280',
  NEGATIVO: '#EF4444',
};

export default function ProspectionDashboard() {
  const { companyId } = useCompanyId();
  const { user } = useAuth();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth() + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));
  const [selectedSeller, setSelectedSeller] = useState('all');

  // Fetch all sellers for filter and roles
  const { data: allSellers = [] } = useQuery({
    queryKey: ['sellers', companyId],
    queryFn: () => companyId ? base44.entities.Seller.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const accessContext = useMemo(() => {
    if (!user || !allSellers) return { isAdmin: false, isManager: false, isSeller: false, managedSellerIds: [], currentSellerId: null };
    const isAdmin = user.role?.toLowerCase() === 'admin' || user.email?.toLowerCase() === 'jonata.santos@agfequipamentos.com.br';
    const sellerRecord = allSellers.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
    const isSeller = !!sellerRecord;
    const currentSellerId = sellerRecord?.id || null;
    const managedSellers = allSellers.filter(s => {
        const managers = Array.isArray(s.manager_ids) ? s.manager_ids : [];
        return managers.includes(user.id);
    });
    const isManager = managedSellers.length > 0;
    const managedSellerIds = managedSellers.map(s => s.id);
    return { isAdmin, isManager, isSeller, managedSellerIds, currentSellerId };
  }, [user, allSellers]);

  // Server-side filtering logic
  const dateFilter = useMemo(() => {
    if (selectedYear === 'all') return null;
    let start, end;
    if (selectedMonth === 'all') {
      start = `${selectedYear}-01-01`;
      end = `${selectedYear}-12-31`;
    } else {
      start = `${selectedYear}-${selectedMonth}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      end = `${selectedYear}-${selectedMonth}-${lastDay}`;
    }
    return { start, end };
  }, [selectedMonth, selectedYear]);

  // optimized useQuery hooks with server-side filtering
  const { data: visits, isLoading: loadingVisits } = useQuery({
    queryKey: ['prospection-visits-perf', companyId, dateFilter],
    queryFn: async () => {
      if (!companyId) return [];
      let q = supabase.from('ProspectionVisit').select('*').eq('company_id', companyId);
      if (dateFilter) {
        q = q.gte('visit_date', dateFilter.start).lte('visit_date', dateFilter.end);
      }
      const { data } = await q.order('visit_date', { ascending: false });
      return data || [];
    },
    enabled: !!companyId
  });

  const { data: quotes, isLoading: loadingQuotes } = useQuery({
    queryKey: ['quotes-perf', companyId, dateFilter],
    queryFn: async () => {
      if (!companyId) return [];
      let q = supabase.from('Quote').select('*').eq('company_id', companyId);
      if (dateFilter) {
        // created_date is ISO, so we can use string comparison for prefix or between
        q = q.gte('created_date', `${dateFilter.start}T00:00:00`).lte('created_date', `${dateFilter.end}T23:59:59`);
      }
      const { data } = await q.order('created_date', { ascending: false });
      return data || [];
    },
    enabled: !!companyId
  });

  const { data: salesOrders } = useQuery({
    queryKey: ['sales-orders-perf', companyId, dateFilter],
    queryFn: async () => {
      if (!companyId) return [];
      let q = supabase.from('SalesOrder').select('*').eq('company_id', companyId);
      if (dateFilter) {
        q = q.gte('created_date', `${dateFilter.start}T00:00:00`).lte('created_date', `${dateFilter.end}T23:59:59`);
      }
      const { data } = await q.order('created_date', { ascending: false });
      return data || [];
    },
    enabled: !!companyId
  });

  const { data: dailyLogs } = useQuery({
    queryKey: ['daily-logs-perf', companyId, dateFilter],
    queryFn: async () => {
      if (!companyId) return [];
      let q = supabase.from('DailyVehicleLog').select('*').eq('company_id', companyId);
      if (dateFilter) {
        q = q.gte('log_date', dateFilter.start).lte('log_date', dateFilter.end);
      }
      const { data } = await q.order('log_date', { ascending: false });
      return data || [];
    },
    enabled: !!companyId
  });

  const filterByAccess = (item) => {
    if (accessContext.isAdmin) return true;
    const itemSellerId = item.seller_id;
    if (accessContext.isManager && accessContext.managedSellerIds.includes(itemSellerId)) return true;
    if (accessContext.isSeller && itemSellerId === accessContext.currentSellerId) return true;
    if (item.created_by?.toLowerCase() === user?.email?.toLowerCase()) return true;
    return false;
  };

  const dashboardData = useMemo(() => {
    if (!visits || !quotes || !salesOrders || !dailyLogs) return null;
    
    // Filter by seller selection and access
    const v = visits.filter(i => (selectedSeller === 'all' || i.seller_id === selectedSeller) && filterByAccess(i));
    const q = quotes.filter(i => (selectedSeller === 'all' || i.seller_id === selectedSeller) && filterByAccess(i));
    const so = salesOrders.filter(i => (selectedSeller === 'all' || i.seller_id === selectedSeller) && filterByAccess(i));
    const logs = dailyLogs.filter(i => (selectedSeller === 'all' || i.seller_id === selectedSeller) && filterByAccess(i));

    // Calculate Stats
    const totalQuoteValue = q.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    const convertedQuotes = q.filter(item => item.status === 'CONVERTIDO').length;
    const conversionRate = q.length > 0 ? (convertedQuotes / q.length) * 100 : 0;
    const avgTicket = q.length > 0 ? totalQuoteValue / q.length : 0;

    // Charts Data
    const statusChart = v.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {});

    const statusData = Object.entries(statusChart).map(([name, value]) => ({ name, value }));

    const sellerChart = v.reduce((acc, curr) => {
      const name = curr.seller_name || 'Desconhecido';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    const sellerData = Object.entries(sellerChart).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);

    return {
      kpis: {
        totalQuotes: q.length,
        totalValue: totalQuoteValue,
        conversionRate,
        avgTicket,
        totalVisits: v.length,
        proposals: v.filter(i => i.proposal_sent).length
      },
      charts: {
        statusData,
        sellerData,
        quotesByStatus: Object.entries(q.reduce((acc, curr) => {
          acc[curr.status] = (acc[curr.status] || 0) + 1;
          return acc;
        }, {})).map(([name, value]) => ({ name, value }))
      },
      raw: { visits: v, quotes: q, salesOrders: so, dailyLogs: logs }
    };
  }, [visits, quotes, salesOrders, dailyLogs, selectedSeller, accessContext]);

  if (loadingVisits || loadingQuotes) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
        <h2 className="text-xl font-bold text-slate-600 animate-pulse">Sintonizando dados em tempo real...</h2>
      </div>
    );
  }

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Dashboard de Prospecção</h1>
          <p className="text-slate-500 font-medium">Otimizado para alta performance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40 rounded-xl bg-slate-50 border-none font-bold">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ano Inteiro</SelectItem>
              {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                <SelectItem key={m} value={String(i + 1).padStart(2, '0')}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-28 rounded-xl bg-slate-50 border-none font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedSeller} onValueChange={setSelectedSeller}>
            <SelectTrigger className="w-48 rounded-xl bg-slate-50 border-none font-bold">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Vendedores</SelectItem>
              {allSellers.filter(s => accessContext.isAdmin || accessContext.managedSellerIds.includes(s.id) || s.id === accessContext.currentSellerId).map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI Card title="Orçamentos" value={dashboardData?.kpis.totalQuotes} icon={<FileText className="h-8 w-8 text-indigo-500"/>} />
        <KPI Card title="Valor Total" value={formatCurrency(dashboardData?.kpis.totalValue)} icon={<TrendingUp className="h-8 w-8 text-emerald-500"/>} color="text-emerald-600" />
        <KPI Card title="Conversão" value={`${dashboardData?.kpis.conversionRate.toFixed(1)}%`} icon={<Target className="h-8 w-8 text-amber-500"/>} color="text-amber-600" />
        <KPI Card title="Visitas" value={dashboardData?.kpis.totalVisits} icon={<Calendar className="h-8 w-8 text-blue-500"/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-50 py-6 px-8">
            <CardTitle className="text-xl font-black text-slate-800">Orçamentos por Status</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dashboardData?.charts.quotesByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {dashboardData?.charts.quotesByStatus.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-50 py-6 px-8">
            <CardTitle className="text-xl font-black text-slate-800">Visitas por Vendedor</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData?.charts.sellerData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 12, fontWeight: 'bold'}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="value" fill="#4F46E5" radius={[0, 10, 10, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPI({ title, value, icon, color = "text-slate-900" }) {
  return (
    <Card className="rounded-3xl border-none shadow-xl bg-white overflow-hidden transform transition-all hover:scale-[1.02]">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}