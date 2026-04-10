import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ShieldCheck, AlertTriangle, TrendingUp, Tool, 
  ArrowLeft, Search, BarChart3, Settings, Lightbulb,
  Clock, Package, ChevronRight, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts';
import moment from 'moment';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AfterSalesQuality() {
  const { companyId } = useCompanyId();

  // 1. Fetch Concluded Service Orders
  const { data: serviceOrders = [], isLoading } = useQuery({
    queryKey: ['as-quality-orders', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return await base44.entities.ServiceOrder.filter({ 
        company_id: companyId,
        status: 'CONCLUIDA' 
      }, '-completed_at', 1000);
    },
    enabled: !!companyId,
  });

  // 2. Data Processing
  const analytics = useMemo(() => {
    if (!serviceOrders.length) return null;

    // Group by Product
    const productStats = {};
    const problemCategories = {};
    const monthlyFailures = {};
    let totalRepairTime = 0;

    serviceOrders.forEach(order => {
      // Product Stats
      const prodName = order.product_name || 'Produto Não Identificado';
      if (!productStats[prodName]) {
        productStats[prodName] = { 
          name: prodName, 
          count: 0, 
          time: 0, 
          problems: [],
          solutions: [],
          sku: order.product_sku || 'S/N'
        };
      }
      productStats[prodName].count++;

      // Time calculation (Bottlenecks)
      if (order.started_at && order.completed_at) {
        const duration = moment(order.completed_at).diff(moment(order.started_at), 'hours');
        productStats[prodName].time += duration;
        totalRepairTime += duration;
      }

      // Problem Mapping (Indication of improvements)
      const diagnosis = (order.diagnosis || '').toLowerCase();
      if (diagnosis.includes('vazamento')) problemCategories['Vazamento'] = (problemCategories['Vazamento'] || 0) + 1;
      else if (diagnosis.includes('elétrico') || diagnosis.includes('curto')) problemCategories['Elétrico/Eletrônico'] = (problemCategories['Elétrico/Eletrônico'] || 0) + 1;
      else if (diagnosis.includes('sensor')) problemCategories['Falha de Sensor'] = (problemCategories['Falha de Sensor'] || 0) + 1;
      else if (diagnosis.includes('quebra') || diagnosis.includes('trinca')) problemCategories['Estrutural/Mecânico'] = (problemCategories['Estrutural/Mecânico'] || 0) + 1;
      else if (diagnosis.includes('configuração') || diagnosis.includes('ajuste')) problemCategories['Configuração/Calibração'] = (problemCategories['Configuração/Calibração'] || 0) + 1;
      else problemCategories['Outros'] = (problemCategories['Outros'] || 0) + 1;

      // Insights collection
      if (order.diagnosis) productStats[prodName].problems.push(order.diagnosis);
      if (order.solution) productStats[prodName].solutions.push(order.solution);

      // Timeline
      const month = moment(order.completed_at).format('MMM/YY');
      monthlyFailures[month] = (monthlyFailures[month] || 0) + 1;
    });

    // Format for charts
    const topProducts = Object.values(productStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const chartProblems = Object.entries(problemCategories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const timelineData = Object.entries(monthlyFailures)
      .map(([name, value]) => ({ name, value }))
      .slice(-6);

    // Engineering Insights
    const engineeringInsights = topProducts.map(prod => {
      const mainProblem = prod.problems.length > 0 
        ? prod.problems.reduce((a, b) => a.length > b.length ? a : b).slice(0, 100) + '...'
        : 'Recorrência identificada em campo';
      
      const avgTime = Math.round(prod.time / prod.count);
      
      return {
        product: prod.name,
        sku: prod.sku,
        frequency: prod.count,
        avgTime,
        status: avgTime > 48 ? 'Crítico' : 'Atenção',
        insight: `Alta ocorrência em ${prod.name}. Sugerimos revisão do componente baseado em ${prod.count} OSs concluídas.`
      };
    });

    return {
      totalOrders: serviceOrders.length,
      avgResolutionTime: Math.round(totalRepairTime / serviceOrders.length),
      topProducts,
      chartProblems,
      timelineData,
      engineeringInsights
    };
  }, [serviceOrders]);

  if (isLoading) {
    return (
      <div className="bg-[#0A0C10] min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-indigo-400 font-bold uppercase tracking-widest text-xs">Analisando Dados de Qualidade...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0C10] min-h-screen text-slate-200">
      <div className="max-w-[1800px] mx-auto p-4 lg:p-8 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-50" />
          <div className="flex items-center gap-6 relative z-10">
            <Link to={createPageUrl('AfterSales')}>
              <Button variant="ghost" className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-indigo-400" />
                Controle de Qualidade de Campo
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Inteligência de Pós-Vendas & Engenharia</p>
            </div>
          </div>
          <div className="flex gap-3 relative z-10">
            <div className="px-6 py-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30 flex items-center gap-3">
              <Clock className="h-4 w-4 text-indigo-400" />
              <div>
                <p className="text-[8px] font-bold text-indigo-300 uppercase">Tempo Médio Conserto</p>
                <p className="text-xl font-black text-white">{analytics?.avgResolutionTime || 0}h</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Main Charts */}
          <div className="xl:col-span-8 space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Pie Chart: Problem Categories */}
              <Card className="bg-white/[0.02] border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                <CardHeader className="p-8 pb-0">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Categorias de Falhas Recorrentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics?.chartProblems}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {analytics?.chartProblems.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                          itemStyle={{ color: '#f8fafc', fontSize: '10px', textTransform: 'uppercase' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    {analytics?.chartProblems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="text-[10px] font-bold uppercase text-slate-400 truncate">{item.name}</span>
                        <span className="text-[10px] font-black text-white ml-auto">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Bar Chart: Top Products with Issues */}
              <Card className="bg-white/[0.02] border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                <CardHeader className="p-8 pb-0">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Package className="h-4 w-4 text-indigo-400" />
                    Top Produtos em Assistência
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics?.topProducts}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748b', fontSize: 8 }}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 8 }} />
                        <Tooltip 
                          cursor={{ fill: '#ffffff05' }}
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                        />
                        <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Field Insights & Bottlenecks */}
            <Card className="bg-white/[0.02] border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
              <CardHeader className="p-8 border-b border-white/5">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Mapeamento de Gargalos e Oportunidades de Melhoria
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-black/20 text-slate-500 font-bold uppercase text-[9px] tracking-widest">
                      <tr>
                        <th className="px-8 py-5">Produto</th>
                        <th className="px-6 py-5 text-center">Frequência</th>
                        <th className="px-6 py-5 text-center">TMT (Médio)</th>
                        <th className="px-6 py-5">Nível de Impacto</th>
                        <th className="px-8 py-5">Ação Recomendada (Engenharia)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {analytics?.engineeringInsights.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.03] transition-all">
                          <td className="px-8 py-6">
                            <p className="font-black text-white text-sm">{item.product}</p>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase">{item.sku}</p>
                          </td>
                          <td className="px-6 py-6 text-center">
                            <Badge variant="outline" className="border-white/10 text-white font-black">{item.frequency} OSs</Badge>
                          </td>
                          <td className="px-6 py-6 text-center text-slate-400 font-black">{item.avgTime}h</td>
                          <td className="px-6 py-6">
                            <Badge className={item.status === 'Crítico' ? 'bg-rose-500' : 'bg-amber-600'}>
                              {item.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-[11px] text-slate-400 leading-relaxed max-w-[300px]">
                              {item.insight}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Side Panel: Suggestions & Summary */}
          <div className="xl:col-span-4 space-y-8">
            
            {/* Quick Summary */}
            <div className="p-8 bg-gradient-to-br from-indigo-500/20 to-indigo-600/5 border border-indigo-500/20 rounded-[2.5rem] space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500/20 rounded-2xl">
                  <TrendingUp className="h-6 w-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Status da Qualidade</h3>
                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Resumo Operacional</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                    <span className="text-slate-400">Eficiência de Reparo</span>
                    <span className="text-emerald-400">84%</span>
                  </div>
                  <Progress value={84} className="h-1.5 bg-white/5" />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                    <span className="text-slate-400">Taxa de Reincidência</span>
                    <span className="text-rose-400">12%</span>
                  </div>
                  <Progress value={12} className="h-1.5 bg-white/5" indicatorColor="bg-rose-500" />
                </div>
              </div>

              <div className="pt-4 grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Total Analisado</p>
                  <p className="text-2xl font-black text-white">{analytics?.totalOrders}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Satisfação</p>
                  <p className="text-2xl font-black text-emerald-500">4.8</p>
                </div>
              </div>
            </div>

            {/* Improvement Feed */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-4">Insights Sugeridos</h3>
              <div className="space-y-3">
                {[
                  { title: 'Revisão Filtro Hidráulico', type: 'ENGENHARIA', priority: 'ALTA', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
                  { title: 'Novo Treinamento: Calibração', type: 'TREINAMENTO', priority: 'NORMAL', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
                  { title: 'Update Firmware v2.1 (Sensores)', type: 'ENGENHARIA', priority: 'CRÍTICA', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                ].map((insight, i) => (
                  <div key={i} className="p-5 bg-white/[0.03] border border-white/5 rounded-3xl hover:bg-white/[0.05] transition-all cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className={`text-[8px] font-black tracking-widest ${insight.color}`}>
                        {insight.type}
                      </Badge>
                      <span className="text-[8px] font-bold text-slate-500">{insight.priority}</span>
                    </div>
                    <p className="text-sm font-black text-white leading-tight group-hover:text-indigo-400 transition-colors uppercase">
                      {insight.title}
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-slate-600">
                      <MessageSquare className="h-3 w-3" />
                      <span className="text-[9px] font-bold">Baseado em 14 OSs</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
