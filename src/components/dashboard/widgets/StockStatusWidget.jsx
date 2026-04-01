import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Package, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useCompanyId } from '@/components/useCompanyId';

export default function StockStatusWidget() {
  const { companyId, loading: companyLoading } = useCompanyId();
  const { data: stockBalances, isLoading } = useQuery({
    queryKey: ['stock-status', companyId],
    queryFn: () => base44.entities.StockBalance.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const lowStock = stockBalances?.filter(s => s.qty_available <= 0).length || 0;
  const totalItems = stockBalances?.length || 0;

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
          Status de Estoque
        </CardTitle>
        <Package className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{totalItems}</div>
        <p className="text-xs text-slate-500 mt-1">
          {lowStock > 0 ? (
            <span className="text-red-600 font-medium flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {lowStock} sem estoque
            </span>
          ) : (
            <span className="text-emerald-600">Todos com estoque</span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}