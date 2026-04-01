import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Factory, Clock, TrendingUp, AlertTriangle, Calendar, Filter, ArrowUpDown } from 'lucide-react';
import { format, differenceInDays, parseISO, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const STATUS_COLORS = {
  ABERTA: '#94a3b8',
  EM_ANDAMENTO: '#3b82f6',
  PAUSADA: '#f59e0b',
  ENCERRADA: '#10b981',
  CANCELADA: '#ef4444'
};

const PRIORITY_COLORS = {
  BAIXA: '#94a3b8',
  NORMAL: '#3b82f6',
  ALTA: '#f59e0b',
  URGENTE: '#ef4444'
};

export default function ProductionDashboard() {
  const { companyId } = useCompanyId();
  const navigate = useNavigate();
  
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all'); // all, week, month
  const [searchTerm, setSearchTerm] = useState('');

  const { data: ops = [] } = useQuery({
    queryKey: ['production-orders', companyId],
    queryFn: () => companyId ? base44.entities.ProductionOrder.filter({ company_id: companyId }, '-created_date') : [],
    enabled: !!companyId,
    refetchInterval: 60000, // Atualizar a cada 60 segundos
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.filter({ company_id: companyId, active: true }) : [],
    enabled: !!companyId,
    refetchInterval: 60000, // Atualizar a cada 60 segundos
  });

  const { data: steps = [] } = useQuery({
    queryKey: ['production-steps', companyId],
    queryFn: () => companyId ? base44.entities.ProductionStep.filter({ company_id: companyId }) : [],
    enabled: !!companyId,
    refetchInterval: 60000, // Atualizar a cada 60 segundos
  });

  // Filtros
  const filteredOps = useMemo(() => {
    let filtered = ops;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(op => op.status === statusFilter);
    }

    if (productFilter !== 'all') {
      filtered = filtered.filter(op => op.product_id === productFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(op => op.priority === priorityFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(op => 
        op.op_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.numero_op_externo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateRangeFilter === 'week') {
      const now = new Date();
      const weekStart = startOfWeek(now, { locale: ptBR });
      const weekEnd = endOfWeek(now, { locale: ptBR });
      filtered = filtered.filter(op => {
        if (!op.start_date) return false;
        const startDate = parseISO(op.start_date);
        return startDate >= weekStart && startDate <= weekEnd;
      });
    } else if (dateRangeFilter === 'month') {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      filtered = filtered.filter(op => {
        if (!op.start_date) return false;
        const startDate = parseISO(op.start_date);
        return startDate >= monthStart && startDate <= monthEnd;
      });
    }

    return filtered;
  }, [ops, statusFilter, productFilter, priorityFilter, dateRangeFilter, searchTerm]);

  // Métricas calculadas
  const metrics = useMemo(() => {
    const totalOps = filteredOps.length;
    const activeOps = filteredOps.filter(op => op.status === 'EM_ANDAMENTO').length;
    const completedOps = filteredOps.filter(op => op.status === 'ENCERRADA').length;
    const delayedOps = filteredOps.filter(op => {
      if (!op.due_date || op.status === 'ENCERRADA' || op.status === 'CANCELADA') return false;
      return new Date(op.due_date) < new Date();
    }).length;

    // Tempo médio de ciclo (em dias)
    const completedWithDates = filteredOps.filter(op => 
      op.status === 'ENCERRADA' && op.start_date && op.closed_at
    );
    const avgCycleTime = completedWithDates.length > 0
      ? completedWithDates.reduce((sum, op) => {
          const days = differenceInDays(parseISO(op.closed_at), parseISO(op.start_date));
          return sum + days;
        }, 0) / completedWithDates.length
      : 0;

    // Eficiência de produção
    const totalPlanned = filteredOps.reduce((sum, op) => sum + (op.qty_planned || 0), 0);
    const totalProduced = filteredOps.reduce((sum, op) => sum + (op.qty_produced || 0), 0);
    const efficiency = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0;

    return {
      totalOps,
      activeOps,
      completedOps,
      delayedOps,
      avgCycleTime: avgCycleTime.toFixed(1),
      efficiency: efficiency.toFixed(1)
    };
  }, [filteredOps]);

  // Dados para gráfico de status
  const statusData = useMemo(() => {
    const statuses = ['ABERTA', 'EM_ANDAMENTO', 'PAUSADA', 'ENCERRADA', 'CANCELADA'];
    return statuses.map(status => ({
      name: status,
      value: filteredOps.filter(op => op.status === status).length
    })).filter(d => d.value > 0);
  }, [filteredOps]);

  // Dados para gráfico de prioridade
  const priorityData = useMemo(() => {
    const priorities = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'];
    return priorities.map(priority => ({
      name: priority,
      value: filteredOps.filter(op => op.priority === priority).length
    })).filter(d => d.value > 0);
  }, [filteredOps]);

  // Dados para linha do tempo (próximas 4 semanas)
  const timelineData = useMemo(() => {
    const weeks = [];
    const now = new Date();
    
    for (let i = 0; i < 4; i++) {
      const weekStart = startOfWeek(addWeeks(now, i), { locale: ptBR });
      const weekEnd = endOfWeek(addWeeks(now, i), { locale: ptBR });
      
      const opsInWeek = filteredOps.filter(op => {
        if (!op.start_date) return false;
        const startDate = parseISO(op.start_date);
        return startDate >= weekStart && startDate <= weekEnd;
      });

      weeks.push({
        week: `Semana ${i + 1}`,
        total: opsInWeek.length,
        abertas: opsInWeek.filter(o => o.status === 'ABERTA').length,
        andamento: opsInWeek.filter(o => o.status === 'EM_ANDAMENTO').length,
        concluidas: opsInWeek.filter(o => o.status === 'ENCERRADA').length
      });
    }
    
    return weeks;
  }, [filteredOps]);

  // Gargalos - produtos com mais OPs ativas
  const bottlenecks = useMemo(() => {
    const productMap = {};
    
    filteredOps.filter(op => op.status === 'EM_ANDAMENTO' || op.status === 'ABERTA').forEach(op => {
      if (!productMap[op.product_id]) {
        productMap[op.product_id] = {
          product_name: op.product_name,
          count: 0,
          total_qty: 0
        };
      }
      productMap[op.product_id].count++;
      productMap[op.product_id].total_qty += op.qty_planned || 0;
    });

    return Object.values(productMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredOps]);

  // Timeline visual (Gantt simplificado)
  const ganttOps = useMemo(() => {
    return filteredOps
      .filter(op => op.start_date && op.due_date)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .slice(0, 10); // Mostrar apenas 10 para não poluir
  }, [filteredOps]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard de Produção</h1>
          <p className="text-slate-500 mt-1">Planejamento e acompanhamento de Ordens de Produção</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar</label>
              <Input
                placeholder="OP, produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ABERTA">Aberta</SelectItem>
                  <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                  <SelectItem value="PAUSADA">Pausada</SelectItem>
                  <SelectItem value="ENCERRADA">Encerrada</SelectItem>
                  <SelectItem value="CANCELADA">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Produto</label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Prioridade</label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="week">Esta Semana</SelectItem>
                  <SelectItem value="month">Este Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">OPs Ativas</p>
                <p className="text-3xl font-bold text-blue-600">{metrics.activeOps}</p>
                <p className="text-xs text-slate-500 mt-1">de {metrics.totalOps} totais</p>
              </div>
              <Factory className="h-12 w-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Tempo Médio</p>
                <p className="text-3xl font-bold text-purple-600">{metrics.avgCycleTime}</p>
                <p className="text-xs text-slate-500 mt-1">dias de ciclo</p>
              </div>
              <Clock className="h-12 w-12 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Eficiência</p>
                <p className="text-3xl font-bold text-green-600">{metrics.efficiency}%</p>
                <p className="text-xs text-slate-500 mt-1">produzido/planejado</p>
              </div>
              <TrendingUp className="h-12 w-12 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Em Atraso</p>
                <p className="text-3xl font-bold text-red-600">{metrics.delayedOps}</p>
                <p className="text-xs text-slate-500 mt-1">OPs atrasadas</p>
              </div>
              <AlertTriangle className="h-12 w-12 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6">
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Cronograma - Próximas 4 Semanas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="abertas" stroke="#94a3b8" name="Abertas" strokeWidth={2} />
              <Line type="monotone" dataKey="andamento" stroke="#3b82f6" name="Em Andamento" strokeWidth={2} />
              <Line type="monotone" dataKey="concluidas" stroke="#10b981" name="Concluídas" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gargalos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Gargalos de Produção - Top 5 Produtos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bottlenecks.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Nenhum gargalo identificado</p>
          ) : (
            <div className="space-y-3">
              {bottlenecks.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div>
                    <p className="font-semibold text-slate-900">{item.product_name}</p>
                    <p className="text-sm text-slate-600">{item.total_qty} unidades planejadas</p>
                  </div>
                  <Badge className="bg-amber-600">{item.count} OPs ativas</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gantt simplificado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Cronograma de OPs (Próximas 10)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ganttOps.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Nenhuma OP com datas definidas</p>
          ) : (
            <div className="space-y-2">
              {ganttOps.map((op) => {
                const start = new Date(op.start_date);
                const end = new Date(op.due_date);
                const duration = differenceInDays(end, start);
                const isLate = end < new Date() && op.status !== 'ENCERRADA' && op.status !== 'CANCELADA';
                
                return (
                  <div 
                    key={op.id} 
                    className="border rounded-lg p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(createPageUrl('ProductionOrderDetail') + `?id=${op.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">OP-{op.op_number}</span>
                        <Badge style={{ backgroundColor: STATUS_COLORS[op.status] }}>
                          {op.status}
                        </Badge>
                        {isLate && (
                          <Badge className="bg-red-600">ATRASADA</Badge>
                        )}
                      </div>
                      <span className="text-sm text-slate-600">{op.product_name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span>Início: {format(start, 'dd/MM/yyyy', { locale: ptBR })}</span>
                      <span>Fim: {format(end, 'dd/MM/yyyy', { locale: ptBR })}</span>
                      <span className="font-medium">{duration} dias</span>
                      <span>Prioridade: <Badge style={{ backgroundColor: PRIORITY_COLORS[op.priority] }}>{op.priority}</Badge></span>
                    </div>
                    <div className="mt-2">
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all" 
                          style={{ 
                            width: `${(op.qty_produced / op.qty_planned) * 100}%`,
                            backgroundColor: STATUS_COLORS[op.status]
                          }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {op.qty_produced} / {op.qty_planned} produzidos
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}