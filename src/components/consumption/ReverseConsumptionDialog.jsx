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
import { processProductionOrderControls } from '@/utils/productionControlUtils';
import { executeInventoryTransaction } from '@/utils/inventoryTransactionUtils';

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
      if (!selectedLocation) throw new Error('Selecione uma localização');
      if (!reverseQuantity || parseFloat(reverseQuantity) <= 0) throw new Error('Quantidade inválida');
      if (parseFloat(reverseQuantity) > (consumptionItem.qty + 0.0001)) throw new Error(`Máximo: ${consumptionItem.qty}`);

      const qty = parseFloat(reverseQuantity);
      const selectedLocationData = locations.find(l => l.id === selectedLocation);
      const warehouseId = selectedLocationData?.warehouse_id;

      // A sincronização de exclusão das tabelas OPConsumptionControl, BOMDeliveryControl
      // e MaterialConsumption será feita automaticamente pela função centralizada processProductionOrderControls.
      // 2. Centralizado: Criar Movimento e Atualizar Saldo (Garante consistência)
      const moveData = {
        company_id: companyId,
        type: 'PRODUCAO_REVERSO',
        product_id: consumptionItem.consumed_product_id,
        qty: qty,
        to_warehouse_id: warehouseId,
        to_location_id: selectedLocation,
        related_type: 'OP',
        related_id: consumptionItem.op_id,
        reason: `Estorno OP ${consumptionItem.op_number}`
      };

      const move = await executeInventoryTransaction(moveData, companyId);
      
      // Centralizado: Atualizar Controles de OP (BOM e Consumo)
      if (consumptionItem.op_id) {
        await processProductionOrderControls(moveData, companyId, move.id);
      }
    },
    onSuccess: () => {
      toast.success('Estorno realizado!');
      setTimeout(() => {
        setIsSubmitting(false);
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: ['op-consumption-controls'] });
        queryClient.invalidateQueries({ queryKey: ['bom-delivery-controls'] });
        queryClient.invalidateQueries({ queryKey: ['material-consumptions'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-moves-to-op'] });
        queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
        setSelectedLocation('');
        setReverseQuantity('');
      }, 500);
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast.error(`Erro: ${error.message}`);
    }
  });

  const handleReverse = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    reverseConsumptionMutation.mutate();
  };

  if (!consumptionItem) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if(!v) setIsSubmitting(false); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Estornar Consumo</DialogTitle></DialogHeader>
        <div className="space-y-6">
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-slate-500">Produto</p>
              <p className="font-medium text-slate-900">{consumptionItem.consumed_product_name}</p>
              <p className="text-xs text-slate-600">SKU: {consumptionItem.consumed_product_sku}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Qtd Consumida</p>
              <p className="text-lg font-bold">{consumptionItem.qty} un</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Qtd a Estornar *</label>
            <input
              type="number"
              value={reverseQuantity}
              onChange={(e) => setReverseQuantity(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Local para Retorno *</label>
            {locationsLoading ? <Skeleton className="h-9 w-full" /> : (
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                   {locations.map(l => <SelectItem key={l.id} value={l.id}>{getLocationDescription(l)}</SelectItem>)}
                 </SelectContent>
              </Select>
            )}
          </div>
          <div className="p-3 bg-blue-50 text-xs text-blue-800 rounded-lg">
            O componente será devolvido ao estoque e liberado na lista de entrega da OP automaticamente.
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleReverse} disabled={!selectedLocation || !reverseQuantity || isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white">
            {isSubmitting ? 'Processando...' : 'Confirmar Estorno'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}