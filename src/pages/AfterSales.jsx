import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Wrench, ClipboardList, AlertCircle, Clock, 
  ArrowRight, Filter, Search, MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import moment from 'moment';

export default function AfterSales() {
  const { companyId } = useCompanyId();
  const [searchParams] = React.useMemo(() => [new URLSearchParams(window.location.search)], []);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: serviceRequests } = useQuery({
    queryKey: ['as-requests-clean', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ServiceRequest.filter({ company_id: companyId }, '-created_date');
    },
    enabled: !!companyId,
  });

  const { data: serviceOrders } = useQuery({
    queryKey: ['as-orders-clean', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ServiceOrder.filter({ company_id: companyId }, '-created_date');
    },
    enabled: !!companyId,
  });

  // Analysis for Management
  const criticalRequests = useMemo(() => {
    if (!serviceRequests) return [];
    return serviceRequests
      .filter(r => {
        const s = String(r.status || '').toUpperCase();
        return s === 'ABERTA' || s === 'EM_ANDAMENTO';
      })
      .sort((a, b) => moment(a.created_date).diff(moment(b.created_date)))
      .slice(0, 5);
  }, [serviceRequests]);

  const kpis = useMemo(() => {
    const total = serviceRequests?.length || 0;
    const pending = serviceRequests?.filter(r => String(r.status || '').toUpperCase() === 'ABERTA').length || 0;
    const inProgress = serviceRequests?.filter(r => String(r.status || '').toUpperCase() === 'EM_ANDAMENTO').length || 0;
    const completed = serviceRequests?.filter(r => String(r.status || '').toUpperCase() === 'ENCERRADA').length || 0;
    const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, pending, inProgress, completed, efficiency };
  }, [serviceRequests]);

  return (
    <div className="p-6 bg-white min-h-screen space-y-6">
      {/* Search & Filter Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Painel de Pós-Vendas</h1>
        <div className="flex gap-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                    className="pl-9 pr-4 py-2 border rounded-md text-sm w-64 outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Filtrar chamados..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-2" /> Filtros</Button>
        </div>
      </div>

      {/* KPI Row - Clean & Professional */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border shadow-none">
              <CardContent className="p-4">
                  <p className="text-sm font-medium text-slate-500">Total de Chamados</p>
                  <p className="text-2xl font-bold text-slate-900">{kpis.total}</p>
              </CardContent>
          </Card>
          <Card className="border shadow-none border-l-4 border-l-red-500">
              <CardContent className="p-4">
                  <p className="text-sm font-medium text-slate-500">Aguardando Início</p>
                  <p className="text-2xl font-bold text-red-600">{kpis.pending}</p>
              </CardContent>
          </Card>
          <Card className="border shadow-none border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                  <p className="text-sm font-medium text-slate-500">Em Atendimento</p>
                  <p className="text-2xl font-bold text-blue-600">{kpis.inProgress}</p>
              </CardContent>
          </Card>
          <Card className="border shadow-none">
              <CardContent className="p-4">
                  <p className="text-sm font-medium text-slate-500">Taxa de Conclusão</p>
                  <div className="flex items-center gap-3">
                      <p className="text-2xl font-bold text-emerald-600">{kpis.efficiency}%</p>
                      <Progress value={kpis.efficiency} className="h-2 w-20" />
                  </div>
              </CardContent>
          </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts / Critical Items Table */}
        <Card className="lg:col-span-2 shadow-none border">
          <CardHeader className="border-b bg-slate-50/50 py-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Chamados Prioritários / Antigos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                        <th className="px-4 py-2 border-b">Nº Solicitação</th>
                        <th className="px-4 py-2 border-b">OS Vinculada</th>
                        <th className="px-4 py-2 border-b">Cliente</th>
                        <th className="px-4 py-2 border-b">Data</th>
                        <th className="px-4 py-2 border-b">Status</th>
                        <th className="px-4 py-2 border-b text-right">Ação</th>
                    </tr>
                </thead>
                <tbody>
                    {criticalRequests.map((req, i) => {
                        const linkedOS = serviceOrders?.find(o => o.request_id === req.id || (o.request_number === req.request_number && req.request_number));
                        
                        return (
                            <tr key={i} className="hover:bg-slate-50 border-b last:border-0">
                                <td className="px-4 py-3 font-semibold text-blue-600">{req.request_number || `#${i+1}`}</td>
                                <td className="px-4 py-3">
                                    {linkedOS ? (
                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                            {linkedOS.os_number}
                                        </Badge>
                                    ) : (
                                        <span className="text-slate-400 italic text-[10px]">Pendente</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{req.client_name || 'Desconhecido'}</td>
                                <td className="px-4 py-3 text-slate-500">{moment(req.created_date).format('DD/MM/YYYY')}</td>
                                <td className="px-4 py-3">
                                    <Badge variant={String(req.status || '').toUpperCase() === 'ABERTA' ? 'destructive' : 'default'} className="text-[10px]">
                                        {req.status}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Link to={createPageUrl(`ServiceRequests?search=${req.request_number}`)}>
                                        <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-wider">
                                            Abrir
                                        </Button>
                                    </Link>
                                </td>
                            </tr>
                        );
                    })}
                    {criticalRequests.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">Nenhum chamado pendente</td>
                        </tr>
                    )}
                </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Quick Access List */}
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-2">Navegação Direta</h3>
            {[
                { title: 'Solicitações de Serviço', count: kpis.pending, icon: ClipboardList, page: 'ServiceRequests', color: 'border-red-200 bg-red-50 text-red-700' },
                { title: 'Ordens de Serviço', count: kpis.inProgress, icon: Wrench, page: 'ServiceOrders', color: 'border-blue-200 bg-blue-50 text-blue-700' },
                { title: 'Histórico e Relatórios', icon: MoreHorizontal, page: 'ServiceReports', color: 'border-slate-200 bg-slate-50 text-slate-700' },
            ].map((link, i) => (
                <Link key={i} to={createPageUrl(link.page)} className="block group">
                    <div className={`flex items-center justify-between p-4 border rounded-lg transition-all group-hover:shadow-md ${link.color}`}>
                        <div className="flex items-center gap-3">
                            <link.icon className="h-5 w-5 opacity-80" />
                            <span className="font-bold text-sm tracking-tight">{link.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {link.count > 0 && <Badge className="bg-white/50 text-current border-none">{link.count}</Badge>}
                            <ArrowRight className="h-4 w-4 opacity-40 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </Link>
            ))}
        </div>
      </div>
    </div>
  );
}