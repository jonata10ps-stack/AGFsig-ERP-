import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, MapPin, CheckCircle, Package, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function PickingOptimized() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order');

  const [currentStep, setCurrentStep] = useState(0);

  const { data: order } = useQuery({
    queryKey: ['sales-order', orderId],
    queryFn: () => base44.entities.SalesOrder.filter({ id: orderId }),
    select: (data) => data?.[0],
    enabled: !!orderId,
  });

  const { data: orderItems } = useQuery({
    queryKey: ['sales-order-items', orderId],
    queryFn: () => base44.entities.SalesOrderItem.filter({ company_id: companyId, order_id: orderId }),
    enabled: !!orderId && !!companyId,
  });

  const { data: reservations } = useQuery({
    queryKey: ['reservations', orderId],
    queryFn: () => base44.entities.Reservation.filter({ company_id: companyId, order_id: orderId, status: 'RESERVADA' }),
    enabled: !!orderId && !!companyId,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => companyId ? base44.entities.Warehouse.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => companyId ? base44.entities.Location.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  // Agrupar reservas por localização e otimizar rota
  const pickingRoute = React.useMemo(() => {
    if (!reservations || !locations || !warehouses) return [];

    const grouped = reservations.reduce((acc, res) => {
      const location = locations.find(l => l.id === res.location_id);
      if (!location) return acc;

      const key = `${res.warehouse_id}_${res.location_id}`;
      if (!acc[key]) {
        acc[key] = {
          warehouse_id: res.warehouse_id,
          location_id: res.location_id,
          location: location,
          items: []
        };
      }
      acc[key].items.push(res);
      return acc;
    }, {});

    // Ordenar por rua/modulo/nivel para otimizar rota
    return Object.values(grouped).sort((a, b) => {
      const locA = a.location;
      const locB = b.location;
      if (locA.rua !== locB.rua) return (locA.rua || '').localeCompare(locB.rua || '');
      if (locA.modulo !== locB.modulo) return (locA.modulo || '').localeCompare(locB.modulo || '');
      return (locA.nivel || '').localeCompare(locB.nivel || '');
    });
  }, [reservations, locations, warehouses]);

  const confirmPickMutation = useMutation({
    mutationFn: async (reservationIds) => {
      // Marcar reservas como separadas
      for (const resId of reservationIds) {
        await base44.entities.Reservation.update(resId, { status: 'SEPARADA' });
      }

      // Criar movimentos de estoque
      const currentLocation = pickingRoute[currentStep];
      for (const res of currentLocation.items) {
        await base44.entities.InventoryMove.create({
          type: 'SEPARACAO',
          product_id: res.product_id,
          qty: res.qty,
          from_warehouse_id: res.warehouse_id,
          from_location_id: res.location_id,
          related_type: 'PEDIDO',
          related_id: orderId,
          reason: `Separação - Pedido ${order?.order_number}`
        });

        // Atualizar saldo
        const balances = await base44.entities.StockBalance.filter({
          company_id: companyId,
          product_id: res.product_id,
          warehouse_id: res.warehouse_id,
          location_id: res.location_id
        });

        if (balances.length > 0) {
          const balance = balances[0];
          await base44.entities.StockBalance.update(balance.id, {
            qty_reserved: (balance.qty_reserved || 0) - res.qty,
            qty_separated: (balance.qty_separated || 0) + res.qty
          });
        }
      }

      // Atualizar itens do pedido
      const itemIds = new Set(currentLocation.items.map(r => r.order_item_id));
      for (const itemId of itemIds) {
        const item = orderItems.find(i => i.id === itemId);
        if (item) {
          const totalSeparated = currentLocation.items
            .filter(r => r.order_item_id === itemId)
            .reduce((sum, r) => sum + r.qty, 0);
          
          await base44.entities.SalesOrderItem.update(itemId, {
            qty_separated: (item.qty_separated || 0) + totalSeparated
          });
        }
      }

      // Log auditoria
      const user = await base44.auth.me();
      await base44.entities.AuditLog.create({
        action: 'PICKING',
        entity_type: 'SalesOrder',
        entity_id: orderId,
        new_data: JSON.stringify({
          location: currentLocation.location.barcode,
          items_count: currentLocation.items.length
        }),
        user_email: user.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order-items'] });
      
      if (currentStep < pickingRoute.length - 1) {
        setCurrentStep(currentStep + 1);
        toast.success('Localização confirmada! Próxima localização...');
      } else {
        // Atualizar status do pedido
        base44.entities.SalesOrder.update(orderId, { status: 'SEPARADO' });
        queryClient.invalidateQueries({ queryKey: ['sales-order'] });
        toast.success('Separação completa!');
      }
    }
  });

  if (!order || !pickingRoute.length) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Separation')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Picking Otimizado</h1>
          </div>
        </div>
        <Alert>
          <Package className="h-4 w-4" />
          <AlertDescription>
            Nenhuma separação pendente para este pedido
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const currentLocation = pickingRoute[currentStep];
  const warehouse = warehouses?.find(w => w.id === currentLocation.warehouse_id);
  const progress = ((currentStep + 1) / pickingRoute.length) * 100;
  const allCompleted = currentStep >= pickingRoute.length;

  const warehouseMap = warehouses?.reduce((acc, w) => ({ ...acc, [w.id]: w }), {}) || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Separation')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Picking Otimizado</h1>
          <p className="text-slate-500">Pedido: {order?.order_number} - {order?.client_name}</p>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Progresso da Separação</span>
              <span className="text-slate-500">
                {currentStep + 1} de {pickingRoute.length} localizações
              </span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {!allCompleted && (
        <>
          {/* Current Location */}
          <Card className="bg-indigo-50 border-indigo-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-900">
                <MapPin className="h-5 w-5" />
                Vá para a localização:
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-indigo-600 mb-1">Armazém</p>
                  <p className="text-2xl font-bold text-indigo-900">{warehouse?.code}</p>
                  <p className="text-slate-600">{warehouse?.name}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border-2 border-indigo-300">
                  <p className="text-sm text-indigo-600 mb-2">Localização</p>
                  <div className="grid grid-cols-3 gap-4">
                    {currentLocation.location.rua && (
                      <div>
                        <p className="text-xs text-slate-500">Rua</p>
                        <p className="text-xl font-bold text-indigo-900">{currentLocation.location.rua}</p>
                      </div>
                    )}
                    {currentLocation.location.modulo && (
                      <div>
                        <p className="text-xs text-slate-500">Módulo</p>
                        <p className="text-xl font-bold text-indigo-900">{currentLocation.location.modulo}</p>
                      </div>
                    )}
                    {currentLocation.location.nivel && (
                      <div>
                        <p className="text-xs text-slate-500">Nível</p>
                        <p className="text-xl font-bold text-indigo-900">{currentLocation.location.nivel}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-2">Código: {currentLocation.location.barcode}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items to Pick */}
          <Card>
            <CardHeader>
              <CardTitle>Itens para Separar nesta Localização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentLocation.items.map((res) => {
                const item = orderItems?.find(i => i.id === res.order_item_id);
                return (
                  <div key={res.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-mono text-sm text-indigo-600">{item?.product_sku}</p>
                      <p className="font-medium">{item?.product_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-900">{res.qty}</p>
                      <p className="text-sm text-slate-500">unidades</p>
                    </div>
                  </div>
                );
              })}

              <Button
                onClick={() => confirmPickMutation.mutate(currentLocation.items.map(r => r.id))}
                disabled={confirmPickMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-14 text-lg"
              >
                {confirmPickMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Confirmar Separação desta Localização
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Next Locations Preview */}
          {currentStep < pickingRoute.length - 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-600">Próximas Localizações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pickingRoute.slice(currentStep + 1, currentStep + 4).map((loc, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                      {currentStep + idx + 2}
                    </div>
                    <div className="flex-1">
                      <p className="font-mono text-sm text-slate-600">{loc.location.barcode}</p>
                      <p className="text-xs text-slate-500">{loc.items.length} item(ns)</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {allCompleted && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-emerald-600 mb-4" />
            <h2 className="text-2xl font-bold text-emerald-900 mb-2">Separação Completa!</h2>
            <p className="text-emerald-700 mb-6">Todos os itens foram separados com sucesso</p>
            <Link to={createPageUrl('Separation')}>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                Voltar para Separações
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}