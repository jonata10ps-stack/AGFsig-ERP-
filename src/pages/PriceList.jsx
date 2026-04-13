import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Search, Save, Loader2, Package, Plus, X, ShieldCheck, Eye, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';

// Utilitário para formatar moeda brasileira
const formatBRL = (val) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val || 0);
};

// Utilitário para limpar máscara e converter para float
const parseCurrency = (val) => {
  if (typeof val === 'number') return val;
  const clean = val.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  return parseFloat(clean) || 0;
};

export default function PriceList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingPrices, setEditingPrices] = useState({});
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    if (user) {
      const isAdmin = String(user.role).toLowerCase() === 'admin';
      setCanEdit(isAdmin);
    }
  }, [user]);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products-price-list-grouped'],
    queryFn: async () => {
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
      queryClient.invalidateQueries({ queryKey: ['products-price-list-grouped'] });
      toast.success('Preços atualizados!');
      setIsAdding(false);
      setProductSearch('');
    },
    onError: (err) => {
      toast.error('Erro ao salvar: ' + (err.message || 'Sem permissão'));
    }
  });

  const handlePriceInputChange = (productId, field, value) => {
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
    const currentEdits = editingPrices[product.id] || {};
    const changes = initialData || currentEdits;
    if (!changes && !initialData) return;

    updatePriceMutation.mutate({
      id: product.id,
      data: {
        // Mapeamento:
        // Monofásico À Vista: sale_price
        // Monofásico À Prazo: unit_price
        // Trifásico À Vista: quantity
        // Trifásico À Prazo: min_stock
        sale_price: changes.monoVista !== undefined ? parseCurrency(changes.monoVista) : product.sale_price,
        unit_price: changes.monoPrazo !== undefined ? parseCurrency(changes.monoPrazo) : product.unit_price,
        quantity: changes.triVista !== undefined ? parseCurrency(changes.triVista) : product.quantity,
        min_stock: changes.triPrazo !== undefined ? parseCurrency(changes.triPrazo) : product.min_stock,
      }
    });
  };

  const filteredItems = products?.filter(p => 
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-4 lg:p-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
               Tabela Comercial
            </h1>
            {!canEdit && (
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest border border-slate-200">
                <Eye className="h-3 w-3 inline mr-1" /> Consulta
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1 font-medium">Valores de venda agrupados por configuração elétrica.</p>
        </div>
        
        {canEdit && (
          <Button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 font-bold px-6 py-6 rounded-xl transition-all active:scale-95 text-white"
          >
            {isAdding ? <X className="h-5 w-5 mr-2" /> : <Plus className="h-5 w-5 mr-2" />}
            {isAdding ? 'Sair da Busca' : 'Lançar Novo Item'}
          </Button>
        )}
      </div>

      {isAdding && canEdit && (
        <Card className="border-2 border-indigo-200 bg-white overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 rounded-2xl">
          <CardContent className="p-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
              <Input
                placeholder="Busque por SKU ou Descrição para adicionar à tabela..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-14 h-16 bg-slate-50 border-none rounded-xl text-xl focus:ring-4 focus:ring-indigo-100 transition-all font-medium"
                autoFocus
              />
            </div>
            
            {searchResults && searchResults.length > 0 && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-5 bg-white rounded-2xl border-2 border-slate-50 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all group">
                    <div>
                      <span className="font-black text-xs text-indigo-500 font-mono block mb-1">{p.sku}</span>
                      <span className="font-bold text-slate-900 group-hover:text-indigo-900 transition-colors uppercase text-sm line-clamp-1">{p.name}</span>
                    </div>
                    <Button 
                      size="sm" 
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                      onClick={() => saveProductPrice(p, { monoVista: '0,01' })}
                    >
                      Selecionar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-2xl border-none ring-1 ring-slate-200 overflow-hidden bg-white rounded-3xl">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-6 px-8">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Buscar nesta lista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-12 bg-white border-2 border-slate-50 rounded-xl focus:border-indigo-400 focus:ring-0 transition-all shadow-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-100">
                  <th className="px-8 py-4 text-left font-black">Produto</th>
                  <th colSpan="2" className="px-4 py-4 text-center bg-indigo-50/30 text-indigo-600 border-x border-slate-100">
                     Monofásico
                  </th>
                  <th colSpan="2" className="px-4 py-4 text-center bg-amber-50/30 text-amber-600 border-x border-slate-100">
                     Trifásico
                  </th>
                  {canEdit && <th className="px-8 py-4 text-right">Ação</th>}
                </tr>
                <tr className="bg-white text-[9px] uppercase font-bold text-slate-400 border-b border-slate-50">
                  <th className="px-8 py-2 text-left">Identificação</th>
                  <th className="px-4 py-2 text-center bg-indigo-50/10 text-indigo-400 italic">À Vista</th>
                  <th className="px-4 py-2 text-center bg-indigo-50/10 text-indigo-400 italic border-r border-slate-100">À Prazo</th>
                  <th className="px-4 py-2 text-center bg-amber-50/10 text-amber-400 italic">À Vista</th>
                  <th className="px-4 py-2 text-center bg-amber-50/10 text-amber-400 italic border-r border-slate-100">À Prazo</th>
                  {canEdit && <th className="px-8 py-2"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="py-32 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                        <span className="text-slate-400 font-bold tracking-widest animate-pulse">CARREGANDO TABELA...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems?.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="py-32 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-30">
                        <Package className="h-20 w-20 text-slate-300" />
                        <p className="text-slate-600 font-black text-xl">LISTA VAZIA</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems?.map(product => (
                    <tr key={product.id} className="group hover:bg-slate-50/80 transition-all duration-150">
                      <td className="px-8 py-6">
                        <div className="flex flex-col max-w-[300px]">
                          <span className="font-mono text-[10px] font-black text-indigo-400 mb-1">{product.sku}</span>
                          <span className="font-bold text-slate-900 leading-tight group-hover:text-indigo-700 transition-colors uppercase text-sm">{product.name}</span>
                        </div>
                      </td>
                      
                      {/* Monofásico inputs */}
                      <td className="px-4 py-6 bg-indigo-50/5">
                        <div className="relative w-36 mx-auto">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-300 italic">R$</span>
                          <Input
                            readOnly={!canEdit}
                            className={`pl-10 h-10 font-black text-right pr-3 ${!canEdit ? 'bg-transparent border-transparent shadow-none' : 'bg-white border-slate-200 rounded-xl shadow-sm'}`}
                            placeholder="0,00"
                            defaultValue={formatBRL(product.sale_price)}
                            onChange={(e) => handlePriceInputChange(product.id, 'monoVista', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-6 bg-indigo-50/5 border-r border-slate-100">
                        <div className="relative w-36 mx-auto">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-300 italic">R$</span>
                          <Input
                            readOnly={!canEdit}
                            className={`pl-10 h-10 font-black text-right pr-3 ${!canEdit ? 'bg-transparent border-transparent shadow-none' : 'bg-white border-slate-200 rounded-xl shadow-sm'}`}
                            placeholder="0,00"
                            defaultValue={formatBRL(product.unit_price)}
                            onChange={(e) => handlePriceInputChange(product.id, 'monoPrazo', e.target.value)}
                          />
                        </div>
                      </td>

                      {/* Trifásico inputs */}
                      <td className="px-4 py-6 bg-amber-50/5">
                        <div className="relative w-36 mx-auto">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-300 italic">R$</span>
                          <Input
                            readOnly={!canEdit}
                            className={`pl-10 h-10 font-black text-right pr-3 ${!canEdit ? 'bg-transparent border-transparent shadow-none' : 'bg-white border-slate-200 rounded-xl shadow-sm'}`}
                            placeholder="0,00"
                            defaultValue={formatBRL(product.quantity)}
                            onChange={(e) => handlePriceInputChange(product.id, 'triVista', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-6 bg-amber-50/5 border-r border-slate-100">
                        <div className="relative w-36 mx-auto">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-300 italic">R$</span>
                          <Input
                            readOnly={!canEdit}
                            className={`pl-10 h-10 font-black text-right pr-3 ${!canEdit ? 'bg-transparent border-transparent shadow-none' : 'bg-white border-slate-200 rounded-xl shadow-sm'}`}
                            placeholder="0,00"
                            defaultValue={formatBRL(product.min_stock)}
                            onChange={(e) => handlePriceInputChange(product.id, 'triPrazo', e.target.value)}
                          />
                        </div>
                      </td>

                      {canEdit && (
                        <td className="px-8 py-6 text-right">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all opacity-0 group-hover:opacity-100"
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
      
      <p className="text-[10px] text-slate-400 font-bold uppercase text-center tracking-[0.2em] pb-10">
         Sistema AGF - Gestão de Vendas v4.0
      </p>
    </div>
  );
}
