import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ClipboardList, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useCompanyId } from '@/components/useCompanyId';

export default function OpenRequestsWidget() {
  const { companyId, loading: companyLoading } = useCompanyId();
  const { data: materialRequests, isLoading: loadingMaterial } = useQuery({
    queryKey: ['open-material-requests', companyId],
    queryFn: () => base44.entities.MaterialRequest.filter({ company_id: companyId, status: 'ABERTA' }),
    enabled: !!companyId,
  });

  const { data: serviceRequests, isLoading: loadingService } = useQuery({
    queryKey: ['open-service-requests', companyId],
    queryFn: () => base44.entities.ServiceRequest.filter({ company_id: companyId, status: 'ABERTA' }),
    enabled: !!companyId,
  });

  const totalOpen = (materialRequests?.length || 0) + (serviceRequests?.length || 0);
  const isLoading = loadingMaterial || loadingService;

  if (isLoading || companyLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          Solicitações Abertas
        </CardTitle>
        <ClipboardList className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{totalOpen}</div>
        <div className="text-xs text-slate-500 mt-1 space-y-1">
          <Link to={createPageUrl('MaterialRequests')} className="block hover:text-indigo-600">
            {materialRequests?.length || 0} materiais
          </Link>
          <Link to={createPageUrl('ServiceRequests')} className="block hover:text-indigo-600">
            {serviceRequests?.length || 0} serviços
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}