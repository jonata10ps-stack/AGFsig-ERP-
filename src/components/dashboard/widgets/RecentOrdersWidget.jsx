import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useCompanyId } from '@/components/useCompanyId';

export default function RecentOrdersWidget() {
  const navigate = useNavigate();
  const { companyId, loading: companyLoading } = useCompanyId();
  const { data: orders, isLoading } = useQuery({
    queryKey: ['recent-orders-widget', companyId],
    queryFn: () => base44.entities.SalesOrder.filter({ company_id: companyId }, '-created_date', 5),
    enabled: !!companyId,
  });

  const statusColors = {
    RASCUNHO: 'bg-slate-100 text-slate-700',
    CONFIRMADO: 'bg-blue-100 text-blue-700',
    RESERVADO: 'bg-indigo-100 text-indigo-700',
    SEPARANDO: 'bg-amber-100 text-amber-700',
    SEPARADO: 'bg-emerald-100 text-emerald-700',
    FATURADO: 'bg-purple-100 text-purple-700',
    EXPEDIDO: 'bg-teal-100 text-teal-700',
    CANCELADO: 'bg-rose-100 text-rose-700',
  };

  if (isLoading || companyLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Pedidos Recentes</CardTitle>
        <Link to={createPageUrl('SalesOrders')}>
          <Button variant="ghost" size="sm" className="text-indigo-600 h-8">
            Ver todos <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {orders?.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <ShoppingCart className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Nenhum pedido</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders?.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => navigate(createPageUrl('SalesOrderDetail') + `?id=${order.id}`)}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 truncate">
                    {order.order_number || `#${order.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{order.client_name}</p>
                </div>
                <div className="text-right ml-2">
                  <p className="text-sm font-medium text-slate-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount || 0)}
                  </p>
                  <Badge className={`text-xs ${statusColors[order.status]}`}>
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}