import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function SalesOrdersMissing() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();

  const { data: salesOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ['sales-orders-confirmed', companyId],
    queryFn: () => {
      if (!companyId) return Promise.resolve([]);
      return base44.entities.SalesOrder.filter({
        company_id: companyId,
        status: 'CONFIRMADO'
      });
    },
    enabled: !!companyId,
  });

  const { data: productionRequests } = useQuery({
    queryKey: ['production-requests', companyId],
    queryFn: () => {
      if (!companyId) return Promise.resolve([]);
      return base44.entities.ProductionRequest.filter({ company_id: companyId });
    },
    enabled: !!companyId,
  });

  const { data: items } = useQuery({
    queryKey: ['all-sales-order-items', companyId],
    queryFn: () => {
      if (!companyId) return Promise.resolve([]);
      return base44.entities.SalesOrderItem.list();
    },
    enabled: !!companyId,
  });

  // Identifica pedidos que deveriam ter gerado solicitações mas não têm
  const ordersWithMissingRequests = React.useMemo(() => {
    if (!salesOrders || !productionRequests || !items) return [];

    return salesOrders.filter(order => {
      const orderItems = items.filter(i => i.order_id === order.id);
      const needsProduction = orderItems.some(item => 
        item.fulfill_mode === 'PRODUCAO' || item.fulfill_mode === 'AUTO'
      );

      if (!needsProduction) return false;

      const hasRequests = productionRequests.some(r => r.origin_id === order.id);
      return !hasRequests;
    });
  }, [salesOrders, productionRequests, items]);

  const createMissingRequestsMutation = useMutation({
    mutationFn: async (orderId) => {
      const order = salesOrders.find(o => o.id === orderId);
      const orderItems = items.filter(i => i.order_id === orderId);

      const createdRequests = [];
      for (const item of orderItems) {
        if (item.fulfill_mode === 'PRODUCAO' || item.fulfill_mode === 'AUTO') {
          const request = await base44.entities.ProductionRequest.create({
            company_id: companyId,
            origin_type: 'VENDA',
            origin_id: orderId,
            order_id: orderId,
            order_number: order.order_number,
            product_id: item.product_id,
            product_name: item.product_name,
            qty_requested: item.qty,
            qty_fulfilled: 0,
            qty_residue: 0,
            priority: 'NORMAL',
            status: 'PENDENTE',
            due_date: order.delivery_date,
          });
          createdRequests.push(request);
        }
      }
      return createdRequests;
    },
    onSuccess: (requests) => {
      queryClient.invalidateQueries({ queryKey: ['production-requests', companyId] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-confirmed', companyId] });
      toast.success(`${requests.length} solicitação(ões) de produção criada(s)`);
    },
  });

  if (loadingOrders) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pedidos Faltando Solicitações de Produção</h1>
        <p className="text-slate-500 mt-1">Análise de pedidos confirmados que não geraram solicitações vinculadas</p>
      </div>

      {ordersWithMissingRequests.length === 0 ? (
        <Alert className="bg-emerald-50 border-emerald-200">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700">
            Todos os pedidos confirmados têm solicitações de produção vinculadas. ✓
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              {ordersWithMissingRequests.length} pedido(s) não tiveram solicitações de produção criadas automaticamente.
              Clique em "Criar" para gerar as solicitações.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4">
            {ordersWithMissingRequests.map(order => {
              const orderItems = items.filter(i => i.order_id === order.id);
              const productionItems = orderItems.filter(i => i.fulfill_mode === 'PRODUCAO' || i.fulfill_mode === 'AUTO');

              return (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{order.order_number}</CardTitle>
                        <p className="text-sm text-slate-500 mt-1">{order.client_name}</p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700">
                        {productionItems.length} item(ns) para produção
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="text-sm">
                        <p className="text-slate-600 mb-2">Itens que precisam de produção:</p>
                        <ul className="space-y-1 ml-4">
                          {productionItems.map(item => (
                            <li key={item.id} className="text-slate-700">
                              • {item.product_name} ({item.qty} un.)
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link to={createPageUrl(`SalesOrderDetail?id=${order.id}`)}>
                        <Button variant="outline" size="sm">Ver Pedido</Button>
                      </Link>
                      <Button
                        onClick={() => createMissingRequestsMutation.mutate(order.id)}
                        disabled={createMissingRequestsMutation.isPending}
                        className="bg-indigo-600 hover:bg-indigo-700"
                        size="sm"
                      >
                        <RefreshCw className="h-3 w-3 mr-2" />
                        {createMissingRequestsMutation.isPending ? 'Criando...' : 'Criar Solicitações'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}