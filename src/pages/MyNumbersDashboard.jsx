import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { useAuth } from '@/lib/AuthContext';
import { TrendingUp, Target, DollarSign, PieChart as PieChartIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function MyNumbersDashboard() {
  const { companyId } = useCompanyId();
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedSeller, setSelectedSeller] = useState('me'); // 'me' defaults to current user if seller, else handled

  const { data: allSellers = [] } = useQuery({
    queryKey: ['authorized-sellers-goals', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const sellers = await base44.entities.Seller.filter({ company_id: companyId, active: true });
      const isAdmin = user?.role?.toLowerCase() === 'admin';
      if (isAdmin) return sellers;
      // If manager, return their managed sellers + their own seller profile if any
      const mySellerProfile = sellers.find(s => s.email?.toLowerCase() === user?.email?.toLowerCase());
      const managed = sellers.filter(s => Array.isArray(s.manager_ids) && s.manager_ids.includes(user?.id));
      
      const authorized = [...managed];
      if (mySellerProfile && !authorized.some(s => s.id === mySellerProfile.id)) {
        authorized.push(mySellerProfile);
      }
      return authorized;
    },
    enabled: !!companyId && !!user,
  });

  const activeSellerId = useMemo(() => {
    if (selectedSeller !== 'me') return selectedSeller;
    const myProfile = allSellers.find(s => s.email?.toLowerCase() === user?.email?.toLowerCase());
    return myProfile ? myProfile.id : (allSellers[0]?.id || null);
  }, [selectedSeller, allSellers, user]);

  const { data: performances = [] } = useQuery({
    queryKey: ['seller-performance', companyId, activeSellerId, selectedYear],
    queryFn: () => companyId && activeSellerId ? 
      base44.entities.SellerMonthlyPerformance.filter({ company_id: companyId, seller_id: activeSellerId, year: selectedYear }) : 
      Promise.resolve([]),
    enabled: !!companyId && !!activeSellerId,
  });

  const { data: pastPerformances = [] } = useQuery({
    queryKey: ['seller-performance-past', companyId, activeSellerId, String(Number(selectedYear) - 1)],
    queryFn: () => companyId && activeSellerId ? 
      base44.entities.SellerMonthlyPerformance.filter({ company_id: companyId, seller_id: activeSellerId, year: String(Number(selectedYear) - 1) }) : 
      Promise.resolve([]),
    enabled: !!companyId && !!activeSellerId,
  });

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const stats = useMemo(() => {
    const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Anual 
    let annualGoal = performances.length > 0 ? Number(performances[0].annual_goal || 0) : 0;
    let annualRevenue = 0;
    let annualCost = 0;

    // Mes Atual
    let currentMonthGoal = annualGoal / 12;
    let currentMonthRevenue = 0;
    let currentMonthCost = 0;
    
    let cumulativeRevenue = 0;

    const chartData = MONTHS.map((monthName, idx) => {
      const monthStr = String(idx + 1).padStart(2, '0');
      const data = performances.find(p => p.month === monthStr) || {};
      
      const rev = Number(data.actual_revenue) || 0;
      const cost = Number(data.monthly_cost) || 0;
      const goal = annualGoal / 12;

      annualRevenue += rev;
      annualCost += cost;
      cumulativeRevenue += rev;

      if (monthStr === currentMonthNum) {
        currentMonthRevenue = rev;
        currentMonthCost = cost;
      }

      return {
        name: monthName,
        Faturamento: rev,
        FaturamentoAcumulado: cumulativeRevenue,
        MetaAnual: annualGoal,
        Custo: cost
      };
    });

    // LTM (Last 12 Months)
    let ltmRevenue = 0;
    const currentM = new Date().getMonth() + 1;
    performances.forEach(p => {
       if (parseInt(p.month) <= currentM) ltmRevenue += (Number(p.actual_revenue) || 0);
    });
    pastPerformances.forEach(p => {
       if (parseInt(p.month) > currentM) ltmRevenue += (Number(p.actual_revenue) || 0);
    });

    const percentAchieved = annualGoal > 0 ? (annualRevenue / annualGoal) * 100 : 0;
    const currentMonthPercent = currentMonthGoal > 0 ? (currentMonthRevenue / currentMonthGoal) * 100 : 0;
    const costPercent = annualRevenue > 0 ? (annualCost / annualRevenue) * 100 : 0;

    return {
      annualGoal,
      annualRevenue,
      annualCost,
      currentMonthGoal,
      currentMonthRevenue,
      currentMonthCost,
      percentAchieved,
      currentMonthPercent,
      costPercent,
      chartData,
      ltmRevenue
    };
  }, [performances, pastPerformances]);

  const years = [2025, 2026, 2027, 2028, 2029];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-blue-900 to-indigo-800 p-6 rounded-2xl shadow-lg mb-6 text-white space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Meus Números</h1>
          <p className="text-blue-200 mt-1 font-medium text-sm">Dashboard consolidado de faturamento, metas e custos</p>
        </div>
        
        <div className="flex gap-4">
           {allSellers.length > 1 && (
              <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                <SelectTrigger className="w-[200px] bg-white/20 border-white/30 text-white placeholder:text-white/70">
                  <SelectValue placeholder="Meu Perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Meu Perfil</SelectItem>
                  {allSellers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
           )}

           <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px] bg-white/20 border-white/30 text-white">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
           </Select>
        </div>
      </div>

      {(!activeSellerId && allSellers.length === 0) ? (
         <div className="text-center py-10 text-slate-500">Nenhum perfil de vendedor associado a sua conta.</div>
      ) : (
        <>
          {/* Top KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Faturamento Mês Atual</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{formatCurrency(stats.currentMonthRevenue)}</p>
                    <p className="text-xs text-slate-400 mt-1">Meta: {formatCurrency(stats.currentMonthGoal)} ({stats.currentMonthPercent.toFixed(1)}%)</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg"><DollarSign className="h-6 w-6 text-blue-600" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Faturamento Anual Acumulado</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{formatCurrency(stats.annualRevenue)}</p>
                    <p className="text-xs text-slate-400 mt-1">Meta: {formatCurrency(stats.annualGoal)}</p>
                  </div>
                  <div className="p-3 bg-emerald-100 rounded-lg"><TrendingUp className="h-6 w-6 text-emerald-600" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Atingimento da Meta (Ano)</p>
                    <p className="text-3xl font-bold text-indigo-600 mt-1">{stats.percentAchieved.toFixed(1)}%</p>
                    <p className="text-xs text-slate-400 mt-1">Acumulado referente à Meta Anual</p>
                  </div>
                  <div className="p-3 bg-indigo-100 rounded-lg"><Target className="h-6 w-6 text-indigo-600" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Custo x Faturamento (%)</p>
                    <p className="text-3xl font-bold text-amber-600 mt-1">{stats.costPercent.toFixed(1)}%</p>
                    <p className="text-xs text-slate-400 mt-1">Custo Total: {formatCurrency(stats.annualCost)}</p>
                  </div>
                  <div className="p-3 bg-amber-100 rounded-lg"><PieChartIcon className="h-6 w-6 text-amber-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
             <Card className="lg:col-span-1 border-none bg-slate-50">
               <CardContent className="pt-6 flex flex-col justify-center items-center h-full text-center">
                 <h3 className="text-lg font-medium text-slate-500 mb-2">Faturamento (LTM)<br/>Últimos 12 Meses</h3>
                 <p className="text-5xl font-extrabold text-blue-900">{formatCurrency(stats.ltmRevenue)}</p>
               </CardContent>
             </Card>

             <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Evolução Faturamento x Meta (Mês a Mês)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(val) => `R$ ${val/1000}k`} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Line name="YTD Acumulado" type="monotone" dataKey="FaturamentoAcumulado" stroke="#2563EB" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                    <Line name="Meta Anual" type="monotone" dataKey="MetaAnual" stroke="#10B981" strokeWidth={3} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Custo vs Faturamento (Análise Mensal)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(val) => `R$ ${val/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="Faturamento" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Custo" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
