import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ShoppingCart, TrendingUp, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanyId } from '@/components/useCompanyId';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import moment from 'moment';

export default function SalesKPIWidget() {
  const navigate = useNavigate();
  const { companyId, loading: companyLoading } = useCompanyId();
  const { data: orders, isLoading } = useQuery({
    queryKey: ['sales-orders-kpi', companyId],
    queryFn: () => base44.entities.SalesOrder.filter({ 
      company_id: companyId,
      is_shipment: false,
    }, '-created_at', 100),
    enabled: !!companyId,
  });

  const { totalSales, confirmados, chartData } = useMemo(() => {
    const validOrders = orders?.filter(o => o.status !== 'CANCELADO' && !o.is_shipment) || [];
    const total = validOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;
    const count = validOrders.filter(o => o.status === 'CONFIRMADO').length || 0;

    // Mini chart data
    const days = {};
    for (let i = 6; i >= 0; i--) {
        days[moment().subtract(i, 'days').format('DD')] = 0;
    }
    validOrders.forEach(o => {
        const d = moment(o.created_at).format('DD');
        if (days[d] !== undefined) days[d] += Number(o.total_amount) || 0;
    });
    const cData = Object.entries(days).map(([name, val]) => ({ val }));

    return { totalSales: total, confirmados: count, chartData: cData };
  }, [orders]);

  if (isLoading || companyLoading) {
    return (
      <Card className="h-full border-none shadow-sm">
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent><Skeleton className="h-8 w-24" /></CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="group hover:shadow-xl transition-all duration-500 cursor-pointer border-none shadow-sm bg-gradient-to-br from-white to-slate-50/50 relative overflow-hidden h-full" 
      onClick={() => navigate(createPageUrl('SalesOrders'))}
    >
      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowUpRight className="h-4 w-4 text-indigo-500" />
      </div>
      
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
           <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <ShoppingCart className="h-4 w-4" />
           </div>
           <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
             Vendas Totais
           </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalSales)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                <TrendingUp className="h-3 w-3" />
                {confirmados}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">pedidos confirmados</span>
            </div>
          </div>
          
          <div className="h-12 w-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line 
                  type="monotone" 
                  dataKey="val" 
                  stroke="#6366f1" 
                  strokeWidth={2.5} 
                  dot={false} 
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}