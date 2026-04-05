import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
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
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth() + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));
  const [selectedSeller, setSelectedSeller] = useState('all');

  const { data: visits, isLoading } = useQuery({
    queryKey: ['prospection-visits-dashboard', companyId],
    queryFn: () => companyId ? base44.entities.ProspectionVisit.filter({ company_id: companyId }, '-visit_date') : Promise.resolve([]),
    enabled: !!companyId,
    refetchInterval: 60000, // Atualizar a cada 60 segundos
  });

  // Fetch daily logs
  const { data: dailyLogs } = useQuery({
    queryKey: ['daily-vehicle-logs-report', companyId],
    queryFn: () => companyId ? base44.entities.DailyVehicleLog.filter({ company_id: companyId }, '-log_date') : Promise.resolve([]),
    enabled: !!companyId,
    refetchInterval: 60000, // Atualizar a cada 60 segundos
  });

  const { data: quotes } = useQuery({
    queryKey: ['quotes-dashboard', companyId],
    queryFn: () => companyId ? base44.entities.Quote.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
    refetchInterval: 60000, // Atualizar a cada 60 segundos
  });

  // KM Report
  const kmReport = useMemo(() => {
    if (!visits || !dailyLogs) return null;

    const filteredVisits = visits.filter(v => {
      const date = new Date(v.visit_date);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      
      const matchMonth = selectedMonth === 'all' || month === selectedMonth;
      const matchYear = selectedYear === 'all' || year === selectedYear;
      const matchSeller = selectedSeller === 'all' || v.seller_id === selectedSeller;
      
      return matchMonth && matchYear && matchSeller;
    });

    const filteredLogs = dailyLogs.filter(log => {
      const date = new Date(log.log_date);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      
      const matchMonth = selectedMonth === 'all' || month === selectedMonth;
      const matchYear = selectedYear === 'all' || year === selectedYear;
      const matchSeller = selectedSeller === 'all' || log.seller_id === selectedSeller;
      
      return matchMonth && matchYear && matchSeller && log.status === 'FECHADO' && log.is_company_vehicle;
    });

    const bySeller = {};
    let totalKm = 0;

    // Usar registros diários para KM
    filteredLogs.forEach(log => {
      const km = (log.km_end - log.km_start) || 0;
      const seller = log.seller_name || 'Sem vendedor';
      
      if (!bySeller[seller]) {
        bySeller[seller] = { km: 0, visits: 0, companyVehicleVisits: 0, days: 0 };
      }
      
      bySeller[seller].km += km;
      bySeller[seller].days += 1;
      totalKm += km;
    });

    // Contar visitas
    filteredVisits.forEach(v => {
      const seller = v.seller_name || 'Sem vendedor';
      
      if (!bySeller[seller]) {
        bySeller[seller] = { km: 0, visits: 0, companyVehicleVisits: 0, days: 0 };
      }
      
      bySeller[seller].visits += 1;
      if (v.is_company_vehicle) {
        bySeller[seller].companyVehicleVisits += 1;
      }
    });

    return {
      bySeller: Object.entries(bySeller)
        .map(([name, data]) => ({ 
          name, 
          km: data.km, 
          visits: data.visits,
          companyVehicleVisits: data.companyVehicleVisits,
          days: data.days,
          avgKmPerDay: data.days > 0 ? data.km / data.days : 0
        }))
        .sort((a, b) => b.km - a.km),
      totalKm,
      totalVisits: filteredVisits.length,
      totalDays: filteredLogs.length
    };
  }, [visits, dailyLogs, selectedMonth, selectedYear, selectedSeller]);

  const quotesStats = useMemo(() => {
    if (!quotes) return null;

    const filteredQuotes = quotes.filter(q => {
      const date = new Date(q.created_date);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      
      const matchMonth = selectedMonth === 'all' || month === selectedMonth;
      const matchYear = selectedYear === 'all' || year === selectedYear;
      const matchSeller = selectedSeller === 'all' || q.seller_id === selectedSeller;
      
      return matchMonth && matchYear && matchSeller;
    });

    const totalValue = filteredQuotes.reduce((sum, q) => sum + (q.total_amount || 0), 0);
    const converted = filteredQuotes.filter(q => q.status === 'CONVERTIDO').length;
    const conversionRate = filteredQuotes.length > 0 ? (converted / filteredQuotes.length) * 100 : 0;

    // Por vendedor
    const bySeller = filteredQuotes.reduce((acc, q) => {
      const name = q.seller_name || 'Sem vendedor';
      if (!acc[name]) {
        acc[name] = { count: 0, value: 0, converted: 0 };
      }
      acc[name].count += 1;
      acc[name].value += q.total_amount || 0;
      if (q.status === 'CONVERTIDO') {
        acc[name].converted += 1;
      }
      return acc;
    }, {});

    // Por mês
    const byMonth = filteredQuotes.reduce((acc, q) => {
      const date = new Date(q.created_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!acc[monthKey]) {
        acc[monthKey] = { count: 0, value: 0, converted: 0 };
      }
      acc[monthKey].count += 1;
      acc[monthKey].value += q.total_amount || 0;
      if (q.status === 'CONVERTIDO') {
        acc[monthKey].converted += 1;
      }
      return acc;
    }, {});

    // Por status
    const byStatus = filteredQuotes.reduce((acc, q) => {
      acc[q.status] = (acc[q.status] || 0) + 1;
      return acc;
    }, {});

    return {
      total: filteredQuotes.length,
      totalValue,
      converted,
      conversionRate,
      bySeller,
      byMonth,
      byStatus,
      avgValue: filteredQuotes.length > 0 ? totalValue / filteredQuotes.length : 0
    };
  }, [quotes, selectedMonth, selectedYear, selectedSeller]);

  const stats = useMemo(() => {
    if (!visits) return null;

    // Visitas por status
    const byStatus = visits.reduce((acc, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {});

    // Visitas por vendedor
    const bySeller = visits.reduce((acc, v) => {
      const name = v.seller_name || 'Sem vendedor';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    // Resultados
    const byResult = visits.reduce((acc, v) => {
      if (v.result) {
        acc[v.result] = (acc[v.result] || 0) + 1;
      }
      return acc;
    }, {});

    // Propostas por mês
    const proposalsByMonth = visits
      .filter(v => v.proposal_sent && v.visit_date)
      .reduce((acc, v) => {
        const date = new Date(v.visit_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        acc[monthKey] = (acc[monthKey] || 0) + 1;
        return acc;
      }, {});

    // Produtos mais procurados
    const productInterest = {};
    visits.forEach(v => {
      if (v.interested_products_names) {
        const products = v.interested_products_names.split(',').map(p => p.trim());
        products.forEach(product => {
          if (product) {
            productInterest[product] = (productInterest[product] || 0) + 1;
          }
        });
      }
    });

    return {
      byStatus,
      bySeller,
      byResult,
      proposalsByMonth,
      productInterest,
      total: visits.length,
      withProposals: visits.filter(v => v.proposal_sent).length,
      avgKm: visits.reduce((sum, v) => sum + (v.vehicle_km_end - v.vehicle_km_start || 0), 0) / visits.length,
    };
  }, [visits]);

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

  // Get unique sellers for filter
  const sellers = [...new Set(visits?.map(v => ({ id: v.seller_id, name: v.seller_name })))];
  
  // Get years from visits
  const years = [...new Set(visits?.map(v => new Date(v.visit_date).getFullYear()))].sort((a, b) => b - a);

  const statusData = Object.entries(stats.byStatus).map(([name, value]) => ({ name, value }));
  const sellerData = Object.entries(stats.bySeller)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  const resultData = Object.entries(stats.byResult).map(([name, value]) => ({ 
    name: name.replace('_', ' '), 
    value 
  }));
  const proposalsData = Object.entries(stats.proposalsByMonth)
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);
  const productsData = Object.entries(stats.productInterest)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const quotesBySellerData = Object.entries(quotesStats.bySeller)
    .map(([name, data]) => ({ 
      name, 
      count: data.count,
      value: data.value, 
      converted: data.converted,
      conversionRate: data.count > 0 ? (data.converted / data.count) * 100 : 0
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const quotesByMonthData = Object.entries(quotesStats.byMonth)
    .map(([month, data]) => ({ 
      month, 
      count: data.count,
      value: data.value / 1000, // em milhares
      converted: data.converted,
      conversionRate: data.count > 0 ? (data.converted / data.count) * 100 : 0
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);

  const quotesStatusData = Object.entries(quotesStats.byStatus).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-white/20 shadow-sm mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-primary tracking-tight">Dashboard de Prospecção</h1>
          <p className="text-slate-500 mt-1 font-medium italic text-sm">Análise visual das atividades de prospecção</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="glass-card border-none shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-bold text-primary uppercase tracking-wider">Filtros Avançados:</span>
            <div className="flex gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-40 rounded-xl bg-white/50">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Meses</SelectItem>
                  <SelectItem value="01">Janeiro</SelectItem>
                  <SelectItem value="02">Fevereiro</SelectItem>
                  <SelectItem value="03">Março</SelectItem>
                  <SelectItem value="04">Abril</SelectItem>
                  <SelectItem value="05">Maio</SelectItem>
                  <SelectItem value="06">Junho</SelectItem>
                  <SelectItem value="07">Julho</SelectItem>
                  <SelectItem value="08">Agosto</SelectItem>
                  <SelectItem value="09">Setembro</SelectItem>
                  <SelectItem value="10">Outubro</SelectItem>
                  <SelectItem value="11">Novembro</SelectItem>
                  <SelectItem value="12">Dezembro</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-28 rounded-xl bg-white/50">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {years.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                <SelectTrigger className="w-48 rounded-xl bg-white/50">
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Vendedores</SelectItem>
                  {sellers.map(seller => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orçamentos KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Orçamentos Criados</p>
                <p className="text-2xl font-bold text-slate-900">{quotesStats.total}</p>
              </div>
              <FileText className="h-10 w-10 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Valor Total</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(quotesStats.totalValue)}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Taxa de Conversão</p>
                <p className="text-2xl font-bold text-amber-600">
                  {quotesStats.conversionRate.toFixed(1)}%
                </p>
              </div>
              <Target className="h-10 w-10 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ticket Médio</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(quotesStats.avgValue)}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orçamentos Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Orçamentos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={quotesStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {quotesStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolução de Orçamentos e Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={quotesByMonthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="value" name="Valor (R$ mil)" stroke="#10B981" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="conversionRate" name="Conv. (%)" stroke="#F59E0B" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Orçamentos por Vendedor */}
      <Card>
        <CardHeader>
          <CardTitle>Orçamentos por Vendedor (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Convertidos</TableHead>
                <TableHead className="text-right">Taxa Conv.</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotesBySellerData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    Nenhum orçamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                quotesBySellerData.map((seller, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{seller.name}</TableCell>
                    <TableCell className="text-right">{seller.count}</TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">{formatCurrency(seller.value)}</TableCell>
                    <TableCell className="text-right">{seller.converted}</TableCell>
                    <TableCell className="text-right font-medium">{seller.conversionRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(seller.value / seller.count)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* KPIs Visitas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total de Visitas</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <Calendar className="h-10 w-10 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Propostas Enviadas</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.withProposals}</p>
              </div>
              <FileText className="h-10 w-10 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Taxa de Propostas</p>
                <p className="text-2xl font-bold text-amber-600">
                  {((stats.withProposals / stats.total) * 100).toFixed(1)}%
                </p>
              </div>
              <Target className="h-10 w-10 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Média KM/Visita</p>
                <p className="text-2xl font-bold text-blue-600">{stats.avgKm.toFixed(1)}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Visitas por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={statusColors[entry.name] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultados das Visitas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={resultData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#4F46E5">
                  {resultData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={resultColors[entry.name.replace(' ', '_')] || COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Visitas por Vendedor (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sellerData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Propostas Enviadas (Últimos 6 Meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={proposalsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" name="Propostas" stroke="#F59E0B" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Products Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos com Maior Interesse (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={productsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* KM Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Relatório de KM Rodados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-indigo-50 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-500">Total KM</p>
                <p className="text-2xl font-bold text-indigo-600">{kmReport.totalKm.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Visitas</p>
                <p className="text-2xl font-bold text-indigo-600">{kmReport.totalVisits}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Média KM/Visita</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {kmReport.totalVisits > 0 ? (kmReport.totalKm / kmReport.totalVisits).toFixed(1) : '0'}
                </p>
              </div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Visitas</TableHead>
                <TableHead className="text-right">Veículo Empresa</TableHead>
                <TableHead className="text-right">Dias Registrados</TableHead>
                <TableHead className="text-right">KM Total</TableHead>
                <TableHead className="text-right">KM Médio/Dia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kmReport.bySeller.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    Nenhum dado encontrado para o período selecionado
                  </TableCell>
                </TableRow>
              ) : (
                kmReport.bySeller.map((seller, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{seller.name}</TableCell>
                    <TableCell className="text-right">{seller.visits}</TableCell>
                    <TableCell className="text-right">{seller.companyVehicleVisits}</TableCell>
                    <TableCell className="text-right">{seller.days}</TableCell>
                    <TableCell className="text-right font-medium">{seller.km.toFixed(1)} km</TableCell>
                    <TableCell className="text-right">{seller.avgKmPerDay.toFixed(1)} km</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}