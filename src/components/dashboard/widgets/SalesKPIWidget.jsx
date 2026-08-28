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
    queryFn: () => base44.entities.SalesOrder.filter({ 
      company_id: companyId,
      is_shipment: false, // Filtrar apenas pedidos de venda reais
    }, '-created_at', 200), // Limitar a 200 para evitar timeout e focar no recente
    enabled: !!companyId,
  });

  const validOrders = orders?.filter(o => o.status !== 'CANCELADO' && !o.is_shipment) || [];
  const totalSales = validOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;
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
    <Card className="bg-white border-transparent shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group cursor-pointer" onClick={() => navigate(createPageUrl('SalesOrders'))}>
      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
      <div className="absolute -right-6 -bottom-6 opacity-[0.04] text-emerald-900 group-hover:scale-110 group-hover:opacity-[0.08] transition-all duration-500 pointer-events-none">
        <ShoppingCart size={120} />
      </div>
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
          Total em Vendas
        </CardTitle>
        <div className="p-2 bg-emerald-50 rounded-lg">
          <ShoppingCart className="h-5 w-5 text-emerald-600" />
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSales)}
        </div>
        <p className="text-sm text-slate-500 mt-2 font-medium">
          <span className="text-emerald-600 flex items-center gap-1.5 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
            <TrendingUp className="h-3.5 w-3.5" />
            {confirmados} confirmados
          </span>
        </p>
      </CardContent>
    </Card>
  );
}