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
    queryKey: ['as-requests-safe-v2', companyId],
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
    queryKey: ['as-orders-safe-v2', companyId],
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
    <div className="p-6 bg-white min-h-screen space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Painel de Pós-Vendas</h1>
        <div className="flex gap-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                    className="pl-9 pr-4 py-2 border rounded-md text-sm w-64 outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Pesquisar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border shadow-none py-2">
              <CardContent className="p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total</p>
                  <p className="text-2xl font-bold text-slate-900">{kpis.total}</p>
              </CardContent>
          </Card>
          <Card className="border shadow-none py-2 border-l-4 border-l-red-500">
              <CardContent className="p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pendentes</p>
                  <p className="text-2xl font-bold text-red-600">{kpis.pending}</p>
              </CardContent>
          </Card>
          <Card className="border shadow-none py-2 border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Andamento</p>
                  <p className="text-2xl font-bold text-blue-600">{kpis.inProgress}</p>
              </CardContent>
          </Card>
          <Card className="border shadow-none py-2">
              <CardContent className="p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Eficiência</p>
                  <p className="text-2xl font-bold text-emerald-600">{kpis.efficiency}%</p>
              </CardContent>
          </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-none border">
          <CardHeader className="border-b bg-slate-50/50 py-3 flex flex-row items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-slate-500">
                <ClipboardList className="h-4 w-4" />
                Operações Técnicas
            </CardTitle>
            <div className="flex flex-col gap-2">
                <div className="flex bg-slate-100 p-1 rounded-lg self-end">
                    {['all', 'SR', 'OS'].map(t => (
                        <Button 
                            key={t}
                            variant={typeFilter === t ? 'secondary' : 'ghost'} 
                            size="sm" className="h-7 text-[10px] px-2"
                            onClick={() => setTypeFilter(t)}
                        >{t === 'all' ? 'Todas' : t === 'SR' ? 'Solicitações' : 'Ordens (OS)'}</Button>
                    ))}
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg self-end scale-90 origin-right">
                    {['all', 'active', 'progress', 'done'].map(s => (
                        <Button 
                            key={s}
                            variant={statusFilter === s ? 'secondary' : 'ghost'} 
                            size="sm" className="h-7 text-[10px] px-2"
                            onClick={() => setStatusFilter(s)}
                        >{s === 'all' ? 'Todos' : s === 'active' ? 'Pendentes' : s === 'progress' ? 'Andamento' : 'Encerradas'}</Button>
                    ))}
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px]">
                        <tr>
                            <th className="px-4 py-3 border-b">Tipo</th>
                            <th className="px-4 py-3 border-b">Documento</th>
                            <th className="px-4 py-3 border-b">Cliente</th>
                            <th className="px-4 py-3 border-b">Responsável</th>
                            <th className="px-4 py-3 border-b">Status</th>
                            <th className="px-4 py-3 border-b text-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {technicalOperations.map((item, i) => (
                            <tr key={item.id || i} className="hover:bg-slate-50/50 border-b last:border-0 transition-colors">
                                <td className="px-4 py-3">
                                    <Badge variant="outline" className={item._type === 'SR' ? 'border-blue-200 text-blue-700 bg-blue-50' : 'border-indigo-200 text-indigo-700 bg-indigo-50'}>
                                        {item._type}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-700">
                                    {item._type === 'SR' ? item.request_number : item.os_number}
                                </td>
                                <td className="px-4 py-3 text-slate-600 truncate max-w-[150px]">
                                    {item.client_name || '-'}
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-xs italic">
                                    {item._type === 'OS' ? (item.technician_name || 'Agendamento') : '-'}
                                </td>
                                <td className="px-4 py-3">
                                    <Badge variant={['ABERTA', 'PENDENTE'].includes(String(item.status || '').toUpperCase()) ? 'destructive' : 'default'} className="text-[9px] font-bold">
                                        {item.status}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Link to={createPageUrl(item._type === 'SR' ? `ServiceRequests?search=${item.request_number}` : `ServiceOrders?search=${item.os_number}`)}>
                                        <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold">ABRIR</Button>
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {technicalOperations.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-slate-400 italic">Nenhuma operação técnica encontrada</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Links Rápidos</h3>
            {[
                { title: 'Gerenciar Solicitações', icon: ClipboardList, page: 'ServiceRequests', color: 'border-blue-100 hover:border-blue-300 bg-blue-50/30' },
                { title: 'Gerenciar Ordens Técnicas', icon: Wrench, page: 'ServiceOrders', color: 'border-indigo-100 hover:border-indigo-300 bg-indigo-50/30' },
                { title: 'Relatórios de KM e Horas', icon: Clock, page: 'ServiceReports', color: 'border-slate-100 hover:border-slate-300 bg-slate-50/30' },
            ].map((link, i) => (
                <Link key={i} to={createPageUrl(link.page)} className="block group">
                    <div className={`flex items-center justify-between p-4 border rounded-xl transition-all group-hover:shadow-sm ${link.color}`}>
                        <div className="flex items-center gap-3">
                            <link.icon className="h-5 w-5 text-slate-400 group-hover:text-slate-600" />
                            <span className="font-bold text-sm text-slate-700 tracking-tight">{link.title}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                    </div>
                </Link>
            ))}
        </div>
      </div>
    </div>
  );
}