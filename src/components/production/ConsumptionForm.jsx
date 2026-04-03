import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';
import { executeInventoryTransaction } from '@/utils/inventoryTransactionUtils';

export default function ConsumptionForm({ opId, opNumber, onSuccess }) {
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [items, setItems] = useState([]);

  const createConsumptionMutation = useMutation({
    mutationFn: async () => {
      if (!items.length) {
        throw new Error('Adicione pelo menos um item');
      }

      for (const item of items) {
        // Obter dados da OP
        const op = await base44.entities.ProductionOrder.filter({ id: opId });
        const opData = op?.[0];

        if (!opData) {
          throw new Error('OP não encontrada');
        }

        // Obter dados do produto consumido
        const product = await base44.entities.Product.filter({ id: item.product_id });
        const productData = product?.[0];

        // 1. Criar registro de consumo no controle
        await base44.entities.OPConsumptionControl.create({
          op_id: opId,
          op_number: opNumber,
          product_id: opData.product_id,
          product_name: opData.product_name,
          consumed_product_id: item.product_id,
          consumed_product_sku: productData?.sku || '',
          consumed_product_name: productData?.name || '',
          qty: item.quantity,
          op_status: opData.status,
          control_status: 'ABERTO'
        });

        // 2. Centralizado: Criar Movimento e Atualizar Saldo (Garante consistência e saldo não negativo)
        await executeInventoryTransaction({
          type: 'PRODUCAO_CONSUMO',
          product_id: item.product_id,
          qty: item.quantity,
          from_warehouse_id: null, // Buscará no armazém padrão se não informado, ou o usuário deveria informar?
          from_location_id: null,
          related_type: 'OP',
          related_id: opId,
          reason: `Consumo OP ${opNumber} - ${opData.product_name}`
        }, opData.company_id || '');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['op-consumption-controls'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-moves'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
      toast.success('Consumo registrado com sucesso');
      setItems([]);
      setSelectedProduct(null);
      setQuantity('');
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao registrar consumo');
    }
  });

  const handleAddItem = () => {
    if (!selectedProduct || !quantity) {
      toast.error('Selecione produto e quantidade');
      return;
    }

    const newItem = {
      id: Date.now(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      product_sku: selectedProduct.sku,
      quantity: parseFloat(quantity)
    };

    setItems([...items, newItem]);
    setSelectedProduct(null);
    setQuantity('');
  };

  const handleRemoveItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
        <CardTitle>Registrar Consumo</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Add item form */}
          <div className="p-4 bg-slate-50 rounded-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Produto a Consumir
              </label>
              <ProductSearchSelect
                value={selectedProduct?.id}
                onChange={setSelectedProduct}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Quantidade
                </label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleAddItem}
                  className="w-full bg-amber-600 hover:bg-amber-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-slate-900 text-sm">Itens para Registrar</h4>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm text-slate-900">
                      {item.product_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      SKU: {item.product_sku}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                      {item.quantity} un
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="pt-2 border-t flex justify-between items-center">
                <span className="font-medium text-slate-900">
                  Total: {totalQuantity} unidades
                </span>
              </div>
            </div>
          )}

          {/* Info box */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              Ao registrar, será criado um movimento de consumo que desconta automaticamente do saldo.
            </p>
          </div>

          {/* Submit button */}
          <Button
            onClick={() => createConsumptionMutation.mutate()}
            disabled={items.length === 0 || createConsumptionMutation.isPending}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {createConsumptionMutation.isPending ? 'Registrando...' : 'Registrar Consumo'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}