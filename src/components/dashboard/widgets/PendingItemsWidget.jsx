import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useCompanyId } from '@/components/useCompanyId';

export default function PendingItemsWidget() {
  const { companyId, loading: companyLoading } = useCompanyId();
  const { data: items, isLoading } = useQuery({
    queryKey: ['pending-storage-items', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const conferidos = await base44.entities.ReceivingItem.filter({ company_id: companyId, status: 'CONFERIDO' });
      return conferidos.filter(item => item.qty > 0);
    },
    enabled: !!companyId,
  });

  const pending = items?.length || 0;

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
    <Link to={createPageUrl('StorageAllocation')}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">
            Pendente Armazenamento
          </CardTitle>
          <Package className="h-4 w-4 text-slate-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900">{pending}</div>
          <p className="text-xs text-slate-500 mt-1">
            {pending > 0 ? (
              <span className="text-amber-600 font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Aguardando alocação
              </span>
            ) : (
              <span className="text-emerald-600">Tudo armazenado</span>
            )}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}