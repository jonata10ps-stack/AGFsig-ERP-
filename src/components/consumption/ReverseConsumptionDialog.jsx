import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReverseConsumptionDialog({
  open,
  onOpenChange,
  consumptionItem,
  bomDelivery,
  companyId,
}) {
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState('');
  const [reverseQuantity, setReverseQuantity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-reverse', companyId],
    queryFn: () => companyId ? base44.entities.Warehouse.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: open && !!companyId,
  });

  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ['locations-reverse', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.Location.filter({ company_id: companyId });
    },
    enabled: open && !!companyId,
  });

  const getLocationDescription = (location) => {
    const locationParts = [location.rua, location.modulo, location.nivel, location.posicao].filter(Boolean);
    const locationDesc = locationParts.length > 0 ? locationParts.join(' / ') : location.barcode || 'Sem descrição';
    const warehouse = warehouses.find(w => w.id === location.warehouse_id);
    return warehouse ? `${warehouse.name} - ${locationDesc}` : locationDesc;
  };

  const reverseConsumptionMutation = useMutation({
    mutationFn: async () => {
      const debugInfo = `ID: ${consumptionItem.id} | BOM: ${consumptionItem.from_bom_delivery} | Material: ${consumptionItem.from_material_consumption} | Move: ${consumptionItem.from_inventory_move}`;
      toast.info(debugInfo);
      
      if (!selectedLocation) {
        throw new Error('Selecione uma localização');
      }
      if (!reverseQuantity || parseFloat(reverseQuantity) <= 0) {
        throw new Error('Digite uma quantidade válida');
      }
      if (parseFloat(reverseQuantity) > consumptionItem.qty) {
        throw new Error(`Quantidade não pode exceder ${consumptionItem.qty}`);
      }

      const qty = parseFloat(reverseQuantity);

       // Extract real ID properly
       let realId = consumptionItem.id;
       if (consumptionItem.id?.includes('-')) {
         const parts = consumptionItem.id.split('-');
         const prefix = parts[0];
         realId = parts.slice(1).join('-');

         console.log('🔄 Estorno com prefixo:', {
           original: consumptionItem.id,
           prefix,
           realId,
           from_bom_delivery: consumptionItem.from_bom_delivery,
           from_material_consumption: consumptionItem.from_material_consumption,
           from_inventory_move: consumptionItem.from_inventory_move,
         });

         if (prefix === 'bom' && consumptionItem.from_bom_delivery) {
           console.log('📦 Revertendo BOM Delivery ID:', realId);
           // Buscar o registro correto pelo realId (não pelo find genérico)
           const bomRecord = await base44.entities.BOMDeliveryControl.filter({ company_id: companyId }).then(all => all.find(b => b.id === realId));
           const targetBOM = bomRecord || bomDelivery;
           if (targetBOM) {
             const newDelivered = Math.max(0, (targetBOM.qty_delivered || 0) - qty);
             await base44.entities.BOMDeliveryControl.update(targetBOM.id, {
               qty_delivered: newDelivered,
               qty_pending: (targetBOM.qty_required || 0) - newDelivered,
               status: newDelivered >= (targetBOM.qty_required || 0) ? 'ENTREGUE' : 'ABERTO'
             });
           }
           // NÃO criar OPConsumptionControl aqui — este item vem do BOMDelivery diretamente
         } else if (prefix === 'material' && consumptionItem.from_material_consumption) {
           console.log('📋 Revertendo MaterialConsumption...');
           if (qty === consumptionItem.qty) {
             await base44.entities.MaterialConsumption.delete(realId);
           } else {
             await base44.entities.MaterialConsumption.update(realId, {
               qty_consumed: consumptionItem.qty - qty,
             });
           }
         } else if (prefix === 'move' && consumptionItem.from_inventory_move) {
           // Usar inventory_move_id direto (mais confiável que parsear o ID prefixado)
           const moveId = consumptionItem.inventory_move_id || realId;
           console.log('🚚 Deletando InventoryMove:', moveId);
           await base44.entities.InventoryMove.delete(moveId);
           // Deletar apenas o OPConsumptionControl que aponta exatamente para este move
           const opConsumptions = await base44.entities.OPConsumptionControl.filter({
             company_id: companyId,
             inventory_move_id: moveId,
           });
           console.log(`🗑️ Deletando ${opConsumptions.length} OPConsumptionControl(s)`);
           for (const oc of opConsumptions) {
             await base44.entities.OPConsumptionControl.delete(oc.id);
           }
         } else if (prefix === 'op') {
           console.log('🗑️ Deletando/atualizando OPConsumptionControl:', realId);
           if (qty >= consumptionItem.qty) {
             await base44.entities.OPConsumptionControl.delete(realId);
             // Se existe InventoryMove vinculado, deletar também para não reaparecer na lista
             if (consumptionItem.inventory_move_id) {
               console.log('🚚 Deletando InventoryMove vinculado:', consumptionItem.inventory_move_id);
               await base44.entities.InventoryMove.delete(consumptionItem.inventory_move_id);
             }
           } else {
             await base44.entities.OPConsumptionControl.update(realId, {
               qty: consumptionItem.qty - qty,
             });
           }
         }
       } else {
         // Sem prefixo - deveria ser OPConsumptionControl
         console.log('⚠️ ID sem prefixo:', realId);
         if (qty >= consumptionItem.qty) {
           await base44.entities.OPConsumptionControl.delete(realId);
           if (consumptionItem.inventory_move_id) {
             await base44.entities.InventoryMove.delete(consumptionItem.inventory_move_id);
           }
         } else {
           await base44.entities.OPConsumptionControl.update(realId, {
             qty: consumptionItem.qty - qty,
           });
         }
       }

      // 2. Reverter o inventário (criar movimento de entrada)
      const selectedLocationData = locations.find(l => l.id === selectedLocation);
      const warehouseId = selectedLocationData?.warehouse_id;

      // Criar movimento de entrada no kardex
      await base44.entities.InventoryMove.create({
        company_id: companyId,
        type: 'ENTRADA',
        product_id: consumptionItem.consumed_product_id,
        qty: qty,
        from_warehouse_id: null,
        from_location_id: null,
        to_warehouse_id: warehouseId,
        to_location_id: selectedLocation,
        related_type: 'OP',
        related_id: consumptionItem.op_id,
        reason: `Estorno do consumo da OP ${consumptionItem.op_number}`,
      });

      // 3. Atualizar saldo em estoque
      const stockBalances = await base44.entities.StockBalance.filter({
        company_id: companyId,
        product_id: consumptionItem.consumed_product_id,
        warehouse_id: warehouseId,
        location_id: selectedLocation,
      });

      if (stockBalances.length > 0) {
        const balance = stockBalances[0];
        await base44.entities.StockBalance.update(balance.id, {
          qty_available: (balance.qty_available || 0) + qty,
        });
      } else {
        await base44.entities.StockBalance.create({
          company_id: companyId,
          product_id: consumptionItem.consumed_product_id,
          warehouse_id: warehouseId,
          location_id: selectedLocation,
          qty_available: qty,
          qty_reserved: 0,
          qty_separated: 0,
        });
      }
    },
    onSuccess: () => {
      console.log('✅ Estorno concluído com sucesso!');
      toast.success(`Estorno realizado!`);
      
      // Aguarda um pouco antes de refetch para garantir que o backend processou
      setTimeout(() => {
        Promise.all([
          queryClient.refetchQueries({ queryKey: ['op-consumption-controls'] }),
          queryClient.refetchQueries({ queryKey: ['bom-delivery-controls'] }),
          queryClient.refetchQueries({ queryKey: ['material-consumptions'] }),
          queryClient.refetchQueries({ queryKey: ['inventory-moves-to-op'] }),
          queryClient.refetchQueries({ queryKey: ['stock-balances'] }),
          queryClient.refetchQueries({ queryKey: ['inventory-moves'] }),
        ]).then(() => {
          console.log('✅ Dados recarregados');
          setIsSubmitting(false);
          onOpenChange(false);
          setSelectedLocation('');
          setReverseQuantity('');
        });
      }, 500);
    },
    onError: (error) => {
      console.error('❌ Erro no estorno:', error);
      setIsSubmitting(false);
      toast.error(`Erro: ${error.message || 'Falha ao estornar'}`);
    },
  });

  const handleReverse = () => {
    // Guard duplo: state + mutation isPending
    if (isSubmitting || reverseConsumptionMutation.isPending) return;
    setIsSubmitting(true);
    reverseConsumptionMutation.mutate();
  };

  const handleOpenChange = (newOpen) => {
    if (!newOpen) {
      // Resetar estado quando fechar
      setSelectedLocation('');
      setReverseQuantity('');
      setIsSubmitting(false);
    }
    onOpenChange(newOpen);
  };

  if (!consumptionItem) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Estornar Consumo</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item Details */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-slate-500">Produto</p>
              <p className="font-medium text-slate-900">{consumptionItem?.consumed_product_name || '-'}</p>
              <p className="text-xs text-slate-600 mt-1">SKU: {consumptionItem?.consumed_product_sku || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Quantidade Consumida</p>
              <p className="text-lg font-bold text-slate-900">{consumptionItem?.qty || '-'} un</p>
            </div>
            {(consumptionItem?.warehouse_name || consumptionItem?.location_description) && (
              <div>
                <p className="text-xs text-slate-500">Localização de Origem</p>
                <p className="text-xs text-slate-700">
                  {consumptionItem?.warehouse_name && <span>{consumptionItem.warehouse_name}</span>}
                  {consumptionItem?.warehouse_name && consumptionItem?.location_description && <span> • </span>}
                  {consumptionItem?.location_description && <span>{consumptionItem.location_description}</span>}
                </p>
              </div>
            )}
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <label htmlFor="reverse-qty" className="text-sm font-medium text-slate-700">
              Quantidade a Estornar *
            </label>
            <input
              id="reverse-qty"
              type="number"
              min="0.01"
              max={consumptionItem.qty}
              step="0.01"
              value={reverseQuantity}
              onChange={(e) => setReverseQuantity(e.target.value)}
              placeholder="Digite a quantidade"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {reverseQuantity && parseFloat(reverseQuantity) > consumptionItem.qty && (
              <p className="text-xs text-red-600">Não pode exceder {consumptionItem.qty}</p>
            )}
          </div>

          {/* Location Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Localização para Retorno *
            </label>
            {locationsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma localização" />
                  </SelectTrigger>
                  <SelectContent>
                     {locations.map((location) => (
                       <SelectItem key={location.id} value={location.id}>
                         {getLocationDescription(location)}
                       </SelectItem>
                     ))}
                   </SelectContent>
                </Select>
                {selectedLocation && (
                  <p className="text-xs text-slate-600 mt-2 p-2 bg-slate-50 rounded">
                    {getLocationDescription(locations.find(l => l.id === selectedLocation))}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              O componente será devolvido ao estoque e liberado na lista de entrega da OP.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting || reverseConsumptionMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleReverse}
            disabled={!selectedLocation || !reverseQuantity || isSubmitting || reverseConsumptionMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isSubmitting || reverseConsumptionMutation.isPending ? 'Processando...' : 'Estornar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}