import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ShoppingCart, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanyId } from '@/components/useCompanyId';

export default function SalesKPIWidget() {
  const navigate = useNavigate();
  const { companyId, loading: companyLoading } = useCompanyId();
  const { data: orders, isLoading } = useQuery({
    queryKey: ['sales-orders-kpi', companyId],
    queryFn: () => base44.entities.SalesOrder.filter({ company_id: companyId }, '-created_date', 50),
    enabled: !!companyId,
  });

  const validOrders = orders?.filter(o => o.status !== 'CANCELADO') || [];
  const totalSales = validOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  const confirmados = validOrders.filter(o => o.status === 'CONFIRMADO').length || 0;

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
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('SalesOrders'))}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          Total em Vendas
        </CardTitle>
        <ShoppingCart className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSales)}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          <span className="text-emerald-600 font-medium flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {confirmados} confirmados
          </span>
        </p>
      </CardContent>
    </Card>
  );
}