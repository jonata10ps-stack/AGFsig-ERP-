import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { useAuth } from '@/lib/AuthContext';
import { TrendingUp, Calendar, Users, FileText, Target, Car } from 'lucide-react';
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
  PLANEJADA: 'hsl(var(--primary))',
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

  // Fetch all sellers (fast)
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

  useMemo(() => {
    if (selectedSeller === 'all' && !accessContext.isAdmin && !accessContext.isManager && accessContext.isSeller) {
        setSelectedSeller(accessContext.currentSellerId);
    }
  }, [accessContext, selectedSeller]);

  // Optimized Fetching with Server-Side filtering for better performance
  const { data: visits, isLoading } = useQuery({
    queryKey: ['prospection-visits-dashboard', companyId, selectedYear],
    queryFn: async () => {
      if (!companyId) return [];
      let q = supabase.from('ProspectionVisit').select('*').eq('company_id', companyId);
      if (selectedYear !== 'all') {
        q = q.gte('visit_date', `${selectedYear}-01-01`).lte('visit_date', `${selectedYear}-12-31`);
      }
      const { data } = await q.order('visit_date', { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: dailyLogs } = useQuery({
    queryKey: ['daily-vehicle-logs-report', companyId, selectedYear],
    queryFn: async () => {
      if (!companyId) return [];
      let q = supabase.from('DailyVehicleLog').select('*').eq('company_id', companyId);
      if (selectedYear !== 'all') {
        q = q.gte('log_date', `${selectedYear}-01-01`).lte('log_date', `${selectedYear}-12-31`);
      }
      const { data } = await q.order('log_date', { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: quotes } = useQuery({
    queryKey: ['quotes-dashboard', companyId, selectedYear],
    queryFn: async () => {
      if (!companyId) return [];
      let q = supabase.from('Quote').select('*').eq('company_id', companyId);
      if (selectedYear !== 'all') {
        q = q.gte('created_date', `${selectedYear}-01-01T00:00:00`).lte('created_date', `${selectedYear}-12-31T23:59:59`);
      }
      const { data } = await q.order('created_date', { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: salesOrders } = useQuery({
    queryKey: ['sales-orders-dashboard', companyId, selectedYear],
    queryFn: async () => {
      if (!companyId) return [];
      let q = supabase.from('SalesOrder').select('*').eq('company_id', companyId);
      if (selectedYear !== 'all') {
        q = q.gte('created_date', `${selectedYear}-01-01T00:00:00`).lte('created_date', `${selectedYear}-12-31T23:59:59`);
      }
      const { data } = await q.order('created_date', { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const filterByAccess = (item) => {
    if (accessContext.isAdmin) return true;
    const itemSellerId = item.seller_id;
    if (accessContext.isManager && accessContext.managedSellerIds.includes(itemSellerId)) return true;
    if (accessContext.isSeller && itemSellerId === accessContext.currentSellerId) return true;
    if (item.created_by?.toLowerCase() === user?.email?.toLowerCase()) return true;
    return false;
  };

  const filteredData = useMemo(() => {
    if (!visits || !dailyLogs || !quotes || !salesOrders) return { visits: [], dailyLogs: [], quotes: [], salesOrders: [] };
    return {
      visits: visits.filter(filterByAccess),
      dailyLogs: dailyLogs.filter(filterByAccess),
      quotes: quotes.filter(filterByAccess),
      salesOrders: salesOrders.filter(filterByAccess)
    };
  }, [visits, dailyLogs, quotes, salesOrders, accessContext, user]);

  const authorizedSellers = useMemo(() => {
    if (accessContext.isAdmin) return allSellers;
    if (accessContext.isManager) {
        const uniqueIds = new Set([...accessContext.managedSellerIds]);
        if (accessContext.currentSellerId) uniqueIds.add(accessContext.currentSellerId);
        return allSellers.filter(s => uniqueIds.has(s.id));
    }
    if (accessContext.isSeller) return allSellers.filter(s => s.id === accessContext.currentSellerId);
    return [];
  }, [allSellers, accessContext]);

  const kmReport = useMemo(() => {
    if (!filteredData.visits || !filteredData.dailyLogs) return null;
    const filteredVisits = filteredData.visits.filter(v => {
      if (!v.visit_date) return false;
      const date = new Date(`${v.visit_date}T12:00:00`);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      const matchMonth = selectedMonth === 'all' || month === selectedMonth;
      const matchYear = selectedYear === 'all' || year === selectedYear;
      const matchSeller = selectedSeller === 'all' || v.seller_id === selectedSeller;
      return matchMonth && matchYear && matchSeller;
    });
    const filteredLogs = filteredData.dailyLogs.filter(log => {
      if (!log.log_date) return false;
      const date = new Date(`${log.log_date}T12:00:00`);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      const matchMonth = selectedMonth === 'all' || month === selectedMonth;
      const matchYear = selectedYear === 'all' || year === selectedYear;
      const matchSeller = selectedSeller === 'all' || log.seller_id === selectedSeller;
      return matchMonth && matchYear && matchSeller && log.status === 'FECHADO' && log.is_company_vehicle;
    });
    const bySeller = {};
    let totalKm = 0;
    filteredLogs.forEach(log => {
      const km = (log.km_end - log.km_start) || 0;
      const seller = log.seller_name || 'Sem vendedor';
      if (!bySeller[seller]) bySeller[seller] = { km: 0, visits: 0, companyVehicleVisits: 0, days: 0 };
      bySeller[seller].km += km;
      bySeller[seller].days += 1;
      totalKm += km;
    });
    filteredVisits.forEach(v => {
      const seller = v.seller_name || 'Sem vendedor';
      if (!bySeller[seller]) bySeller[seller] = { km: 0, visits: 0, companyVehicleVisits: 0, days: 0 };
      bySeller[seller].visits += 1;
      if (v.is_company_vehicle) bySeller[seller].companyVehicleVisits += 1;
    });
    return {
      bySeller: Object.entries(bySeller).map(([name, data]) => ({ name, km: data.km, visits: data.visits, companyVehicleVisits: data.companyVehicleVisits, days: data.days, avgKmPerDay: data.days > 0 ? data.km / data.days : 0 })).sort((a, b) => b.km - a.km),
      totalKm, totalVisits: filteredVisits.length, totalDays: filteredLogs.length
    };
  }, [filteredData.visits, filteredData.dailyLogs, selectedMonth, selectedYear, selectedSeller]);

  const quotesStats = useMemo(() => {
    if (!filteredData.quotes || !filteredData.salesOrders) return null;
    const filteredQuotes = filteredData.quotes.filter(q => {
      if (!q.created_date) return false;
      const date = new Date(q.created_date);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      const matchMonth = selectedMonth === 'all' || month === selectedMonth;
      const matchYear = selectedYear === 'all' || year === selectedYear;
      const matchSeller = selectedSeller === 'all' || q.seller_id === selectedSeller;
      return matchMonth && matchYear && matchSeller;
    });
    const processedQuotes = filteredQuotes.map(q => {
      let finalValue = q.total_amount || 0;
      if (q.status === 'CONVERTIDO' && q.converted_order_id) {
         const order = filteredData.salesOrders.find(o => o.id === q.converted_order_id);
         if (order) finalValue = order.total_amount || 0;
      }
      return { ...q, effective_value: finalValue, isDirect: false };
    });
    const allConvertedOrderIds = new Set((filteredData.quotes || []).filter(q => q.converted_order_id).map(q => q.converted_order_id));
    const directOrders = (filteredData.salesOrders || []).filter(o => {
      if (allConvertedOrderIds.has(o.id) || !o.created_date) return false;
      const date = new Date(o.created_date);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      const matchMonth = selectedMonth === 'all' || month === selectedMonth;
      const matchYear = selectedYear === 'all' || year === selectedYear;
      const matchSeller = selectedSeller === 'all' || o.seller_id === selectedSeller;
      return matchMonth && matchYear && matchSeller;
    }).map(o => ({ ...o, status: 'CONVERTIDO', effective_value: o.total_amount || 0, isDirect: true }));
    const allDeals = [...processedQuotes, ...directOrders];
    const totalValue = allDeals.reduce((sum, d) => sum + (d.effective_value || 0), 0);
    const converted = allDeals.filter(d => d.status === 'CONVERTIDO').length;
    const conversionRate = allDeals.length > 0 ? (converted / allDeals.length) * 100 : 0;
    const bySeller = allDeals.reduce((acc, d) => {
      const name = d.seller_name || 'Sem vendedor';
      if (!acc[name]) acc[name] = { count: 0, value: 0, converted: 0 };
      acc[name].count += 1; acc[name].value += (d.effective_value || 0);
      if (d.status === 'CONVERTIDO') acc[name].converted += 1;
      return acc;
    }, {});
    const byMonth = allDeals.reduce((acc, d) => {
      const date = new Date(d.created_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!acc[monthKey]) acc[monthKey] = { count: 0, value: 0, converted: 0 };
      acc[monthKey].count += 1; acc[monthKey].value += (d.effective_value || 0);
      if (d.status === 'CONVERTIDO') acc[monthKey].converted += 1;
      return acc;
    }, {});
    const byStatus = allDeals.reduce((acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc; }, {});
    return {
      total: allDeals.length, totalValue, converted, conversionRate, bySeller, byMonth, byStatus,
      avgValue: allDeals.length > 0 ? totalValue / allDeals.length : 0
    };
  }, [filteredData.quotes, filteredData.salesOrders, selectedMonth, selectedYear, selectedSeller]);

  const stats = useMemo(() => {
    if (!filteredData.visits) return null;
    const filteredVisits = filteredData.visits.filter(v => {
      if (!v.visit_date) return false;
      const date = new Date(`${v.visit_date}T12:00:00`);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      const matchMonth = selectedMonth === 'all' || month === selectedMonth;
      const matchYear = selectedYear === 'all' || year === selectedYear;
      const matchSeller = selectedSeller === 'all' || v.seller_id === selectedSeller;
      return matchMonth && matchYear && matchSeller;
    });
    const byStatus = filteredVisits.reduce((acc, v) => { acc[v.status] = (acc[v.status] || 0) + 1; return acc; }, {});
    const bySeller = filteredVisits.reduce((acc, v) => { const name = v.seller_name || 'Sem vendedor'; acc[name] = (acc[name] || 0) + 1; return acc; }, {});
    const byResult = filteredVisits.reduce((acc, v) => { if (v.result) acc[v.result] = (acc[v.result] || 0) + 1; return acc; }, {});
    const proposalsByMonth = filteredVisits.filter(v => v.proposal_sent && v.visit_date).reduce((acc, v) => {
        const date = new Date(`${v.visit_date}T12:00:00`);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        acc[monthKey] = (acc[monthKey] || 0) + 1; return acc;
      }, {});
    const productInterest = {};
    filteredVisits.forEach(v => {
      if (v.interested_products_names) {
        v.interested_products_names.split(',').map(p => p.trim()).forEach(product => {
          if (product) productInterest[product] = (productInterest[product] || 0) + 1;
        });
      }
    });
    return { byStatus, bySeller, byResult, proposalsByMonth, productInterest, total: filteredVisits.length, withProposals: filteredVisits.filter(v => v.proposal_sent).length, avgKm: filteredVisits.length > 0 ? filteredVisits.reduce((sum, v) => sum + (Number(v.vehicle_km_end || 0) - Number(v.vehicle_km_start || 0)), 0) / filteredVisits.length : 0 };
  }, [filteredData.visits, selectedMonth, selectedYear, selectedSeller]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!stats || !kmReport || !quotesStats) return null;

  const years = [...new Set([new Date().getFullYear(), ...filteredData.visits.map(v => new Date(`${v.visit_date}T12:00:00`).getFullYear())])].sort((a,b) => b-a);
  const statusData = Object.entries(stats.byStatus).map(([name, value]) => ({ name, value }));
  const sellerData = Object.entries(stats.bySeller).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  const resultData = Object.entries(stats.byResult).map(([name, value]) => ({ name: name.replace('_', ' '), value }));
  const proposalsData = Object.entries(stats.proposalsByMonth).map(([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  const productsData = Object.entries(stats.productInterest).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  const quotesBySellerData = Object.entries(quotesStats.bySeller).map(([name, data]) => ({ name, count: data.count, value: data.value, converted: data.converted, conversionRate: data.count > 0 ? (data.converted / data.count) * 100 : 0 })).sort((a, b) => b.value - a.value).slice(0, 10);
  const quotesByMonthData = Object.entries(quotesStats.byMonth).map(([month, data]) => ({ month, count: data.count, value: data.value / 1000, converted: data.converted, conversionRate: data.count > 0 ? (data.converted / data.count) * 100 : 0 })).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  const quotesStatusData = Object.entries(quotesStats.byStatus).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-white/20 shadow-sm mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-primary tracking-tight">Dashboard de Prospecção</h1>
          <p className="text-slate-500 mt-1 font-medium italic text-sm">Análise visual das atividades de prospecção</p>
        </div>
      </div>

      <Card className="glass-card border-none shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-bold text-primary uppercase tracking-wider">Filtros Avançados:</span>
            <div className="flex gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-40 rounded-xl bg-white/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Meses</SelectItem>
                  {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                    <SelectItem key={m} value={m}>{['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-28 rounded-xl bg-white/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                <SelectTrigger className="w-48 rounded-xl bg-white/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Vendedores</SelectItem>
                  {authorizedSellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIItem title="Orçamentos Criados" value={quotesStats.total} icon={<FileText className="text-indigo-600"/>} />
        <KPIItem title="Valor Total" value={formatCurrency(quotesStats.totalValue)} icon={<TrendingUp className="text-emerald-600"/>} valueColor="text-emerald-600" />
        <KPIItem title="Taxa de Conversão" value={`${quotesStats.conversionRate.toFixed(1)}%`} icon={<Target className="text-amber-600"/>} valueColor="text-amber-600" />
        <KPIItem title="Ticket Médio" value={formatCurrency(quotesStats.avgValue)} icon={<TrendingUp className="text-blue-600"/>} valueColor="text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Orçamentos por Status">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={quotesStatusData} cx="50%" cy="50%" label={({name, percent}) => `${name} (${(percent*100).toFixed(0)}%)`} outerRadius={100} dataKey="value">
                {quotesStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
        <ChartContainer title="Evolução de Orçamentos e Conversão">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={quotesByMonthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip /><Legend />
              <Line yAxisId="left" type="monotone" dataKey="value" name="Valor (R$ mil)" stroke="#10B981" />
              <Line yAxisId="right" type="monotone" dataKey="conversionRate" name="Conv. (%)" stroke="#F59E0B" />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      <Card>
        <CardHeader><CardTitle>Orçamentos por Vendedor (Top 10)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Vendedor</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor Total</TableHead><TableHead className="text-right">Convertidos</TableHead><TableHead className="text-right">Taxa Conv.</TableHead><TableHead className="text-right">Ticket Médio</TableHead></TableRow></TableHeader>
            <TableBody>
              {quotesBySellerData.map((s, i) => (
                <TableRow key={i}><TableCell>{s.name}</TableCell><TableCell className="text-right">{s.count}</TableCell><TableCell className="text-right font-medium text-emerald-600">{formatCurrency(s.value)}</TableCell><TableCell className="text-right">{s.converted}</TableCell><TableCell className="text-right">{s.conversionRate.toFixed(1)}%</TableCell><TableCell className="text-right">{formatCurrency(s.value / s.count)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIItem title="Total de Visitas" value={stats.total} icon={<Calendar className="text-indigo-600"/>} />
        <KPIItem title="Propostas Enviadas" value={stats.withProposals} icon={<FileText className="text-emerald-600"/>} valueColor="text-emerald-600" />
        <KPIItem title="Taxa de Propostas" value={`${((stats.withProposals/stats.total)*100).toFixed(1)}%`} icon={<Target className="text-amber-600"/>} valueColor="text-amber-600" />
        <KPIItem title="Média KM/Visita" value={stats.avgKm.toFixed(1)} icon={<TrendingUp className="text-blue-600"/>} valueColor="text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Visitas por Status">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" label={({name, percent}) => `${name} (${(percent*100).toFixed(0)}%)`} outerRadius={100} dataKey="value">
                {statusData.map((e, i) => <Cell key={i} fill={statusColors[e.name] || COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
        <ChartContainer title="Resultados das Visitas">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={resultData}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" angle={-45} textAnchor="end" height={80} /><YAxis /><Tooltip />
              <Bar dataKey="value" fill="#4F46E5">{resultData.map((e, i) => <Cell key={i} fill={resultColors[e.name.replace(' ','_')] || COLORS[i]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      <Card>
        <CardHeader><CardTitle>Relatórios Adicionais (KM por Vendedor)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Vendedor</TableHead><TableHead className="text-right">KM Total</TableHead><TableHead className="text-right">Dias Operados</TableHead><TableHead className="text-right">Visitas</TableHead><TableHead className="text-right">Média KM/Dia</TableHead></TableRow></TableHeader>
            <TableBody>
              {kmReport.bySeller.map((s, i) => (
                <TableRow key={i}><TableCell>{s.name}</TableCell><TableCell className="text-right">{s.km.toFixed(1)}</TableCell><TableCell className="text-right">{s.days}</TableCell><TableCell className="text-right">{s.visits}</TableCell><TableCell className="text-right">{s.avgKmPerDay.toFixed(1)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KPIItem({ title, value, icon, valueColor = "text-slate-900" }) {
  return (
    <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{title}</p><p className={`text-2xl font-bold ${valueColor}`}>{value}</p></div><div className="h-10 w-10">{icon}</div></div></CardContent></Card>
  );
}

function ChartContainer({ title, children }) {
  return (
    <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>
  );
}