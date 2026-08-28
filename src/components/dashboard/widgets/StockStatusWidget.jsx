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
    <Card className="bg-white border-transparent shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
      <div className="absolute -right-6 -bottom-6 opacity-[0.04] text-blue-900 group-hover:scale-110 group-hover:opacity-[0.08] transition-all duration-500 pointer-events-none">
        <Package size={120} />
      </div>
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
          Status de Estoque
        </CardTitle>
        <div className="p-2 bg-blue-50 rounded-lg">
          <Package className="h-5 w-5 text-blue-600" />
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalItems}</div>
        <p className="text-sm text-slate-500 mt-2 font-medium">
          {lowStock > 0 ? (
            <span className="text-red-600 flex items-center gap-1.5 bg-red-50 w-fit px-2 py-0.5 rounded-full">
              <AlertCircle className="h-3.5 w-3.5" />
              {lowStock} sem estoque
            </span>
          ) : (
            <span className="text-emerald-600 flex items-center gap-1.5 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
              Todos com estoque
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}