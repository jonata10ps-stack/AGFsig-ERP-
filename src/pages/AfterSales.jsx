import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Wrench, ClipboardList, AlertCircle, Clock, 
  ArrowRight, Filter, Search, MoreHorizontal, Activity
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
  const [typeFilter, setTypeFilter] = useState('all');

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
        {/* Integrated Operations Table */}
        <Card className="lg:col-span-2 shadow-none border">
          <CardHeader className="border-b bg-slate-50/50 py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-500" />
                Operações Técnicas
            </CardTitle>
            <div className="flex flex-col gap-2">
                <div className="flex bg-slate-100 p-1 rounded-lg self-end">
                    <Button 
                        variant={typeFilter === 'all' ? 'secondary' : 'ghost'} 
                        size="sm" className="h-7 text-[10px] px-2"
                        onClick={() => setTypeFilter('all')}
                    >Todas</Button>
                    <Button 
                        variant={typeFilter === 'SR' ? 'secondary' : 'ghost'} 
                        size="sm" className="h-7 text-[10px] px-2"
                        onClick={() => setTypeFilter('SR')}
                    >Solicitações</Button>
                    <Button 
                        variant={typeFilter === 'OS' ? 'secondary' : 'ghost'} 
                        size="sm" className="h-7 text-[10px] px-2"
                        onClick={() => setTypeFilter('OS')}
                    >Ordens (OS)</Button>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg self-end scale-90 origin-right">
                    <Button 
                        variant={statusFilter === 'all' ? 'secondary' : 'ghost'} 
                        size="sm" className="h-7 text-[10px] px-2"
                        onClick={() => setStatusFilter('all')}
                    >Todos Status</Button>
                    <Button 
                        variant={statusFilter === 'active' ? 'secondary' : 'ghost'} 
                        size="sm" className="h-7 text-[10px] px-2 text-red-600"
                        onClick={() => setStatusFilter('active')}
                    >Abertas/Pendentes</Button>
                    <Button 
                        variant={statusFilter === 'progress' ? 'secondary' : 'ghost'} 
                        size="sm" className="h-7 text-[10px] px-2 text-blue-600"
                        onClick={() => setStatusFilter('progress')}
                    >Em Andamento</Button>
                    <Button 
                        variant={statusFilter === 'done' ? 'secondary' : 'ghost'} 
                        size="sm" className="h-7 text-[10px] px-2 text-emerald-600"
                        onClick={() => setStatusFilter('done')}
                    >Encerradas</Button>
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-4 py-2 border-b">Tipo</th>
                            <th className="px-4 py-2 border-b">Documento</th>
                            <th className="px-4 py-2 border-b">Cliente</th>
                            <th className="px-4 py-2 border-b">Técnico/Responsável</th>
                            <th className="px-4 py-2 border-b">Status</th>
                            <th className="px-4 py-2 border-b text-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {useMemo(() => {
                            const combined = [
                                ...(serviceRequests?.map(r => ({ ...r, _type: 'SR' })) || []),
                                ...(serviceOrders?.map(o => ({ ...o, _type: 'OS' })) || [])
                            ].filter(item => {
                                // Filter by Type
                                if (typeFilter !== 'all' && item._type !== typeFilter) return false;
                                
                                // Filter by Status logic
                                const s = String(item.status || '').toUpperCase();
                                if (statusFilter === 'active') {
                                    return s === 'ABERTA' || s === 'PENDENTE';
                                }
                                if (statusFilter === 'progress') {
                                    return s === 'EM_ANDAMENTO' || s === 'EM_ATENDIMENTO';
                                }
                                if (statusFilter === 'done') {
                                    return s === 'ENCERRADA' || s === 'CONCLUIDA' || s === 'FINALIZADA';
                                }
                                return true;
                            }).sort((a, b) => moment(b.created_date).diff(moment(a.created_date)))
                            .slice(0, 15);

                            return combined.map((item, i) => (
                                <tr key={i} className="hover:bg-slate-50 border-b last:border-0">
                                    <td className="px-4 py-3">
                                        <Badge variant="outline" className={item._type === 'SR' ? 'border-blue-200 text-blue-700 bg-blue-50' : 'border-indigo-200 text-indigo-700 bg-indigo-50'}>
                                            {item._type}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-slate-700">
                                        {item._type === 'SR' ? item.request_number : item.os_number}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 truncate max-w-[180px]">
                                        {item.client_name || 'Desconhecido'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {item._type === 'OS' ? (item.technician_name || 'Pendente') : '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant={String(item.status || '').toUpperCase() === 'ABERTA' || String(item.status || '').toUpperCase() === 'PENDENTE' ? 'destructive' : 'default'} className="text-[10px]">
                                            {item.status}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {item._type === 'SR' ? (
                                            <Link to={createPageUrl(`ServiceRequests?search=${item.request_number}`)}>
                                                <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase">Abrir</Button>
                                            </Link>
                                        ) : (
                                            <Link to={createPageUrl(`ServiceOrders?search=${item.os_number}`)}>
                                                <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase">Abrir</Button>
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            ));
                        }, [serviceRequests, serviceOrders, typeFilter])}
                    </tbody>
                </table>
            </div>
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