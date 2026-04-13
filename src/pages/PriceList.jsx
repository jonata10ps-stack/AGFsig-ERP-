import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, DollarSign, Save, Loader2, Package, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';

export default function PriceList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingPrices, setEditingPrices] = useState({});

  // 1. Busca produtos que já estão na "Tabela de Preços" (com algum preço setado)
  const { data: products, isLoading } = useQuery({
    queryKey: ['products-price-list'],
    queryFn: async () => {
      const all = await base44.entities.Product.listAll({ active: true }, 'sku');
      // Filtra apenas produtos que tenham algum dos preços preenchidos (> 0)
      return all.filter(p => (p.sale_price > 0 || p.unit_price > 0 || p.quantity > 0 || p.min_stock > 0));
    },
  });

  // 2. Busca para ADICIONAR novos produtos (busca em todo o catálogo)
  const { data: searchResults } = useQuery({
    queryKey: ['product-catalog-search', productSearch],
    queryFn: () => {
      if (!productSearch || productSearch.length < 2) return [];
      return base44.entities.Product.queryPaginated(
        { active: true }, 
        'sku', 
        10, 
        0, 
        ['sku', 'name'], 
        productSearch
      ).then(res => res.data);
    },
    enabled: productSearch.length >= 2
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return base44.entities.Product.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-price-list'] });
      toast.success('Produto registrado na tabela de preços!');
      setIsAdding(false);
      setProductSearch('');
    },
    onError: (err) => {
      toast.error('Erro ao salvar: ' + (err.message || 'Tente novamente'));
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

  const saveProductPrice = (product, initialData = null) => {
    const changes = initialData || editingPrices[product.id];
    if (!changes) return;

    updatePriceMutation.mutate({
      id: product.id,
      data: {
        sale_price: parseFloat(changes.aVista) ?? product.sale_price,
        unit_price: parseFloat(changes.aPrazo) ?? product.unit_price,
        quantity: parseFloat(changes.trifasico) ?? product.quantity,
        min_stock: parseFloat(changes.monofasico) ?? product.min_stock,
      }
    });
  };

  const filteredItems = products?.filter(p => 
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestão de Preços</h1>
          <p className="text-slate-500 mt-1 text-base">Produtos selecionados para a lista comercial</p>
        </div>
        <Button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all active:scale-95"
        >
          {isAdding ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {isAdding ? 'cancelar' : 'Lançar Novo Produto'}
        </Button>
      </div>

      {isAdding && (
        <Card className="border-indigo-100 bg-indigo-50/30 overflow-hidden animate-in fade-in slide-in-from-top-4">
          <CardHeader className="pb-3 px-6 pt-6">
            <h3 className="font-bold text-indigo-900">Buscar Produto no Catálogo</h3>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Digite SKU ou Nome para buscar no estoque..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10 h-12 bg-white border-indigo-200 focus:ring-indigo-500"
              />
            </div>
            
            {searchResults && searchResults.length > 0 && (
              <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden divide-y">
                {searchResults.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-bold text-indigo-600">{p.sku}</span>
                      <span className="font-medium text-slate-900">{p.name}</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      onClick={() => saveProductPrice(p, { aVista: 0.01 })} // Inicia com valor simbólico para entrar na lista
                    >
                      Selecionar para Tabela
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-xl border-slate-200 overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 py-4 px-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Filtro rápido na lista de preços..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-50 border-none focus:bg-white transition-all"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left">Produto</th>
                  <th className="px-6 py-4 text-left">À Vista</th>
                  <th className="px-6 py-4 text-left">À Prazo</th>
                  <th className="px-6 py-4 text-left">Trifásico</th>
                  <th className="px-6 py-4 text-left">Monofásico</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y border-t border-slate-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="py-20 text-center text-slate-400">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-indigo-500" />
                      Sincronizando tabela de preços...
                    </td>
                  </tr>
                ) : filteredItems?.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-20 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-10 w-10 text-slate-200" />
                        <p className="text-slate-500 font-medium">Nenhum produto precificado ainda.</p>
                        <p className="text-slate-400 text-xs">Use o botão "Lançar Novo Produto" acima.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems?.map(product => (
                    <tr key={product.id} className="group hover:bg-slate-50/80 transition-all">
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-0.5 min-w-[200px]">
                          <span className="font-mono text-[10px] font-black text-slate-400 uppercase tracking-tighter">{product.sku}</span>
                          <span className="font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="relative w-32 group-hover:scale-105 transition-transform">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold italic">R$</span>
                          <Input
                            type="number"
                            className="pl-8 h-9 text-sm font-semibold border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                            defaultValue={product.sale_price}
                            onChange={(e) => handlePriceChange(product.id, 'aVista', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="relative w-32 group-hover:scale-105 transition-transform">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold italic">R$</span>
                          <Input
                            type="number"
                            className="pl-8 h-9 text-sm font-semibold border-slate-200"
                            defaultValue={product.unit_price}
                            onChange={(e) => handlePriceChange(product.id, 'aPrazo', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="relative w-32 group-hover:scale-105 transition-transform">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold italic">R$</span>
                          <Input
                            type="number"
                            className="pl-8 h-9 text-sm font-semibold border-slate-200"
                            defaultValue={product.quantity}
                            onChange={(e) => handlePriceChange(product.id, 'trifasico', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="relative w-32 group-hover:scale-105 transition-transform">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold italic">R$</span>
                          <Input
                            type="number"
                            className="pl-8 h-9 text-sm font-semibold border-slate-200"
                            defaultValue={product.min_stock}
                            onChange={(e) => handlePriceChange(product.id, 'monofasico', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <Button
                          size="sm"
                          className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 shadow-sm opacity-0 group-hover:opacity-100 transition-all border-none text-white"
                          onClick={() => saveProductPrice(product)}
                          disabled={!editingPrices[product.id]}
                        >
                          <Save className="h-4 w-4 mr-2 text-white" />
                          Aplicar
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
