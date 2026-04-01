import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Wrench, ClipboardList, Package, FileText, BarChart3, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AfterSales() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');

  const { data: serviceRequests } = useQuery({
    queryKey: ['service-requests', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ServiceRequest.filter({ company_id: companyId }, '-created_date');
    },
    enabled: !!companyId,
    staleTime: 60000,
    refetchInterval: false,
  });

  const { data: serviceOrders } = useQuery({
    queryKey: ['service-orders', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ServiceOrder.filter({ company_id: companyId }, '-created_date');
    },
    enabled: !!companyId,
    staleTime: 60000,
    refetchInterval: false,
  });

  const openRequests = serviceRequests?.filter(r => r.status === 'ABERTA').length || 0;
  const activeOrders = serviceOrders?.filter(o => o.status === 'EM_ANDAMENTO').length || 0;
  const pendingInstallations = serviceRequests?.filter(r => r.type === 'INSTALACAO' && r.status === 'ABERTA').length || 0;

  const filteredRequests = serviceRequests?.filter(r => 
    search === '' || 
    r.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.op_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.product_sku?.toLowerCase().includes(search.toLowerCase()) ||
    r.description?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const filteredOrders = serviceOrders?.filter(o => 
    search === '' || 
    o.os_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.product_sku?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const modules = [
    {
      title: 'Solicitações de Serviço',
      description: 'Gestão de solicitações de assistência técnica',
      icon: ClipboardList,
      page: 'ServiceRequests',
      badge: openRequests,
      color: 'bg-blue-500'
    },
    {
      title: 'Ordens de Serviço',
      description: 'Criação e acompanhamento de OS',
      icon: Wrench,
      page: 'ServiceOrders',
      badge: activeOrders,
      color: 'bg-indigo-500'
    },
    {
      title: 'Controle de Séries',
      description: 'Gestão de números de série',
      icon: Package,
      page: 'SerialNumberControl',
      color: 'bg-purple-500'
    },
    {
      title: 'Instalações Pendentes',
      description: 'Produtos aguardando instalação',
      icon: Wrench,
      page: 'ServiceRequests?type=INSTALACAO',
      badge: pendingInstallations,
      color: 'bg-amber-500'
    },
    {
      title: 'Relatórios',
      description: 'Relatórios de serviços realizados',
      icon: BarChart3,
      page: 'ServiceReports',
      color: 'bg-emerald-500'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pós-Vendas</h1>
        <p className="text-slate-500">Gestão completa de assistência técnica e instalações</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link key={module.page} to={createPageUrl(module.page)}>
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4" style={{ borderLeftColor: module.color.replace('bg-', '#') }}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg ${module.color} bg-opacity-10`}>
                      <Icon className={`h-6 w-6 ${module.color.replace('bg-', 'text-')}`} />
                    </div>
                    {module.badge > 0 && (
                      <Badge className={`${module.color} text-white`}>
                        {module.badge}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-4">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Solicitações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {!serviceRequests || serviceRequests.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Nenhuma solicitação</p>
            ) : (
              <div className="space-y-2">
                {serviceRequests.slice(0, 5).map((req) => (
                  <Link key={req.id} to={createPageUrl(`ServiceRequests?id=${req.id}`)}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex-1">
                         <p className="font-medium text-sm">{req.client_name}</p>
                         <p className="text-xs text-slate-500">{req.description ? req.description.substring(0, 50) : 'Sem descrição'}</p>
                       </div>
                      <Badge variant={req.status === 'ABERTA' ? 'default' : 'secondary'}>
                        {req.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ordens em Andamento</CardTitle>
          </CardHeader>
          <CardContent>
            {!serviceOrders || serviceOrders.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Nenhuma ordem em andamento</p>
            ) : (
              <div className="space-y-2">
                {serviceOrders.filter(o => o.status === 'EM_ANDAMENTO').slice(0, 5).map((os) => (
                  <Link key={os.id} to={createPageUrl(`ServiceOrderDetail?id=${os.id}`)}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{os.os_number}</p>
                        <p className="text-xs text-slate-500">{os.client_name} - {os.product_name}</p>
                      </div>
                      <Badge className="bg-indigo-100 text-indigo-700">
                        {os.type}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}