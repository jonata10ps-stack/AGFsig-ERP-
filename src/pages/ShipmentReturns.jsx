import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Search, RotateCcw, CheckCircle, Package, ArrowRight, 
  Calendar, User, FileText, AlertCircle, Loader2, Warehouse as WarehouseIcon,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCompanyId } from '@/components/useCompanyId';
import { executeInventoryTransaction } from '@/utils/inventoryTransactionUtils';
import WarehouseSearchSelect from '@/components/warehouses/WarehouseSearchSelect';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from "@/components/ui/progress";

export default function ShipmentReturns() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnQtys, setReturnQtys] = useState({});
  const [targetWarehouseId, setTargetWarehouseId] = useState('');

  const { data: shipments, isLoading } = useQuery({
    queryKey: ['shipments-for-return', companyId],
    queryFn: async () => {
      const all = await base44.entities.SalesOrder.filter({ 
        company_id: companyId, 
        is_shipment: true,
        requires_return: true
      }, '-created_date', 300);
      
      return (all || []).filter(s => 
        ['EXPEDIDO', 'FATURADO'].includes(s.status) && 
        s.return_status !== 'RETORNADO'
      );
    },
    enabled: !!companyId,
  });

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['shipment-items-return', selectedShipment?.id],
    queryFn: async () => {
      if (!selectedShipment) return [];
      return base44.entities.SalesOrderItem.filter({ order_id: selectedShipment.id });
    },
    enabled: !!selectedShipment,
  });

  const returnMutation = useMutation({
    mutationFn: async ({ shipment, returnData, warehouseId }) => {
      if (shipment.moves_stock && !warehouseId) {
        throw new Error('Selecione um armazém de destino para o retorno de estoque.');
      }

      let allReturned = true;
      
      for (const item of items) {
        const qtyRequested = parseFloat(item.qty) || 0;
        const currentReturned = parseFloat(item.qty_returned) || 0;
        const qtyToReturn = parseFloat(returnData[item.id]) || 0;
        
        if (qtyToReturn <= 0) {
          if (currentReturned < qtyRequested) {
            allReturned = false;
          }
          continue;
        }

        const newTotalReturned = currentReturned + qtyToReturn;
        if (newTotalReturned > qtyRequested + 0.0001) {
          throw new Error(`Quantidade superior ao saldo pendente para o item ${item.product_sku}`);
        }

        if (shipment.moves_stock) {
          await executeInventoryTransaction({
            type: 'ENTRADA',
            product_id: item.product_id,
            qty: qtyToReturn,
            to_warehouse_id: warehouseId,
            related_type: 'PEDIDO',
            related_id: shipment.id,
            reason: `Retorno de remessa ${shipment.order_number}`
          }, companyId);
        }

        await base44.entities.SalesOrderItem.update(item.id, {
          qty_returned: newTotalReturned
        });

        if (newTotalReturned < qtyRequested) {
          allReturned = false;
        }
      }

      await base44.entities.SalesOrder.update(shipment.id, {
        return_status: allReturned ? 'RETORNADO' : 'PARCIAL'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments-for-return', companyId] });
      queryClient.invalidateQueries({ queryKey: ['shipment-items-return', selectedShipment?.id] });
      setReturnDialogOpen(false);
      setReturnQtys({});
      setTargetWarehouseId('');
      toast.success('Retorno processado com sucesso');
    },
    onError: (err) => {
      toast.error('Erro ao processar retorno: ' + err.message);
    }
  });

  const handleOpenReturn = (shipment) => {
    setSelectedShipment(shipment);
    setReturnDialogOpen(true);
    setTargetWarehouseId('');
    setReturnQtys({});
  };

  const filtered = shipments?.filter(s =>
    s.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Controle de Retornos</h1>
          <p className="text-slate-500">Gerencie a devolução de remessas pendentes</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-lg">
          <Info className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-medium text-amber-700">
            {shipments?.length || 0} remessas aguardando retorno
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por número ou destinatário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)
        ) : filtered?.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
            <RotateCcw className="h-12 w-12 mx-auto text-slate-200 mb-4" />
            <p className="text-slate-500 font-medium">Nenhum retorno pendente encontrado</p>
          </div>
        ) : (
          filtered?.map((shipment) => (
            <Card 
              key={shipment.id} 
              className="group hover:shadow-lg transition-all border-slate-200 overflow-hidden" 
            >
              <CardHeader className="pb-3 bg-slate-50/50">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-indigo-600 font-bold bg-white px-2 py-0.5 rounded border border-indigo-100">
                    {shipment.order_number}
                  </span>
                  <Badge className={shipment.return_status === 'PARCIAL' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}>
                    {shipment.return_status === 'PARCIAL' ? 'Retorno Parcial' : 'Pendente'}
                  </Badge>
                </div>
                <CardTitle className="text-sm font-bold text-slate-800 mt-2 line-clamp-1">{shipment.client_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {shipment.updated_at ? format(new Date(shipment.updated_at), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Package className="h-3.5 w-3.5" />
                    {shipment.moves_stock ? 'Move Estoque' : 'Admin'}
                  </div>
                </div>
                
                <Separator className="bg-slate-100" />
                
                <Button 
                  size="sm" 
                  onClick={() => handleOpenReturn(shipment)}
                  className="w-full bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 shadow-sm transition-all"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-2" />
                  Registrar Retorno
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <DialogTitle className="text-xl flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-indigo-400" />
              Retorno de Remessa - {selectedShipment?.order_number}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Destinatário</p>
                <p className="text-sm font-semibold text-slate-900">{selectedShipment?.client_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Tipo de Controle</p>
                <Badge className={selectedShipment?.moves_stock ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}>
                  {selectedShipment?.moves_stock ? 'Impacta Estoque (ENTRADA)' : 'Apenas Administrativo'}
                </Badge>
              </div>
            </div>

            {selectedShipment?.moves_stock && (
              <div className="space-y-3">
                <WarehouseSearchSelect
                  label="Armazém de Destino *"
                  placeholder="Selecione o armazém que receberá os itens..."
                  value={targetWarehouseId}
                  onSelect={setTargetWarehouseId}
                  required
                />
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 ml-1">
                  <AlertCircle className="h-3 w-3" />
                  Os itens retornados gerarão uma entrada no estoque deste armazém.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Package className="h-4 w-4 text-indigo-500" />
                Itens para Retorno
              </Label>
              <div className="border rounded-xl shadow-sm overflow-hidden bg-white">
                <div className="grid grid-cols-12 gap-2 p-3 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b">
                  <div className="col-span-6 text-left">Produto</div>
                  <div className="col-span-3 text-center">Resumo de Retorno</div>
                  <div className="col-span-3 text-right">Qtd Retornar</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {loadingItems ? (
                    <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></div>
                  ) : items?.map((item) => {
                    const total = parseFloat(item.qty) || 0;
                    const returned = parseFloat(item.qty_returned) || 0;
                    const pending = total - returned;
                    const progress = (returned / total) * 100;
                    
                    if (pending <= 0) return null;

                    return (
                      <div key={item.id} className="grid grid-cols-12 gap-2 p-4 items-center group hover:bg-slate-50/50 transition-colors">
                        <div className="col-span-6 pr-2">
                          <p className="font-bold text-sm text-slate-900 line-clamp-1">{item.product_name}</p>
                          <p className="text-[11px] text-slate-500 font-mono uppercase">{item.product_sku}</p>
                        </div>
                        <div className="col-span-3 space-y-1.5 px-2">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-slate-400">{Math.round(progress)}%</span>
                            <span className="text-indigo-600">{returned} / {total} un</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>
                        <div className="col-span-3">
                          <div className="relative">
                             <Input
                              type="number"
                              max={pending}
                              min={0}
                              placeholder={`Até ${pending}`}
                              value={returnQtys[item.id] || ''}
                              onChange={(e) => setReturnQtys({ ...returnQtys, [item.id]: e.target.value })}
                              className="text-right h-9 font-bold bg-white border-slate-200 focus:ring-indigo-500 pr-8"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">un</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex items-center justify-between">
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)} className="border-slate-200">
              Cancelar
            </Button>
            <Button 
              onClick={() => returnMutation.mutate({ shipment: selectedShipment, returnData: returnQtys, warehouseId: targetWarehouseId })}
              disabled={returnMutation.isPending || items?.length === 0 || (selectedShipment?.moves_stock && !targetWarehouseId)}
              className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100"
            >
              {returnMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Retorno
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
