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
    queryKey: ['as-requests-v4', companyId],
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
    queryKey: ['as-orders-v4', companyId],
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
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-10 lg:pl-12 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Painel de Pós-Vendas</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão Técnica e Operacional</p>
          </div>
          <div className="w-full md:w-auto">
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                      className="pl-9 pr-4 py-2.5 border-2 border-slate-100 rounded-2xl text-sm w-full md:w-80 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-inner"
                      placeholder="Pesquisar registros..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                  />
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-2 border-slate-100 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all">
                <CardContent className="p-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total de Chamados</p>
                    <p className="text-4xl font-black text-slate-900">{kpis.total}</p>
                </CardContent>
            </Card>
            <Card className="border-2 border-red-100 bg-red-50/10 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all">
                <CardContent className="p-6 border-l-8 border-l-red-500">
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-2">Aguardando Início</p>
                    <p className="text-4xl font-black text-red-600">{kpis.pending}</p>
                </CardContent>
            </Card>
            <Card className="border-2 border-blue-100 bg-blue-50/10 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all">
                <CardContent className="p-6 border-l-8 border-l-blue-500">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2">Em Atendimento</p>
                    <p className="text-4xl font-black text-blue-600">{kpis.inProgress}</p>
                </CardContent>
            </Card>
            <Card className="border-2 border-emerald-100 bg-emerald-50/10 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all">
                <CardContent className="p-6 border-l-8 border-l-emerald-500">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2">Taxa de Eficiência</p>
                    <p className="text-4xl font-black text-emerald-600">{kpis.efficiency}%</p>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <Card className="xl:col-span-2 shadow-sm border-2 border-slate-100 rounded-[32px] overflow-hidden bg-white">
            <CardHeader className="border-b-2 border-slate-50 bg-white p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 text-slate-400">
                  <div className="p-2.5 bg-slate-100 rounded-xl">
                    <ClipboardList className="h-5 w-5 text-slate-700" />
                  </div>
                  Painel Operacional
              </CardTitle>
              <div className="flex flex-col gap-3 w-full sm:w-auto">
                  <div className="flex bg-slate-50 p-1.5 rounded-2xl shadow-inner gap-1 border border-slate-100 overflow-x-auto no-scrollbar">
                      {['all', 'SR', 'OS'].map(t => (
                          <Button 
                              key={t}
                              variant={typeFilter === t ? 'default' : 'ghost'} 
                              size="sm" 
                              className={`h-9 text-[11px] px-5 font-black rounded-xl transition-all whitespace-nowrap ${
                                typeFilter === t 
                                ? 'bg-white text-slate-900 shadow-md border-2 border-slate-100 hover:bg-white' 
                                : 'text-slate-400 hover:text-slate-600'
                              }`}
                              onClick={() => setTypeFilter(t)}
                          >{t === 'all' ? 'Tudo' : t === 'SR' ? 'Solicitações' : 'Ordens (OS)'}</Button>
                      ))}
                  </div>
                  <div className="flex bg-slate-50 p-1.5 rounded-2xl shadow-inner gap-1 border border-slate-100 overflow-x-auto no-scrollbar">
                      <Button 
                          variant={statusFilter === 'all' ? 'default' : 'ghost'} 
                          size="sm" className={`h-8 text-[10px] px-3 font-black rounded-xl ${statusFilter === 'all' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-200'}`}
                          onClick={() => setStatusFilter('all')}
                      >TOTAL</Button>
                      <Button 
                          variant={statusFilter === 'active' ? 'default' : 'ghost'} 
                          size="sm" className={`h-8 text-[10px] px-3 font-black rounded-xl border-2 transition-all ${statusFilter === 'active' ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-200' : 'text-red-500 border-transparent hover:bg-red-50'}`}
                          onClick={() => setStatusFilter('active')}
                      >PENDENTES</Button>
                      <Button 
                          variant={statusFilter === 'progress' ? 'default' : 'ghost'} 
                          size="sm" className={`h-8 text-[10px] px-3 font-black rounded-xl border-2 transition-all ${statusFilter === 'progress' ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200' : 'text-blue-500 border-transparent hover:bg-blue-50'}`}
                          onClick={() => setStatusFilter('progress')}
                      >ANDAMENTO</Button>
                      <Button 
                          variant={statusFilter === 'done' ? 'default' : 'ghost'} 
                          size="sm" className={`h-8 text-[10px] px-3 font-black rounded-xl border-2 transition-all ${statusFilter === 'done' ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200' : 'text-emerald-500 border-transparent hover:bg-emerald-50'}`}
                          onClick={() => setStatusFilter('done')}
                      >ENCERRADAS</Button>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50/80 text-slate-400 font-black uppercase text-[10px] tracking-[0.15em]">
                          <tr>
                              <th className="px-5 py-4 border-b">Tipo</th>
                              <th className="px-5 py-4 border-b">Documento</th>
                              <th className="px-5 py-4 border-b">Cliente</th>
                              <th className="px-5 py-4 border-b">Técnico</th>
                              <th className="px-5 py-4 border-b">Status</th>
                              <th className="px-5 py-4 border-b text-right">Ver</th>
                          </tr>
                      </thead>
                      <tbody>
                          {technicalOperations.map((item, i) => (
                              <tr key={item.id || i} className="hover:bg-slate-50/60 border-b last:border-0 transition-all group">
                                  <td className="px-5 py-4">
                                      <Badge variant="outline" className={`font-black border-2 px-2.5 py-0.5 rounded-lg ${item._type === 'SR' ? 'border-blue-200 text-blue-700 bg-blue-50' : 'border-indigo-200 text-indigo-700 bg-indigo-50'}`}>
                                          {item._type}
                                      </Badge>
                                  </td>
                                  <td className="px-5 py-4 font-black text-slate-800">
                                      {item._type === 'SR' ? item.request_number : item.os_number}
                                  </td>
                                  <td className="px-5 py-4 text-slate-600 font-bold max-w-[140px] truncate">
                                      {item.client_name || '-'}
                                  </td>
                                  <td className="px-5 py-4 text-slate-400 text-xs font-bold italic truncate max-w-[120px]">
                                      {item._type === 'OS' ? (item.technician_name || 'Agendamento') : '-'}
                                  </td>
                                  <td className="px-5 py-4">
                                      <Badge 
                                        variant={['ABERTA', 'PENDENTE'].includes(String(item.status || '').toUpperCase()) ? 'destructive' : 'default'} 
                                        className={`text-[9px] font-black px-3 py-1 rounded-lg ${
                                            String(item.status || '').toUpperCase() === 'EM_ANDAMENTO' ? 'bg-blue-600' : 
                                            ['ENCERRADA', 'CONCLUIDA'].includes(String(item.status || '').toUpperCase()) ? 'bg-emerald-600' : ''
                                        }`}
                                      >
                                          {(item.status || 'Pendente').toUpperCase()}
                                      </Badge>
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                      <Link to={createPageUrl(item._type === 'SR' ? `ServiceRequests?search=${item.request_number}` : `ServiceOrders?search=${item.os_number}`)}>
                                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-slate-900 hover:text-white transition-all">
                                            <ArrowRight className="h-4 w-4" />
                                          </Button>
                                      </Link>
                                  </td>
                              </tr>
                          ))}
                          {technicalOperations.length === 0 && (
                              <tr>
                                  <td colSpan={6} className="p-20 text-center text-slate-200">
                                      <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-5" />
                                      <p className="text-base font-black opacity-10 uppercase tracking-widest">Nenhuma operação ativa</p>
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] px-4">Links Rápidos</h3>
              <div className="grid grid-cols-1 gap-4">
                {[
                    { title: 'Gerenciar Solicitações', icon: ClipboardList, page: 'ServiceRequests', color: 'border-blue-100 hover:border-blue-400 bg-white hover:bg-blue-50/20', iconColor: 'text-blue-500' },
                    { title: 'Gerenciar Ordens Técnicas', icon: Wrench, page: 'ServiceOrders', color: 'border-indigo-100 hover:border-indigo-400 bg-white hover:bg-indigo-50/20', iconColor: 'text-indigo-500' },
                    { title: 'Relatórios Operacionais', icon: Clock, page: 'ServiceReports', color: 'border-slate-100 hover:border-slate-400 bg-white hover:bg-slate-50/20', iconColor: 'text-slate-500' },
                ].map((link, i) => (
                    <Link key={i} to={createPageUrl(link.page)} className="block group">
                        <div className={`flex items-center justify-between p-6 border-2 rounded-[28px] transition-all group-hover:shadow-xl group-hover:-translate-y-1 ${link.color}`}>
                            <div className="flex items-center gap-5">
                                <div className={`p-3 rounded-2xl bg-slate-50 ${link.iconColor} group-hover:bg-white shadow-inner`}>
                                  <link.icon className="h-6 w-6" />
                                </div>
                                <span className="font-extrabold text-sm text-slate-800 tracking-tight">{link.title}</span>
                            </div>
                            <ArrowRight className="h-6 w-6 text-slate-200 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                        </div>
                    </Link>
                ))}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}