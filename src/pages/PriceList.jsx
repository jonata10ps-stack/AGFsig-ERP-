import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Search, DollarSign, Save, Loader2, Package, Plus, X, ShieldCheck, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';

export default function PriceList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingPrices, setEditingPrices] = useState({});
  const [canEdit, setCanEdit] = useState(false);

  // Verifica permissões (Admin ou se tem flag de gestor)
  useEffect(() => {
    if (user) {
      const isAdmin = String(user.role).toLowerCase() === 'admin';
      // Consideramos gestor quem for admin ou se tivermos acesso à empresa
      setCanEdit(isAdmin);
    }
  }, [user]);

  // 1. Busca OTIMIZADA: Agora pedimos ao Supabase apenas o que tem preço (> 0 ou != null)
  const { data: products, isLoading } = useQuery({
    queryKey: ['products-price-list-optimized'],
    queryFn: async () => {
      // Usamos uma query direta do Supabase para filtrar no servidor (muito mais rápido)
      const { data, error } = await supabase
        .from('Product')
        .select('*')
        .eq('active', true)
        .or('sale_price.gt.0,unit_price.gt.0,quantity.gt.0,min_stock.gt.0')
        .order('sku');
      
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Busca para ADICIONAR (limitada a 10 resultados para ser instantânea)
  const { data: searchResults } = useQuery({
    queryKey: ['product-catalog-search-fast', productSearch],
    queryFn: async () => {
      if (!productSearch || productSearch.length < 2) return [];
      const { data } = await supabase
        .from('Product')
        .select('*')
        .eq('active', true)
        .or(`sku.ilike.%${productSearch}%,name.ilike.%${productSearch}%`)
        .limit(8);
      return data || [];
    },
    enabled: productSearch.length >= 2
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return base44.entities.Product.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-price-list-optimized'] });
      toast.success('Alteração salva com sucesso!');
      setIsAdding(false);
      setProductSearch('');
    },
    onError: (err) => {
      toast.error('Erro ao salvar: ' + (err.message || 'Sem permissão'));
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
    if (!canEdit) return;
    const changes = initialData || editingPrices[product.id];
    if (!changes) return;

    updatePriceMutation.mutate({
      id: product.id,
      data: {
        sale_price: changes.aVista !== undefined ? parseFloat(changes.aVista) : product.sale_price,
        unit_price: changes.aPrazo !== undefined ? parseFloat(changes.aPrazo) : product.unit_price,
        quantity: changes.trifasico !== undefined ? parseFloat(changes.trifasico) : product.quantity,
        min_stock: changes.monofasico !== undefined ? parseFloat(changes.monofasico) : product.min_stock,
      }
    });
  };

  const filteredItems = products?.filter(p => 
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 lg:p-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Tabela de Preços</h1>
            {!canEdit && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase transition-all">
                <Eye className="h-3 w-3" /> Somente Visualização
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1 max-w-md">Consulte os valores comerciais vigentes para os produtos selecionados.</p>
        </div>
        
        {canEdit && (
          <Button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95 text-white"
          >
            {isAdding ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {isAdding ? 'Fechar Busca' : 'Adicionar Produto à Lista'}
          </Button>
        )}
      </div>

      {isAdding && canEdit && (
        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          <CardHeader className="pb-3 px-6 pt-6 flex flex-row items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
               <Search className="h-4 w-4 text-white" />
            </div>
            <h3 className="font-bold text-slate-900">Buscar no Catálogo Geral</h3>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Ex sugerido: Digite um SKU ou nome parcial..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-12 h-14 bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-xl text-lg transition-all"
                autoFocus
              />
            </div>
            
            {searchResults && searchResults.length > 0 && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                {searchResults.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-bold text-indigo-500">{p.sku}</span>
                      <span className="font-semibold text-slate-700 line-clamp-1">{p.name}</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="text-indigo-600 hover:bg-indigo-50 font-bold"
                      onClick={() => saveProductPrice(p, { aVista: 0.01 })}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Incluir
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {productSearch.length >= 2 && searchResults?.length === 0 && (
              <p className="mt-4 text-center text-slate-400 italic">Nenhum produto encontrado com este termo.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-2xl border-none ring-1 ring-slate-200 overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Filtrar nesta lista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-white border-slate-200 focus:ring-indigo-500"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-5 text-left">Produto</th>
                  <th className="px-6 py-5 text-left">À Vista</th>
                  <th className="px-6 py-5 text-left">À Prazo</th>
                  <th className="px-6 py-5 text-left">Trifásico</th>
                  <th className="px-6 py-5 text-left">Monofásico</th>
                  {canEdit && <th className="px-6 py-5 text-right">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                        <span className="text-slate-500 font-medium animate-pulse">Carregando preços...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems?.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-40">
                        <Package className="h-16 w-16 text-slate-300" />
                        <p className="text-slate-600 font-bold">Nenhum dado encontrado.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems?.map(product => (
                    <tr key={product.id} className="group hover:bg-indigo-50/30 transition-all duration-150">
                      <td className="px-6 py-5">
                        <div className="flex flex-col max-w-[280px]">
                          <span className="font-mono text-[10px] font-bold text-indigo-400">{product.sku}</span>
                          <span className="font-bold text-slate-800 leading-snug group-hover:text-indigo-700 transition-colors uppercase">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="relative w-32">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-black">R$</span>
                          <Input
                            type="number"
                            readOnly={!canEdit}
                            className={`pl-8 h-10 font-bold ${!canEdit ? 'bg-transparent border-transparent shadow-none' : 'bg-white border-slate-200'}`}
                            defaultValue={product.sale_price || 0}
                            onChange={(e) => handlePriceChange(product.id, 'aVista', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="relative w-32">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-black">R$</span>
                          <Input
                            type="number"
                            readOnly={!canEdit}
                            className={`pl-8 h-10 font-bold ${!canEdit ? 'bg-transparent border-transparent shadow-none' : 'bg-white border-slate-200'}`}
                            defaultValue={product.unit_price || 0}
                            onChange={(e) => handlePriceChange(product.id, 'aPrazo', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="relative w-32">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-black">R$</span>
                          <Input
                            type="number"
                            readOnly={!canEdit}
                            className={`pl-8 h-10 font-bold ${!canEdit ? 'bg-transparent border-transparent shadow-none' : 'bg-white border-slate-200'}`}
                            defaultValue={product.quantity || 0}
                            onChange={(e) => handlePriceChange(product.id, 'trifasico', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="relative w-32">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-black">R$</span>
                          <Input
                            type="number"
                            readOnly={!canEdit}
                            className={`pl-8 h-10 font-bold ${!canEdit ? 'bg-transparent border-transparent shadow-none' : 'bg-white border-slate-200'}`}
                            defaultValue={product.min_stock || 0}
                            onChange={(e) => handlePriceChange(product.id, 'monofasico', e.target.value)}
                          />
                        </div>
                      </td>
                      {canEdit && (
                        <td className="px-6 py-5 text-right">
                          <Button
                            size="sm"
                            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 shadow-md opacity-0 group-hover:opacity-100 transition-all text-white border-none"
                            onClick={() => saveProductPrice(product)}
                            disabled={!editingPrices[product.id] || updatePriceMutation.isLoading}
                          >
                            {updatePriceMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                            Salvar
                          </Button>
                        </td>
                      )}
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
