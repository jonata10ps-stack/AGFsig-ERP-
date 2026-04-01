import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Package, MapPin, AlertCircle } from 'lucide-react';

export default function ReservationDialog({ open, onClose, order, items }) {
  const queryClient = useQueryClient();
  // reservations: { itemId -> { location_id, qty, warehouse_id } }
  const [reservations, setReservations] = useState({});

  const { data: stockBalances = [] } = useQuery({
    queryKey: ['stock-balances-reservation', order?.company_id],
    queryFn: () => base44.entities.StockBalance.filter({ company_id: order.company_id }),
    enabled: !!order?.company_id && open,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations-reservation', order?.company_id],
    queryFn: () => base44.entities.Location.filter({ company_id: order.company_id }),
    enabled: !!order?.company_id && open,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-reservation', order?.company_id],
    queryFn: () => base44.entities.Warehouse.filter({ company_id: order.company_id }),
    enabled: !!order?.company_id && open,
  });

  const reserveMutation = useMutation({
    mutationFn: async () => {
      for (const item of items) {
        const res = reservations[item.id];
        if (!res || !res.location_id || !res.qty || res.qty <= 0) continue;

        // Buscar saldo da localização
        const balance = stockBalances.find(
          b => b.product_id === item.product_id && b.location_id === res.location_id
        );

        if (!balance) {
          throw new Error(`Saldo não encontrado para ${item.product_name} na localização selecionada`);
        }
        if ((balance.qty_available || 0) < res.qty) {
          throw new Error(`Estoque insuficiente para ${item.product_name}. Disponível: ${balance.qty_available}, Solicitado: ${res.qty}`);
        }

        // Atualizar saldo
        await base44.entities.StockBalance.update(balance.id, {
          qty_available: (balance.qty_available || 0) - res.qty,
          qty_reserved: (balance.qty_reserved || 0) + res.qty,
        });

        // Criar registro de reserva
        await base44.entities.Reservation.create({
          company_id: order.company_id,
          order_id: order.id,
          order_item_id: item.id,
          product_id: item.product_id,
          qty: res.qty,
          warehouse_id: res.warehouse_id,
          location_id: res.location_id,
          status: 'RESERVADA',
        });

        // Atualizar item do pedido
        await base44.entities.SalesOrderItem.update(item.id, {
          qty_reserved: (item.qty_reserved || 0) + res.qty,
        });
      }

      // Atualizar status do pedido
      await base44.entities.SalesOrder.update(order.id, { status: 'RESERVADO' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', order.id] });
      queryClient.invalidateQueries({ queryKey: ['sales-order-items', order.id] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast.success('Estoque reservado com sucesso!');
      setReservations({});
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const getLocationsForProduct = (productId) => {
    const productBalances = stockBalances.filter(
      b => b.product_id === productId && (b.qty_available || 0) > 0
    );
    return productBalances.map(b => {
      const location = locations.find(l => l.id === b.location_id);
      const warehouse = warehouses.find(w => w.id === b.warehouse_id);
      return {
        balance: b,
        location,
        warehouse,
        label: location ? location.barcode : b.location_id,
        warehouseName: warehouse?.name || b.warehouse_id,
        available: b.qty_available || 0,
      };
    });
  };

  const setItemReservation = (itemId, field, value) => {
    setReservations(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [field]: value },
    }));
  };

  const handleLocationChange = (item, locationId) => {
    const balance = stockBalances.find(
      b => b.product_id === item.product_id && b.location_id === locationId
    );
    setReservations(prev => ({
      ...prev,
      [item.id]: {
        location_id: locationId,
        warehouse_id: balance?.warehouse_id || '',
        qty: Math.min(item.qty - (item.qty_reserved || 0), balance?.qty_available || 0),
      },
    }));
  };

  const pendingItems = items?.filter(i => (i.qty_reserved || 0) < i.qty) || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-600" />
            Reservar Estoque — {order?.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {pendingItems.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              Todos os itens já foram reservados.
            </div>
          ) : (
            pendingItems.map(item => {
              const locationOptions = getLocationsForProduct(item.product_id);
              const res = reservations[item.id] || {};
              const qtyPending = item.qty - (item.qty_reserved || 0);

              return (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{item.product_name}</p>
                      <p className="text-xs text-slate-500 font-mono">{item.product_sku}</p>
                    </div>
                    <Badge variant="outline">Pendente: {qtyPending}</Badge>
                  </div>

                  {locationOptions.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      Sem estoque disponível para este produto
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Localização</Label>
                        <Select
                          value={res.location_id || ''}
                          onValueChange={(v) => handleLocationChange(item, v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar localização..." />
                          </SelectTrigger>
                          <SelectContent>
                            {locationOptions.map(opt => (
                              <SelectItem key={opt.balance.id} value={opt.balance.location_id}>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3 text-slate-400" />
                                  <span className="font-mono">{opt.label}</span>
                                  <span className="text-slate-400 text-xs">({opt.warehouseName})</span>
                                  <Badge variant="outline" className="text-xs ml-1">
                                    Disp: {opt.available}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Quantidade a Reservar</Label>
                        <Input
                          type="number"
                          min={0}
                          max={Math.min(
                            qtyPending,
                            stockBalances.find(b => b.product_id === item.product_id && b.location_id === res.location_id)?.qty_available || 0
                          )}
                          step="0.01"
                          value={res.qty || ''}
                          onChange={(e) => setItemReservation(item.id, 'qty', parseFloat(e.target.value) || 0)}
                          disabled={!res.location_id}
                          placeholder="Qtd"
                        />
                        {res.location_id && (
                          <p className="text-xs text-slate-400">
                            Disponível: {stockBalances.find(b => b.product_id === item.product_id && b.location_id === res.location_id)?.qty_available || 0}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => reserveMutation.mutate()}
            disabled={reserveMutation.isPending || pendingItems.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {reserveMutation.isPending ? 'Reservando...' : 'Confirmar Reserva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}