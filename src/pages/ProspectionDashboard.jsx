import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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

  // Recupera vendedores (Carga Segura)
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

  const { data: visits, isLoading: loadingVisits } = useQuery({
    queryKey: ['prospection-visits-dashboard-v3', companyId],
    queryFn: () => companyId ? base44.entities.ProspectionVisit.filter({ company_id: companyId }, '-visit_date') : Promise.resolve([]),
    enabled: !!companyId,
    refetchInterval: 300000, // 5 min
  });

  const { data: dailyLogs } = useQuery({
    queryKey: ['daily-vehicle-logs-report-v3', companyId],
    queryFn: () => companyId ? base44.entities.DailyVehicleLog.filter({ company_id: companyId }, '-log_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: quotes } = useQuery({
    queryKey: ['quotes-dashboard-v3', companyId],
    queryFn: () => companyId ? base44.entities.Quote.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: salesOrders } = useQuery({
    queryKey: ['sales-orders-dashboard-v3', companyId],
    queryFn: () => companyId ? base44.entities.SalesOrder.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
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

  const kmReport = useMemo(() => {
    if (!filteredData.visits || !filteredData.dailyLogs) return { bySeller: [], totalKm: 0, totalVisits: 0 };
    const filteredVisits = filteredData.visits.filter(v => {
      if (!v.visit_date) return false;
      const date = new Date(`${v.visit_date}T12:00:00`);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      return (selectedMonth === 'all' || month === selectedMonth) && (selectedYear === 'all' || year === selectedYear) && (selectedSeller === 'all' || v.seller_id === selectedSeller);
    });
    const filteredLogs = filteredData.dailyLogs.filter(log => {
      if (!log.log_date) return false;
      const date = new Date(`${log.log_date}T12:00:00`);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      return (selectedMonth === 'all' || month === selectedMonth) && (selectedYear === 'all' || year === selectedYear) && (selectedSeller === 'all' || log.seller_id === selectedSeller) && log.status === 'FECHADO' && log.is_company_vehicle;
    });
    const bySeller = {};
    let totalKm = 0;
    filteredLogs.forEach(log => {
      const km = (log.km_end - log.km_start) || 0;
      const seller = log.seller_name || 'Sem vendedor';
      if (!bySeller[seller]) bySeller[seller] = { km: 0, visits: 0, days: 0 };
      bySeller[seller].km += km; bySeller[seller].days += 1; totalKm += km;
    });
    filteredVisits.forEach(v => {
      const seller = v.seller_name || 'Sem vendedor';
      if (!bySeller[seller]) bySeller[seller] = { km: 0, visits: 0, days: 0 };
      bySeller[seller].visits += 1;
    });
    return {
      bySeller: Object.entries(bySeller).map(([name, d]) => ({ name, ...d, avgKmPerDay: d.days > 0 ? d.km / d.days : 0 })).sort((a,b) => b.km - a.km),
      totalKm, totalVisits: filteredVisits.length
    };
  }, [filteredData.visits, filteredData.dailyLogs, selectedMonth, selectedYear, selectedSeller]);

  const quotesStats = useMemo(() => {
    if (!filteredData.quotes || !filteredData.salesOrders) return { total: 0, totalValue: 0, conversionRate: 0, avgValue: 0, bySeller: {}, byMonth: {}, byStatus: {} };
    const filteredQuotes = filteredData.quotes.filter(q => {
      if (!q.created_date) return false;
      const date = new Date(q.created_date);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      return (selectedMonth === 'all' || month === selectedMonth) && (selectedYear === 'all' || year === selectedYear) && (selectedSeller === 'all' || q.seller_id === selectedSeller);
    });
    const processedQuotes = filteredQuotes.map(q => {
      let val = q.total_amount || 0;
      if (q.status === 'CONVERTIDO' && q.converted_order_id) {
         const order = filteredData.salesOrders.find(o => o.id === q.converted_order_id);
         if (order) val = order.total_amount || 0;
      }
      return { ...q, effective_value: val };
    });
    const totalValue = processedQuotes.reduce((sum, d) => sum + (d.effective_value || 0), 0);
    const converted = processedQuotes.filter(d => d.status === 'CONVERTIDO').length;
    const byStatus = processedQuotes.reduce((acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc; }, {});
    const bySeller = processedQuotes.reduce((acc, d) => {
      const name = d.seller_name || 'Sem vendedor';
      if (!acc[name]) acc[name] = { count: 0, value: 0, converted: 0 };
      acc[name].count += 1; acc[name].value += d.effective_value; if (d.status === 'CONVERTIDO') acc[name].converted += 1;
      return acc;
    }, {});
    const byMonth = processedQuotes.reduce((acc, d) => {
      const date = new Date(d.created_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!acc[monthKey]) acc[monthKey] = { count: 0, value: 0, converted: 0 };
      acc[monthKey].count += 1; acc[monthKey].value += d.effective_value; if (d.status === 'CONVERTIDO') acc[monthKey].converted += 1;
      return acc;
    }, {});
    return { total: processedQuotes.length, totalValue, converted, conversionRate: processedQuotes.length > 0 ? (converted / processedQuotes.length) * 100 : 0, avgValue: processedQuotes.length > 0 ? totalValue / processedQuotes.length : 0, bySeller, byMonth, byStatus };
  }, [filteredData.quotes, filteredData.salesOrders, selectedMonth, selectedYear, selectedSeller]);

  const stats = useMemo(() => {
    if (!filteredData.visits) return null;
    const fVisits = filteredData.visits.filter(v => {
      if (!v.visit_date) return false;
      const date = new Date(`${v.visit_date}T12:00:00`);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      return (selectedMonth === 'all' || month === selectedMonth) && (selectedYear === 'all' || year === selectedYear) && (selectedSeller === 'all' || v.seller_id === selectedSeller);
    });
    const byStatus = fVisits.reduce((acc, v) => { acc[v.status] = (acc[v.status] || 0) + 1; return acc; }, {});
    const bySeller = fVisits.reduce((acc, v) => { const name = v.seller_name || 'Sem vendedor'; acc[name] = (acc[name] || 0) + 1; return acc; }, {});
    const byResult = fVisits.reduce((acc, v) => { if (v.result) acc[v.result] = (acc[v.result] || 0) + 1; return acc; }, {});
    const proposalsByMonth = fVisits.filter(v => v.proposal_sent && v.visit_date).reduce((acc, v) => {
        const date = new Date(`${v.visit_date}T12:00:00`);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        acc[monthKey] = (acc[monthKey] || 0) + 1; return acc;
    }, {});
    return { byStatus, bySeller, byResult, proposalsByMonth, total: fVisits.length, withProposals: fVisits.filter(v => v.proposal_sent).length, avgKm: fVisits.length > 0 ? fVisits.reduce((sum, v) => sum + (Number(v.vehicle_km_end || 0) - Number(v.vehicle_km_start || 0)), 0) / fVisits.length : 0 };
  }, [filteredData.visits, selectedMonth, selectedYear, selectedSeller]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  if (loadingVisits || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full px-10">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const years = [...new Set([new Date().getFullYear(), ...filteredData.visits.map(v => new Date(`${v.visit_date}T12:00:00`).getFullYear())])].sort((a,b) => b-a);
  const statusData = Object.entries(stats.byStatus).map(([name, value]) => ({ name, value }));
  const sellerData = Object.entries(stats.bySeller).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
  const resultData = Object.entries(stats.byResult).map(([name, value]) => ({ name: name.replace('_',' '), value }));
  const quotesByMonthData = Object.entries(quotesStats.byMonth).map(([month, data]) => ({ month, value: data.value / 1000, conversionRate: data.count > 0 ? (data.converted / data.count) * 100 : 0 })).sort((a,b) => a.month.localeCompare(b.month)).slice(-12);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard de Prospecção</h1>
          <p className="text-slate-500 text-sm">Visualização completa dos resultados.</p>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-4 flex flex-wrap gap-4 items-center">
            <span className="text-sm font-bold text-slate-500 uppercase">Filtros:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo o Ano</SelectItem>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                  <SelectItem key={m} value={m}>{['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedSeller} onValueChange={setSelectedSeller}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Vendedores</SelectItem>
                {allSellers.filter(s => accessContext.isAdmin || accessContext.managedSellerIds.includes(s.id) || s.id === accessContext.currentSellerId).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Orçamentos" value={quotesStats.total} icon={<FileText className="text-indigo-600"/>} />
        <KPICard title="Valor Total" value={formatCurrency(quotesStats.totalValue)} icon={<TrendingUp className="text-emerald-600"/>} color="text-emerald-600" />
        <KPICard title="Conversão" value={`${quotesStats.conversionRate.toFixed(1)}%`} icon={<Target className="text-amber-600"/>} color="text-amber-600" />
        <KPICard title="Visitas" value={stats.total} icon={<Calendar className="text-blue-600"/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartBox title="Orçamentos por Status">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={Object.entries(quotesStats.byStatus).map(([name, value]) => ({ name, value }))} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name, percent}) => `${name} (${(percent*100).toFixed(0)}%)`}>
                {Object.entries(quotesStats.byStatus).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartBox>
        <ChartBox title="Evolução de Orçamentos">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={quotesByMonthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" /><YAxis yAxisId="left" /><YAxis yAxisId="right" orientation="right" />
              <Tooltip /><Legend />
              <Line yAxisId="left" type="monotone" dataKey="value" name="R$ Mil" stroke="#10B981" />
              <Line yAxisId="right" type="monotone" dataKey="conversionRate" name="Conv. %" stroke="#F59E0B" />
            </LineChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

       <Card>
        <CardHeader><CardTitle>Orçamentos por Vendedor</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Vendedor</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Conv.</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
            <TableBody>
              {Object.entries(quotesStats.bySeller).sort((a,b) => b[1].value - a[1].value).map(([name, d], i) => (
                <TableRow key={i}><TableCell className="font-medium">{name}</TableCell><TableCell className="text-right">{d.count}</TableCell><TableCell className="text-right text-emerald-600 font-bold">{formatCurrency(d.value)}</TableCell><TableCell className="text-right">{d.converted}</TableCell><TableCell className="text-right">{(d.count > 0 ? (d.converted / d.count) * 100 : 0).toFixed(1)}%</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartBox title="Visitas por Status">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name, percent}) => `${name} (${(percent*100).toFixed(0)}%)`}>
                {statusData.map((e, i) => <Cell key={i} fill={statusColors[e.name] || COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartBox>
        <ChartBox title="Resultados das Visitas">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={resultData}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" angle={-45} textAnchor="end" height={80} /><YAxis /><Tooltip />
              <Bar dataKey="value" fill="#4F46E5">{resultData.map((e, i) => <Cell key={i} fill={resultColors[e.name.replace(' ','_')] || COLORS[i]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      <Card>
        <CardHeader><CardTitle>KM por Vendedor</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Vendedor</TableHead><TableHead className="text-right">KM Total</TableHead><TableHead className="text-right">Visitas</TableHead><TableHead className="text-right">Média/Dia</TableHead></TableRow></TableHeader>
            <TableBody>
              {kmReport.bySeller.map((s, i) => (
                <TableRow key={i}><TableCell>{s.name}</TableCell><TableCell className="text-right">{s.km.toFixed(1)}</TableCell><TableCell className="text-right">{s.visits}</TableCell><TableCell className="text-right">{s.avgKmPerDay.toFixed(1)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ title, value, icon, color = "text-slate-900" }) {
  return (
    <Card className="shadow-sm border-none bg-white"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">{title}</p><p className={`text-2xl font-black ${color}`}>{value}</p></div><div className="p-3 bg-slate-50 rounded-xl">{icon}</div></div></CardContent></Card>
  );
}

function ChartBox({ title, children }) {
  return (
    <Card className="shadow-sm border-none bg-white"><CardHeader className="pb-2"><CardTitle className="text-lg font-bold text-slate-800">{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>
  );
}