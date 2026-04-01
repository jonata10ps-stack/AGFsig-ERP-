import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  ArrowLeft, Search, Trash2, Package, AlertCircle, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Reservations() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: reservations, isLoading } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => base44.entities.Reservation.list(),
  });

  const { data: orders } = useQuery({
    queryKey: ['sales-orders-for-reservations'],
    queryFn: () => base44.entities.SalesOrder.list(),
  });

  const { data: products } = useQuery({
    queryKey: ['products-for-reservations'],
    queryFn: () => base44.entities.Product.list(),
  });

  const cancelReservationMutation = useMutation({
    mutationFn: async (reservation) => {
      // Buscar saldo e liberar quantidade
      const balances = await base44.entities.StockBalance.filter({
        product_id: reservation.product_id,
        location_id: reservation.location_id
      });

      if (balances?.[0]) {
        await base44.entities.StockBalance.update(balances[0].id, {
          qty_reserved: Math.max(0, (balances[0].qty_reserved || 0) - reservation.qty),
          qty_available: (balances[0].qty_available || 0) + reservation.qty
        });
      }

      // Atualizar item do pedido
      const items = await base44.entities.SalesOrderItem.filter({ order_id: reservation.order_id });
      const item = items?.find(i => i.product_id === reservation.product_id);
      if (item) {
        await base44.entities.SalesOrderItem.update(item.id, {
          qty_reserved: Math.max(0, (item.qty_reserved || 0) - reservation.qty)
        });
      }

      // Deletar reserva
      await base44.entities.Reservation.delete(reservation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order-items'] });
      setDeleteConfirm(null);
      toast.success('Reserva cancelada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao cancelar reserva: ' + error.message);
    }
  });

  const filteredReservations = reservations?.filter(r => {
    const order = orders?.find(o => o.id === r.order_id);
    const product = products?.find(p => p.id === r.product_id);
    const searchLower = search.toLowerCase();
    
    return (
      order?.order_number?.toLowerCase().includes(searchLower) ||
      order?.client_name?.toLowerCase().includes(searchLower) ||
      product?.name?.toLowerCase().includes(searchLower) ||
      product?.sku?.toLowerCase().includes(searchLower)
    );
  });

  const getOrderInfo = (orderId) => {
    return orders?.find(o => o.id === orderId);
  };

  const getProductInfo = (productId) => {
    return products?.find(p => p.id === productId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Dashboard')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Reservas</h1>
          <p className="text-slate-500">Visualize e cancele reservas de estoque</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-600" />
            Reservas Ativas
            <Badge variant="outline">{filteredReservations?.length || 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Busque por pedido, cliente ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredReservations?.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhuma reserva encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations?.map((reservation) => {
                    const order = getOrderInfo(reservation.order_id);
                    const product = getProductInfo(reservation.product_id);

                    return (
                      <TableRow key={reservation.id}>
                        <TableCell className="font-mono text-indigo-600 font-medium">
                          {order?.order_number || `#${reservation.order_id.slice(0, 8)}`}
                        </TableCell>
                        <TableCell>{order?.client_name || '-'}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-mono text-sm text-slate-600">{product?.sku}</p>
                            <p className="text-sm font-medium">{product?.name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{reservation.qty}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {reservation.location_id || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {format(new Date(reservation.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(reservation)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Reserva</DialogTitle>
          </DialogHeader>
          {deleteConfirm && (
            <div className="space-y-4">
              <p className="text-slate-600">
                Tem certeza que deseja cancelar a reserva de <strong>{deleteConfirm.qty}</strong> unidade(s)?
              </p>
              <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Produto:</span>
                  <span className="font-medium">{getProductInfo(deleteConfirm.product_id)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Pedido:</span>
                  <span className="font-medium">{getOrderInfo(deleteConfirm.order_id)?.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Localização:</span>
                  <span className="font-medium">{deleteConfirm.location_id || '-'}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Manter Reserva
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelReservationMutation.mutate(deleteConfirm)}
              disabled={cancelReservationMutation.isPending}
            >
              {cancelReservationMutation.isPending ? 'Cancelando...' : 'Cancelar Reserva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}