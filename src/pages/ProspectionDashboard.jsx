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

  // Fetch all sellers to determine management/team
  const { data: allSellers = [] } = useQuery({
    queryKey: ['sellers', companyId],
    queryFn: () => companyId ? base44.entities.Seller.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  // Calculate access context
  const accessContext = useMemo(() => {
    if (!user || !allSellers) return { isAdmin: false, isManager: false, isSeller: false, managedSellerIds: [], currentSellerId: null };

    const isAdmin = user.role?.toLowerCase() === 'admin' || user.email?.toLowerCase() === 'jonata.santos@agfequipamentos.com.br';
    
    // Check if user is a seller (by email)
    const sellerRecord = allSellers.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
    const isSeller = !!sellerRecord;
    const currentSellerId = sellerRecord?.id || null;

    // Check if user is a manager (any seller has them in manager_ids)
    const managedSellers = allSellers.filter(s => {
        const managers = Array.isArray(s.manager_ids) ? s.manager_ids : [];
        return managers.includes(user.id);
    });
    const isManager = managedSellers.length > 0;
    const managedSellerIds = managedSellers.map(s => s.id);

    return { isAdmin, isManager, isSeller, managedSellerIds, currentSellerId };
  }, [user, allSellers]);

  // If user is a seller but not manager/admin, fix the selected seller
  useMemo(() => {
    if (selectedSeller === 'all' && !accessContext.isAdmin && !accessContext.isManager && accessContext.isSeller) {
        setSelectedSeller(accessContext.currentSellerId);
    }
  }, [accessContext, selectedSeller]);

  const { data: visits, isLoading } = useQuery({
    queryKey: ['prospection-visits-dashboard', companyId],
    queryFn: () => companyId ? base44.entities.ProspectionVisit.filter({ company_id: companyId }, '-visit_date') : Promise.resolve([]),
    enabled: !!companyId,
    refetchInterval: 60000,
  });

  const { data: dailyLogs } = useQuery({
    queryKey: ['daily-vehicle-logs-report', companyId],
    queryFn: () => companyId ? base44.entities.DailyVehicleLog.filter({ company_id: companyId }, '-log_date') : Promise.resolve([]),
    enabled: !!companyId,
    refetchInterval: 60000,
  });

  const { data: quotes } = useQuery({
    queryKey: ['quotes-dashboard', companyId],
    queryFn: () => companyId ? base44.entities.Quote.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
    refetchInterval: 60000,
  });

  const { data: salesOrders } = useQuery({
    queryKey: ['sales-orders-dashboard', companyId],
    queryFn: () => companyId ? base44.entities.SalesOrder.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
    refetchInterval: 60000,
  });

  // Helper to filter data by user access
  const filterByAccess = (item) => {
    if (accessContext.isAdmin) return true;
    
    const itemSellerId = item.seller_id;
    
    // Se é gerente, vê os seus gerenciados
    if (accessContext.isManager && accessContext.managedSellerIds.includes(itemSellerId)) return true;
    
    // Se é o próprio vendedor
    if (accessContext.isSeller && itemSellerId === accessContext.currentSellerId) return true;

    // Caso especial: criado pelo próprio usuário (email)
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
        // Manager sees their managed sellers + themselves if they are a seller
        const uniqueIds = new Set([...accessContext.managedSellerIds]);
        if (accessContext.currentSellerId) uniqueIds.add(accessContext.currentSellerId);
        return allSellers.filter(s => uniqueIds.has(s.id));
    }
    if (accessContext.isSeller) {
        return allSellers.filter(s => s.id === accessContext.currentSellerId);
    }
    return [];
  }, [allSellers, accessContext]);

  // KM Report
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
  }, [filteredData.visits, filteredData.dailyLogs, selectedMonth, selectedYear, selectedSeller]);

  const quotesStats = useMemo(() => {
    if (!filteredData.quotes || !filteredData.salesOrders) return null;

    const filteredQuotes = filteredData.quotes.filter(q => {
      if (!q.created_date) return false;
      const date = new Date(q.created_date); // created_date is ISO with T
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

    const allConvertedOrderIds = new Set(
      (filteredData.quotes || [])
        .filter(q => q.converted_order_id)
        .map(q => q.converted_order_id)
    );
    
    // Obter também os pedidos diretos (que não nasceram de orçamento)
    const directOrders = (filteredData.salesOrders || []).filter(o => {
      if (allConvertedOrderIds.has(o.id)) return false;
      if (!o.created_date) return false;
      const date = new Date(o.created_date);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      
      const matchMonth = selectedMonth === 'all' || month === selectedMonth;
      const matchYear = selectedYear === 'all' || year === selectedYear;
      const matchSeller = selectedSeller === 'all' || o.seller_id === selectedSeller;
      
      return matchMonth && matchYear && matchSeller;
    }).map(o => ({
      ...o,
      status: 'CONVERTIDO', // Pedido direto é considerado uma conversão imediata
      effective_value: o.total_amount || 0,
      isDirect: true
    }));

    const totalValue = processedQuotes.reduce((sum, d) => sum + (d.effective_value || 0), 0) + 
                       directOrders.reduce((sum, d) => sum + (d.effective_value || 0), 0);
    
    // Converted refers specifically to Quotes that became orders
    const convertedQuotesCount = processedQuotes.filter(d => d.status === 'CONVERTIDO').length;
    const conversionRate = processedQuotes.length > 0 ? (convertedQuotesCount / processedQuotes.length) * 100 : 0;

    // Total deals for charts and overall totals
    const allDeals = [...processedQuotes, ...directOrders];

    // Por vendedor
    const bySeller = allDeals.reduce((acc, d) => {
      const name = d.seller_name || 'Sem vendedor';
      if (!acc[name]) {
        acc[name] = { count: 0, value: 0, converted: 0 };
      }
      acc[name].count += 1;
      acc[name].value += (d.effective_value || 0);
      if (d.status === 'CONVERTIDO') {
        acc[name].converted += 1;
      }
      return acc;
    }, {});

    // Por mês (Evolução - Ignora o filtro de mês para mostrar a tendência)
    const monthsKeys = [];
    for (let i = 1; i <= 12; i++) {
      monthsKeys.push(`${selectedYear}-${String(i).padStart(2, '0')}`);
    }

    const byMonth = {};
    monthsKeys.forEach(key => {
      byMonth[key] = { count: 0, value: 0, converted: 0 };
    });

    [...filteredData.quotes, ...filteredData.salesOrders]
      .filter(item => {
        if (!item.created_date) return false;
        const date = new Date(item.created_date);
        const year = String(date.getFullYear());
        const matchYear = selectedYear === 'all' || year === selectedYear;
        const matchSeller = selectedSeller === 'all' || item.seller_id === selectedSeller;
        return matchYear && matchSeller;
      })
      .forEach(d => {
        const date = new Date(d.created_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (byMonth[monthKey]) {
          byMonth[monthKey].count += 1;
          byMonth[monthKey].value += (d.total_amount || 0);
          if (d.status === 'CONVERTIDO' || d.id.startsWith('so_')) {
            byMonth[monthKey].converted += 1;
          }
        }
      });

    // Por status
    const byStatus = allDeals.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {});

    return {
      total: processedQuotes.length,
      directOrdersCount: directOrders.length,
      totalValue,
      converted: convertedQuotesCount,
      conversionRate,
      bySeller,
      byMonth,
      byStatus,
      avgValue: processedQuotes.length > 0 ? totalValue / (processedQuotes.length + directOrders.length) : (directOrders.length > 0 ? totalValue / directOrders.length : 0)
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

    // Visitas por status
    const byStatus = filteredVisits.reduce((acc, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {});

    // Visitas por vendedor
    const bySeller = filteredVisits.reduce((acc, v) => {
      const name = v.seller_name || 'Sem vendedor';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    // Resultados
    const byResult = filteredVisits.reduce((acc, v) => {
      if (v.result) {
        acc[v.result] = (acc[v.result] || 0) + 1;
      }
      return acc;
    }, {});

    const proposalsByMonth = filteredData.visits
      .filter(v => v.proposal_sent && v.visit_date)
      .filter(v => {
        const date = new Date(`${v.visit_date}T12:00:00`);
        const year = String(date.getFullYear());
        const matchYear = selectedYear === 'all' || year === selectedYear;
        const matchSeller = selectedSeller === 'all' || v.seller_id === selectedSeller;
        return matchYear && matchSeller;
      })
      .reduce((acc, v) => {
        const date = new Date(`${v.visit_date}T12:00:00`);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        acc[monthKey] = (acc[monthKey] || 0) + 1;
        return acc;
      }, {});

    // Produtos mais procurados
    const productInterest = {};
    filteredVisits.forEach(v => {
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
      total: filteredVisits.length,
      withProposals: filteredVisits.filter(v => v.proposal_sent).length,
      avgKm: filteredVisits.length > 0 
        ? filteredVisits.reduce((sum, v) => sum + (Number(v.vehicle_km_end || 0) - Number(v.vehicle_km_start || 0)), 0) / filteredVisits.length 
        : 0,
    };
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

  // Get years from all data items and ensure current year is an option
  const currentYear = new Date().getFullYear();
  const allYearsSet = new Set([currentYear]);
  
  filteredData.visits?.forEach(v => {
    if (v.visit_date) allYearsSet.add(new Date(`${v.visit_date}T12:00:00`).getFullYear());
  });
  
  filteredData.quotes?.forEach(q => {
    if (q.created_date) allYearsSet.add(new Date(q.created_date).getFullYear());
  });

  filteredData.salesOrders?.forEach(o => {
    if (o.created_date) allYearsSet.add(new Date(o.created_date).getFullYear());
  });

  const years = [...allYearsSet].sort((a, b) => b - a);

  const sellersList = authorizedSellers;

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
                  {(accessContext.isAdmin || accessContext.isManager) && (
                    <SelectItem value="all">Todos Vendedores</SelectItem>
                  )}
                  {sellersList.map(seller => (
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
                <div className="flex items-baseline gap-2">
                   <p className="text-2xl font-bold text-slate-900">{quotesStats.total}</p>
                   {quotesStats.directOrdersCount > 0 && (
                     <span className="text-xs text-slate-500 font-medium">(+ {quotesStats.directOrdersCount} pedidos diretos)</span>
                   )}
                </div>
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
                <p className="text-2xl font-bold text-blue-600">{Number(stats.avgKm || 0).toFixed(1)}</p>
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
                <p className="text-2xl font-bold text-indigo-600">{Number(kmReport.totalKm || 0).toFixed(1)}</p>
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
                    <TableCell className="text-right font-medium">{Number(seller.km || 0).toFixed(1)} km</TableCell>
                    <TableCell className="text-right">{Number(seller.avgKmPerDay || 0).toFixed(1)} km</TableCell>
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