import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Wrench, ClipboardList, AlertCircle, Clock, 
  ArrowRight, Filter, Search, MoreHorizontal, Activity, BarChart2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import moment from 'moment';

import BrazilInteractiveMap from '@/components/dashboard/BrazilMap';

export default function AfterSales() {
  const { companyId } = useCompanyId();
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;


  const { data: serviceRequests = [] } = useQuery({
    queryKey: ['as-requests-prod', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        return await base44.entities.ServiceRequest.filter({ company_id: companyId }, '-created_at', 500);
      } catch (e) {
        return [];
      }
    },
    enabled: !!companyId,
    staleTime: 30000
  });

  const { data: serviceOrders = [] } = useQuery({
    queryKey: ['as-orders-prod', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        return await base44.entities.ServiceOrder.filter({ company_id: companyId }, '-created_at', 500);
      } catch (e) {
        return [];
      }
    },
    enabled: !!companyId,
    staleTime: 30000
  });

  // OTIMIZAÇÃO: Buscar apenas clientes que aparecem nas OS/SRs atuais para evitar carregar milhares de registros
  const clientIdsToFetch = useMemo(() => {
    const ids = new Set();
    serviceRequests.forEach(r => r.client_id && ids.add(r.client_id));
    serviceOrders.forEach(o => o.client_id && ids.add(o.client_id));
    return Array.from(ids);
  }, [serviceRequests, serviceOrders]);

  const { data: clients = [] } = useQuery({
    queryKey: ['as-clients-subset', companyId, clientIdsToFetch.length],
    queryFn: async () => {
      if (!companyId || clientIdsToFetch.length === 0) return [];
      try {
        // Banco de clientes unificado - sem filtro de empresa
        return await base44.entities.Client.filter({ 
            id: clientIdsToFetch
        });
      } catch (e) {
        return [];
      }
    },
    enabled: !!companyId && clientIdsToFetch.length > 0,
    staleTime: 60000
  });

  // Mapeamento geográfico robusto
  const mapData = useMemo(() => {
    const sReqs = Array.isArray(serviceRequests) ? serviceRequests : [];
    const sOrds = Array.isArray(serviceOrders) ? serviceOrders : [];
    
    const combined = [
        ...sReqs.map(r => ({ ...r, _type: 'SR' })),
        ...sOrds.map(o => ({ ...o, _type: 'OS' }))
    ];

    return combined.map(item => {
      const client = clients.find(c => c.id === item.client_id);
      const uf = (client?.state || '').toUpperCase().trim();
      const city = client?.city || (typeof item.contact_address === 'string' ? item.contact_address.split(',')[0] : 'Localidade não informada');
      
      return {
        ...item,
        state_uf: uf,
        city_name: city,
        client_name: client?.name || item.client_name || 'Cliente Oculto',
        technician_name: item.technician_name || null
      };
    }).filter(s => s.state_uf && s.technician_name); 
  }, [serviceRequests, serviceOrders, clients]);

  const kpis = useMemo(() => {
    const sReqs = Array.isArray(serviceRequests) ? serviceRequests : [];
    const sOrds = Array.isArray(serviceOrders) ? serviceOrders : [];
    
    const allItems = [
        ...sReqs.map(r => ({ ...r, _type: 'SR', _status: String(r?.status || '').trim().toUpperCase() })),
        ...sOrds.map(o => ({ ...o, _type: 'OS', _status: String(o?.status || '').trim().toUpperCase() }))
    ];

    const categorySet = allItems.filter(item => typeFilter === 'all' || item._type === typeFilter);
    const categoryTotal = categorySet.length;
    const categoryCompleted = categorySet.filter(i => ['ENCERRADA', 'CONCLUIDA', 'FINALIZADA'].includes(i._status)).length;
    const globalEfficiency = categoryTotal > 0 ? Math.round((categoryCompleted / categoryTotal) * 100) : 0;

    const filteredSubset = allItems.filter(item => {
        if (typeFilter !== 'all' && item._type !== typeFilter) return false;
        if (statusFilter === 'active') return item._status === 'ABERTA' || item._status === 'PENDENTE';
        if (statusFilter === 'progress') return ['EM_ANDAMENTO', 'EM_ATENDIMENTO', 'PAUSADA', 'AGUARDANDO_PECA'].includes(item._status);
        if (statusFilter === 'done') return ['ENCERRADA', 'CONCLUIDA', 'FINALIZADA'].includes(item._status);
        return true;
    });

    return { 
        total: filteredSubset.length, 
        pending: filteredSubset.filter(i => i._status === 'ABERTA' || i._status === 'PENDENTE').length, 
        inProgress: filteredSubset.filter(i => ['EM_ANDAMENTO', 'EM_ATENDIMENTO', 'PAUSADA', 'AGUARDANDO_PECA'].includes(i._status)).length, 
        efficiency: globalEfficiency 
    };
  }, [serviceRequests, serviceOrders, typeFilter, statusFilter]);

  const technicalOperations = useMemo(() => {
      const sReqs = Array.isArray(serviceRequests) ? serviceRequests : [];
      const sOrds = Array.isArray(serviceOrders) ? serviceOrders : [];
      const combined = [
          ...sReqs.map(sr => ({ ...sr, _type: 'SR', date: sr.created_date || sr.created_at || new Date().toISOString(), status: sr.status || 'Aberta' })),
          ...sOrds.map(so => ({ ...so, _type: 'OS', date: so.created_date || so.created_at || new Date().toISOString(), status: so.status || 'Pendente' }))
      ];
      
      combined.sort((a, b) => {
          const dateA = moment(a.date).isValid() ? moment(a.date).valueOf() : 0;
          const dateB = moment(b.date).isValid() ? moment(b.date).valueOf() : 0;
          return dateB - dateA;
      });

      return combined.filter(item => {
        const client = (Array.isArray(clients) ? clients : []).find(c => c.id === item.client_id);
        item._location = client ? `${client.city || 'S/C'}/${client.state || 'UF'}` : 'Não informada';
        if (typeFilter !== 'all' && item._type !== typeFilter) return false;
        const s = String(item?.status || '').toUpperCase();
        if (statusFilter === 'active') return s === 'ABERTA' || s === 'PENDENTE';
        if (statusFilter === 'progress') return ['EM_ANDAMENTO', 'EM_ATENDIMENTO', 'PAUSADA', 'AGUARDANDO_PECA'].includes(s);
        if (statusFilter === 'done') return ['ENCERRADA', 'CONCLUIDA', 'FINALIZADA'].includes(s);
        return true;
      });
  }, [serviceRequests, serviceOrders, typeFilter, statusFilter, clients]);

  const totalOperations = technicalOperations.length;
  const totalPages = Math.ceil(totalOperations / PAGE_SIZE);
  const paginatedOperations = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return technicalOperations.slice(start, start + PAGE_SIZE);
  }, [technicalOperations, currentPage, PAGE_SIZE]);


  return (
    <div className="bg-[#0A0C10] min-h-screen text-slate-200 selection:bg-indigo-500/30">
      <div className="max-w-[1800px] mx-auto p-4 lg:p-8 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/5 backdrop-blur-xl p-6 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10">
            <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
              <div className="w-1.5 h-8 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
              Pós-Vendas
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1 ml-4">Centro Intelligence Operacional</p>
          </div>
          <div className="w-full md:w-auto relative z-10">
              <div className="relative group/search">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within/search:text-indigo-400 transition-colors" />
                  <input 
                      className="pl-11 pr-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs w-full md:w-80 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all placeholder:text-slate-600"
                      placeholder="Buscar por cliente, OS ou técnico..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                  />
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-9 space-y-8">
            <BrazilInteractiveMap services={mapData} />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Geral', value: kpis.total, color: 'from-blue-500/20 to-indigo-500/5', border: 'border-blue-500/20', iconColor: 'text-blue-400' },
                  { label: 'Pendentes', value: kpis.pending, color: 'from-rose-500/20 to-rose-500/5', border: 'border-rose-500/20', iconColor: 'text-rose-400' },
                  { label: 'Em Andamento', value: kpis.inProgress, color: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/20', iconColor: 'text-amber-400' },
                  { label: 'Eficiência Regional', value: `${kpis.efficiency}%`, color: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/20', iconColor: 'text-emerald-400' },
                ].map((kpi, idx) => (
                  <Card key={idx} className={`bg-gradient-to-br ${kpi.color} border ${kpi.border} shadow-xl rounded-[1.5rem] overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                            <p className={`text-3xl font-black ${kpi.iconColor}`}>{kpi.value}</p>
                          </div>
                          <div className={`p-2 rounded-xl bg-white/5 ${kpi.iconColor}`}>
                             <Activity className="h-4 w-4" />
                          </div>
                        </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
          
          <div className="xl:col-span-3 space-y-8">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-4">Operações Rápidas</h3>
              <div className="flex flex-col gap-3">
                {[
                    { title: 'Solicitações', desc: 'Gerenciar chamados', icon: ClipboardList, page: 'ServiceRequests', color: 'hover:border-blue-500/50 hover:bg-blue-500/5', iconBg: 'bg-blue-500/10 text-blue-400' },
                    { title: 'Ordens Técnicas', desc: 'Controle de campo', icon: Wrench, page: 'ServiceOrders', color: 'hover:border-indigo-500/50 hover:bg-indigo-500/5', iconBg: 'bg-indigo-500/10 text-indigo-400' },
                    { title: 'Controle de Qualidade', desc: 'Gargalos & Melhorias', icon: BarChart2, page: 'AfterSalesQuality', color: 'hover:border-amber-500/50 hover:bg-amber-500/5', iconBg: 'bg-amber-500/10 text-amber-400' },
                    { title: 'Relatórios Full', desc: 'Análise de KPIs', icon: Clock, page: 'ServiceReports', color: 'hover:border-emerald-500/50 hover:bg-emerald-500/5', iconBg: 'bg-emerald-500/10 text-emerald-400' },
                ].map((link, i) => (
                    <Link key={i} to={createPageUrl(link.page)} className="block group">
                        <div className={`p-4 bg-white/5 border border-white/10 rounded-[1.5rem] transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(0,0,0,0.3)] ${link.color}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl ${link.iconBg}`}>
                                      <link.icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                      <p className="font-black text-sm text-white tracking-tight">{link.title}</p>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase">{link.desc}</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                            </div>
                        </div>
                    </Link>
                ))}
              </div>
            </div>

            <div className="p-6 bg-gradient-to-b from-indigo-500/10 to-transparent border border-white/5 rounded-[2rem] space-y-4">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Atividade Recente</span>
               </div>
               <div className="space-y-4">
                  {technicalOperations.slice(0, 5).map((item, idx) => {
                      const clientFirst = (item.client_name || 'Cliente').split(' ')[0].toUpperCase();
                      const status = String(item.status || '').toUpperCase();
                      let message = '';
                      if (item._type === 'SR') {
                          message = `SOLICITAÇÃO #${item.request_number} RECEBIDA DE ${clientFirst}`;
                      } else {
                          if (['EM_ANDAMENTO', 'EM_ATENDIMENTO'].includes(status)) {
                              message = `${(item.technician_name || 'TÉCNICO').split(' ')[0].toUpperCase()} EM ATENDIMENTO NA OS #${item.os_number}`;
                          } else if (['ENCERRADA', 'CONCLUIDA'].includes(status)) {
                              message = `OS #${item.os_number} CONCLUÍDA EM ${clientFirst}`;
                          } else {
                              message = `OS #${item.os_number} AGENDADA PARA ${clientFirst}`;
                          }
                      }
                      return (
                          <div key={idx} className="group/feed relative">
                             <div className="absolute -left-3 top-0 bottom-0 w-[2px] bg-white/5 group-hover/feed:bg-indigo-500 transition-colors" />
                             <p className="text-[10px] text-slate-300 font-black leading-tight tracking-tight mb-1 uppercase">
                                {message}
                             </p>
                             <div className="flex items-center gap-2">
                                <span className={`text-[8px] font-bold px-1.5 rounded-sm ${item._type === 'SR' ? 'bg-blue-500/20 text-blue-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                    {item._type}
                                </span>
                                <span className="text-[8px] text-slate-600 font-black uppercase">{moment(item.date).fromNow()}</span>
                             </div>
                          </div>
                      );
                  })}
               </div>
            </div>
          </div>
        </div>

        <Card className="shadow-2xl border border-white/5 rounded-[2.5rem] overflow-hidden bg-white/[0.02] backdrop-blur-sm">
          <CardHeader className="border-b border-white/5 bg-white/[0.02] p-6 flex flex-col lg:flex-row items-center justify-between gap-6">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 text-slate-400">
                <div className="p-2 bg-indigo-500/10 rounded-xl">
                  <ClipboardList className="h-5 w-5 text-indigo-400" />
                </div>
                Monitoramento Operacional
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10 gap-1 overflow-x-auto no-scrollbar">
                    {['all', 'SR', 'OS'].map(t => (
                        <Button 
                            key={t}
                            variant="ghost" 
                            size="sm" 
                            className={`h-8 text-[10px] px-4 font-black rounded-xl transition-all ${
                              typeFilter === t ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'text-slate-500 hover:text-white'
                            }`}
                            onClick={() => setTypeFilter(t)}
                        >{t === 'all' ? 'Tudo' : t === 'SR' ? 'Solicitações' : 'Ordens (OS)'}</Button>
                    ))}
                </div>
                <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10 gap-1 overflow-x-auto no-scrollbar">
                    {[
                      { id: 'all', label: 'TODOS', color: 'bg-slate-700' },
                      { id: 'active', label: 'PENDENTES', color: 'bg-rose-500' },
                      { id: 'progress', label: 'ANDAMENTO', color: 'bg-blue-500' },
                      { id: 'done', label: 'ENCERRADAS', color: 'bg-emerald-500' }
                    ].map(st => (
                      <Button 
                          key={st.id}
                          variant="ghost" 
                          size="sm" 
                          className={`h-8 text-[9px] px-3 font-black rounded-xl transition-all ${
                            statusFilter === st.id ? `${st.color} text-white shadow-lg` : 'text-slate-500 hover:text-white'
                          }`}
                          onClick={() => setStatusFilter(st.id)}
                      >{st.label}</Button>
                    ))}
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-black/20 text-slate-500 font-bold uppercase text-[9px] tracking-[0.2em]">
                        <tr>
                            <th className="px-6 py-4 border-b border-white/5">Identificação</th>
                            <th className="px-6 py-4 border-b border-white/5 w-[35%]">Cliente / Local</th>
                            <th className="px-6 py-4 border-b border-white/5">Técnico Atribuído</th>
                            <th className="px-6 py-4 border-b border-white/5 text-center">Status Operacional</th>
                            <th className="px-6 py-4 border-b border-white/5 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {paginatedOperations.map((item, i) => (
                            <tr key={item.id || i} className="hover:bg-white/[0.03] transition-all group">
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className={`text-[8px] h-5 font-black uppercase px-2 ${item._type === 'SR' ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' : 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5'}`}>
                                            {item._type}
                                        </Badge>
                                        <span className="font-black text-white text-sm tracking-tight">
                                            {item._type === 'SR' ? item.request_number : item.os_number}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <p className="text-white font-bold uppercase truncate max-w-[300px]">{item.client_name || '-'}</p>
                                    <p className="text-[10px] text-slate-500 font-medium">
                                        <span className="text-indigo-400 font-bold">{item._location}</span> • {moment(item.date).format('DD/MM/YYYY')}
                                    </p>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-2 text-slate-400 font-semibold italic text-[10px]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                        {item._type === 'OS' ? (item.technician_name || 'Agendamento Pendente') : 'N/A'}
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-center">
                                    <Badge 
                                      variant="default"
                                      className={`text-[8px] font-black px-2.5 py-1 rounded-md shadow-lg ${
                                          ['ABERTA', 'PENDENTE'].includes(String(item.status || '').toUpperCase()) ? 'bg-rose-500 text-white' :
                                          String(item.status || '').toUpperCase() === 'EM_ANDAMENTO' ? 'bg-blue-600 text-white' : 
                                          ['ENCERRADA', 'CONCLUIDA', 'FINALIZADA'].includes(String(item.status || '').toUpperCase()) ? 'bg-emerald-600 text-white' : 
                                          'bg-slate-700 text-slate-300'
                                      }`}
                                    >
                                        {(item.status || 'Pendente').toUpperCase()}
                                    </Badge>
                                </td>
                                <td className="px-6 py-5 text-right">
                                    <Link to={createPageUrl(item._type === 'SR' ? `ServiceRequests?search=${item.request_number}` : `ServiceOrderDetail?id=${item.id}`)}>
                                        <Button variant="ghost" size="sm" className="h-10 w-10 p-0 rounded-2xl hover:bg-white hover:text-black transition-all text-white/20 hover:text-white">
                                          <ArrowRight className="h-5 w-5" />
                                        </Button>
                                    </Link>
                                </td>

                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-8 py-6 border-t border-white/5 bg-white/[0.01]">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Exibindo <span className="text-white">{(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalOperations)}</span> de <span className="text-indigo-400">{totalOperations}</span> resultados
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                      <Button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-5 text-slate-500 hover:text-white"
                      >
                        ←
                      </Button>
                      <div className="px-4 py-1.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                         <span className="text-xs font-black text-indigo-400 tracking-tighter">{currentPage}</span>
                         <span className="text-[10px] text-slate-600 font-bold px-1">/</span>
                         <span className="text-xs font-black text-slate-400 tracking-tighter">{totalPages}</span>
                      </div>
                      <Button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-5 text-slate-500 hover:text-white"
                      >
                        →
                      </Button>

                  </div>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}