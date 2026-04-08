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
import moment from 'moment';

export default function AfterSales() {
  const { companyId } = useCompanyId();
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: serviceRequests = [] } = useQuery({
    queryKey: ['as-requests-v5', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        const ent = base44.entities.ServiceRequest || base44.entities.service_request;
        return await ent.filter({ company_id: companyId }, '-created_date');
      } catch (e) {
        return [];
      }
    },
    enabled: !!companyId,
  });

  const { data: serviceOrders = [] } = useQuery({
    queryKey: ['as-orders-v5', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        const ent = base44.entities.ServiceOrder || base44.entities.service_order;
        return await ent.filter({ company_id: companyId }, '-created_date');
      } catch (e) {
        return [];
      }
    },
    enabled: !!companyId,
  });

  const kpis = useMemo(() => {
    const sReqs = Array.isArray(serviceRequests) ? serviceRequests : [];
    const total = sReqs.length;
    const pending = sReqs.filter(r => String(r?.status || '').toUpperCase() === 'ABERTA').length;
    const inProgress = sReqs.filter(r => String(r?.status || '').toUpperCase() === 'EM_ANDAMENTO').length;
    const completed = sReqs.filter(r => String(r?.status || '').toUpperCase() === 'ENCERRADA').length;
    const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, pending, inProgress, completed, efficiency };
  }, [serviceRequests]);

  const technicalOperations = useMemo(() => {
    const sReqs = Array.isArray(serviceRequests) ? serviceRequests : [];
    const sOrds = Array.isArray(serviceOrders) ? serviceOrders : [];
    
    return [
        ...sReqs.map(r => ({ ...r, _type: 'SR' })),
        ...sOrds.map(o => ({ ...o, _type: 'OS' }))
    ].filter(item => {
        if (typeFilter !== 'all' && item._type !== typeFilter) return false;
        const s = String(item?.status || '').toUpperCase();
        if (statusFilter === 'active') return s === 'ABERTA' || s === 'PENDENTE';
        if (statusFilter === 'progress') return s === 'EM_ANDAMENTO' || s === 'EM_ATENDIMENTO';
        if (statusFilter === 'done') return s === 'ENCERRADA' || s === 'CONCLUIDA' || s === 'FINALIZADA';
        return true;
    }).sort((a, b) => {
        const dateA = a.created_date || a.created_at || a.date_from;
        const dateB = b.created_date || b.created_at || b.date_from;
        return moment(dateB).diff(moment(dateA));
    }).slice(0, 15);
  }, [serviceRequests, serviceOrders, typeFilter, statusFilter]);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-[1800px] mx-auto p-4 lg:p-6 lg:pl-10 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Pós-Vendas</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle Operacional Centralizado</p>
          </div>
          <div className="w-full md:w-auto">
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                      className="pl-9 pr-4 py-2 border-2 border-slate-100 rounded-xl text-xs w-full md:w-64 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Pesquisar..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                  />
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border shadow-sm rounded-2xl bg-white">
                <CardContent className="p-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Total</p>
                    <p className="text-2xl font-black text-slate-900">{kpis.total}</p>
                </CardContent>
            </Card>
            <Card className="border border-red-100 bg-red-50/5 shadow-sm rounded-2xl">
                <CardContent className="p-4 border-l-4 border-l-red-500">
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-wider mb-1">Pendentes</p>
                    <p className="text-2xl font-black text-red-600">{kpis.pending}</p>
                </CardContent>
            </Card>
            <Card className="border border-blue-100 bg-blue-50/5 shadow-sm rounded-2xl">
                <CardContent className="p-4 border-l-4 border-l-blue-500">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-wider mb-1">Andamento</p>
                    <p className="text-2xl font-black text-blue-600">{kpis.inProgress}</p>
                </CardContent>
            </Card>
            <Card className="border border-emerald-100 bg-emerald-50/5 shadow-sm rounded-2xl">
                <CardContent className="p-4 border-l-4 border-l-emerald-500">
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mb-1">Eficiência</p>
                    <p className="text-2xl font-black text-emerald-600">{kpis.efficiency}%</p>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Siderbar-like Links on the LEFT (1/4 space) */}
          <div className="space-y-3 xl:col-span-1">
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-2">Ações Rápidas</h3>
              <div className="flex flex-col gap-2">
                {[
                    { title: 'Solicitações', icon: ClipboardList, page: 'ServiceRequests', color: 'border-blue-100 bg-white hover:border-blue-500', iconColor: 'text-blue-500' },
                    { title: 'Ordens Técnicas', icon: Wrench, page: 'ServiceOrders', color: 'border-indigo-100 bg-white hover:border-indigo-500', iconColor: 'text-indigo-500' },
                    { title: 'Relatórios', icon: Clock, page: 'ServiceReports', color: 'border-slate-100 bg-white hover:border-slate-500', iconColor: 'text-slate-500' },
                ].map((link, i) => (
                    <Link key={i} to={createPageUrl(link.page)} className="block group">
                        <div className={`flex items-center justify-between p-3 border-2 rounded-xl transition-all group-hover:shadow-md ${link.color}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg bg-slate-50 ${link.iconColor}`}>
                                  <link.icon className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-xs text-slate-700 tracking-tight">{link.title}</span>
                            </div>
                            <ArrowRight className="h-3 w-3 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                        </div>
                    </Link>
                ))}
              </div>
          </div>

          {/* Main Table on the RIGHT (3/4 space) */}
          <Card className="xl:col-span-3 shadow-sm border-2 border-slate-100 rounded-3xl overflow-hidden bg-white">
            <CardHeader className="border-b border-slate-50 bg-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.1em] flex items-center gap-2 text-slate-400">
                  <ClipboardList className="h-4 w-4 text-slate-600" />
                  Painel Operacional
              </CardTitle>
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <div className="flex bg-slate-50 p-1 rounded-xl shadow-inner gap-1 border border-slate-100 overflow-x-auto no-scrollbar">
                      {['all', 'SR', 'OS'].map(t => (
                          <Button 
                              key={t}
                              variant={typeFilter === t ? 'default' : 'ghost'} 
                              size="sm" 
                              className={`h-7 text-[10px] px-3 font-black rounded-lg transition-all ${
                                typeFilter === t ? 'bg-white text-slate-900 shadow-sm border hover:bg-white' : 'text-slate-400 hover:text-slate-600'
                              }`}
                              onClick={() => setTypeFilter(t)}
                          >{t === 'all' ? 'Tudo' : t === 'SR' ? 'Solicitações' : 'Ordens (OS)'}</Button>
                      ))}
                  </div>
                  <div className="flex bg-slate-50 p-1 rounded-xl shadow-inner gap-1 border border-slate-100 overflow-x-auto no-scrollbar">
                      <Button 
                          variant={statusFilter === 'all' ? 'default' : 'ghost'} 
                          size="sm" className={`h-7 text-[9px] px-2 font-black rounded-lg ${statusFilter === 'all' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400'}`}
                          onClick={() => setStatusFilter('all')}
                      >TODOS</Button>
                      <Button 
                          variant={statusFilter === 'active' ? 'default' : 'ghost'} 
                          size="sm" className={`h-7 text-[9px] px-2 font-black rounded-lg border ${statusFilter === 'active' ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'text-red-500 border-transparent hover:bg-red-50'}`}
                          onClick={() => setStatusFilter('active')}
                      >PENDENTES</Button>
                      <Button 
                          variant={statusFilter === 'progress' ? 'default' : 'ghost'} 
                          size="sm" className={`h-7 text-[9px] px-2 font-black rounded-lg border ${statusFilter === 'progress' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'text-blue-500 border-transparent hover:bg-blue-50'}`}
                          onClick={() => setStatusFilter('progress')}
                      >ANDAMENTO</Button>
                      <Button 
                          variant={statusFilter === 'done' ? 'default' : 'ghost'} 
                          size="sm" className={`h-7 text-[9px] px-2 font-black rounded-lg border ${statusFilter === 'done' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'text-emerald-500 border-transparent hover:bg-emerald-50'}`}
                          onClick={() => setStatusFilter('done')}
                      >ENCERRADAS</Button>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[9px] tracking-wider">
                          <tr>
                              <th className="px-4 py-3 border-b">Doc</th>
                              <th className="px-4 py-3 border-b w-[35%]">Cliente</th>
                              <th className="px-4 py-3 border-b">Técnico/Responsável</th>
                              <th className="px-4 py-3 border-b text-center">Status</th>
                              <th className="px-4 py-3 border-b text-right">Ação</th>
                          </tr>
                      </thead>
                      <tbody>
                          {technicalOperations.map((item, i) => (
                              <tr key={item.id || i} className="hover:bg-slate-50/60 border-b last:border-0 transition-all group">
                                  <td className="px-4 py-3">
                                      <div className="flex flex-col gap-0.5">
                                          <Badge variant="outline" className={`text-[8px] h-4 font-black w-fit px-1 ${item._type === 'SR' ? 'border-blue-200 text-blue-700 bg-blue-50' : 'border-indigo-200 text-indigo-700 bg-indigo-50'}`}>
                                              {item._type}
                                          </Badge>
                                          <span className="font-black text-slate-800">
                                              {item._type === 'SR' ? item.request_number : item.os_number}
                                          </span>
                                      </div>
                                  </td>
                                  <td className="px-4 py-3 text-slate-700 font-bold uppercase truncate">
                                      {item.client_name || '-'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 font-semibold italic text-[10px]">
                                      {item._type === 'OS' ? (item.technician_name || 'Agendamento') : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                      <Badge 
                                        variant={['ABERTA', 'PENDENTE'].includes(String(item.status || '').toUpperCase()) ? 'destructive' : 'default'} 
                                        className={`text-[8px] font-black px-2 py-0.5 rounded shadow-sm ${
                                            String(item.status || '').toUpperCase() === 'EM_ANDAMENTO' ? 'bg-blue-600' : 
                                            ['ENCERRADA', 'CONCLUIDA', 'FINALIZADA'].includes(String(item.status || '').toUpperCase()) ? 'bg-emerald-600' : 'bg-slate-400'
                                        }`}
                                      >
                                          {(item.status || 'Pendente').toUpperCase()}
                                      </Badge>
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                      <Link to={createPageUrl(item._type === 'SR' ? `ServiceRequests?search=${item.request_number}` : `ServiceOrderDetail?id=${item.id}`)}>
                                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-slate-900 hover:text-white transition-all">
                                            <ArrowRight className="h-4 w-4" />
                                          </Button>
                                      </Link>
                                  </td>
                              </tr>
                          ))}
                          {technicalOperations.length === 0 && (
                              <tr>
                                  <td colSpan={5} className="p-12 text-center text-slate-200">
                                      <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-5" />
                                      <p className="text-xs font-black opacity-10 uppercase">Sem movimentação</p>
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}