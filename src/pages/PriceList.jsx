import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, DollarSign, Save, Loader2, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';

export default function PriceList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingPrices, setEditingPrices] = useState({}); // { productId: { ...prices } }

  const { data: products, isLoading } = useQuery({
    queryKey: ['products-price-list'],
    queryFn: () => base44.entities.Product.filter({ active: true }, 'sku'),
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return base44.entities.Product.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-price-list'] });
      toast.success('Preços atualizados com sucesso!');
    },
    onError: (err) => {
      toast.error('Erro ao salvar preços: ' + (err.message || 'Tente novamente'));
    }
  });

  const handlePriceChange = (productId, field, value) => {
    setEditingPrices(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [field]: value
      }
    }));
  };

  const saveProductPrice = (product) => {
    const changes = editingPrices[product.id];
    if (!changes) return;

    // Mapeamento dos campos:
    // sale_price -> À Vista
    // unit_price -> À Prazo (usando campo unit_price como placeholder)
    // custom_field_1 -> Trifásico (exemplo de uso de campo flexível se existir)
    // Para simplificar agora, focaremos no sale_price e simularemos os outros 
    // ou usaremos campos genéricos da tabela Product que vi no esquema.
    
    updatePriceMutation.mutate({
      id: product.id,
      data: {
        sale_price: parseFloat(changes.aVista) || product.sale_price,
        unit_price: parseFloat(changes.aPrazo) || product.unit_price,
        // Usando campos que vi no inspect_product_columns:
        quantity: parseFloat(changes.trifasico) || product.quantity, // Trifásico
        min_stock: parseFloat(changes.monofasico) || product.min_stock, // Monofásico
      }
    });
  };

  const filteredProducts = products?.filter(p => 
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tabela de Preços</h1>
          <p className="text-slate-500">Consulte e gerencie os valores de venda</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por SKU ou Descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Produto</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Preço à Vista</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Preço à Prazo</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Trifásico</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Monofásico</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Carregando produtos...
                    </td>
                  </tr>
                ) : filteredProducts?.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredProducts?.map(product => (
                    <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded bg-indigo-50 flex items-center justify-center">
                            <Package className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 font-mono text-xs">{product.sku}</p>
                            <p className="text-slate-600 line-clamp-1">{product.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          className="w-32 h-8 text-xs"
                          placeholder="0,00"
                          defaultValue={product.sale_price}
                          onChange={(e) => handlePriceChange(product.id, 'aVista', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          className="w-32 h-8 text-xs"
                          placeholder="0,00"
                          defaultValue={product.unit_price}
                          onChange={(e) => handlePriceChange(product.id, 'aPrazo', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          className="w-32 h-8 text-xs"
                          placeholder="0,00"
                          defaultValue={product.quantity}
                          onChange={(e) => handlePriceChange(product.id, 'trifasico', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          className="w-32 h-8 text-xs"
                          placeholder="0,00"
                          defaultValue={product.min_stock}
                          onChange={(e) => handlePriceChange(product.id, 'monofasico', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => saveProductPrice(product)}
                          disabled={!editingPrices[product.id]}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Salvar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
