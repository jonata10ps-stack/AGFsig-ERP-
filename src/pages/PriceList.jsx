import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Search, Save, Loader2, Package, Plus, X, ShieldCheck, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';

const formatBRL = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0,00';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
};

const parseCurrency = (val) => {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return 0;
  let clean = val.trim();
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if ((clean.match(/\./g) || []).length > 1) {
    clean = clean.replace(/\./g, '');
  }
  const finalNum = parseFloat(clean);
  return isNaN(finalNum) ? 0 : finalNum;
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
      // Aceita admin, gestor ou qualquer papel similar para edição
      const role = String(user.role).toLowerCase();
      const isAllowed = ['admin', 'gestor', 'manager', 'diretoria'].some(r => role.includes(r));
      setCanEdit(isAllowed);
    }
  }, [user]);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products-price-list-smart', user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) return [];
      const { data, error } = await supabase
        .from('Product')
        .select('*')
        .eq('active', true)
        .or(`company_id.eq.${user.company_id},company_id.eq.00000000-0000-0000-0000-000000000000`)
        .or('sale_price.gt.0,unit_price.gt.0,quantity.gt.0,min_stock.gt.0')
        .order('sku');
      
      if (error) throw error;
      const uniqueMap = new Map();
      (data || []).forEach(p => {
        const skuKey = p.sku?.trim().toUpperCase();
        if (!skuKey) return;
        const existing = uniqueMap.get(skuKey);
        if (!existing || p.company_id === user.company_id) uniqueMap.set(skuKey, p);
      });
      return Array.from(uniqueMap.values());
    },
    enabled: !!user?.company_id
  });

  const { data: searchResults } = useQuery({
    queryKey: ['product-catalog-search-fast', productSearch, user?.company_id],
    queryFn: async () => {
      if (!productSearch || productSearch.length < 2 || !user?.company_id) return [];
      const { data } = await supabase
        .from('Product')
        .select('*')
        .eq('active', true)
        .or(`company_id.eq.${user.company_id},company_id.eq.00000000-0000-0000-0000-000000000000`)
        .or(`sku.ilike.%${productSearch}%,name.ilike.%${productSearch}%`)
        .limit(10);
      
      const uniqueMap = new Map();
      (data || []).forEach(p => {
        const skuKey = p.sku?.trim().toUpperCase();
        if (!skuKey) return;
        const existing = uniqueMap.get(skuKey);
        if (!existing || p.company_id === user.company_id) uniqueMap.set(skuKey, p);
      });
      return Array.from(uniqueMap.values());
    },
    enabled: productSearch.length >= 2 && !!user?.company_id
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return base44.entities.Product.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-price-list-smart'] });
      toast.success('Produto adicionado à lista!');
      setIsAdding(false);
      setProductSearch('');
    },
    onError: (err) => {
      toast.error('Erro: ' + (err.message || 'Verifique suas permissões'));
    }
  });

  const handlePriceBlur = (productId, field, value) => {
    const numericValue = parseCurrency(value);
    setEditingPrices(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [field]: numericValue }
    }));
    const input = document.getElementById(`input-${productId}-${field}`);
    if (input) input.value = formatBRL(numericValue);
  };

  const saveProductPrice = (product, initialData = null) => {
    if (!canEdit) {
      toast.error('Apenas gestores podem realizar esta ação.');
      return;
    }
    const changes = initialData || editingPrices[product.id];
    if (!changes) return;
    updatePriceMutation.mutate({
      id: product.id,
      data: {
        sale_price: changes.monoVista !== undefined ? changes.monoVista : product.sale_price,
        unit_price: changes.monoPrazo !== undefined ? changes.monoPrazo : product.unit_price,
        quantity: changes.triVista !== undefined ? changes.triVista : product.quantity,
        min_stock: changes.triPrazo !== undefined ? changes.triPrazo : product.min_stock,
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
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">Tabela Comercial</h1>
          <p className="text-slate-500 font-medium">Gestão de preços por empresa.</p>
        </div>
        {canEdit && (
          <Button onClick={() => setIsAdding(!isAdding)} className="bg-indigo-600 hover:bg-indigo-700 shadow-xl font-bold rounded-xl text-white h-12 px-6">
            {isAdding ? <X className="h-5 w-5 mr-2" /> : <Plus className="h-5 w-5 mr-2" />}
            {isAdding ? 'Sair da Busca' : 'Lançar Novo Item'}
          </Button>
        )}
      </div>

      {isAdding && (
        <Card className="border-2 border-indigo-100 bg-white overflow-hidden shadow-2xl rounded-2xl animate-in fade-in zoom-in-95">
          <CardContent className="p-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
              <Input placeholder="Busque por SKU ou Descrição..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-14 h-16 bg-slate-50 border-none rounded-xl text-xl font-medium" />
            </div>
            {searchResults && searchResults.length > 0 && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group">
                    <div className="min-w-0 flex-1">
                      <span className="font-black text-[10px] text-indigo-500 font-mono block mb-1">{p.sku}</span>
                      <span className="font-bold text-slate-900 group-hover:text-indigo-900 text-sm truncate block uppercase">{p.name}</span>
                    </div>
                    <Button 
                      size="sm" 
                      className="bg-indigo-600 hover:bg-indigo-700 ml-4 h-10 px-4 text-white font-bold rounded-lg shrink-0 disabled:opacity-50"
                      onClick={() => saveProductPrice(p, { monoVista: 0.01 })}
                      disabled={updatePriceMutation.isLoading}
                    >
                      {updatePriceMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Selecionar'}
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
          <div className="relative max-w-md"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" /><Input placeholder="Buscar nesta lista..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-12 h-12 bg-white border-none rounded-xl shadow-sm text-sm" /></div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] uppercase font-black text-slate-400 border-b border-slate-100">
                  <th className="px-8 py-5 text-left">Produto</th>
                  <th colSpan="2" className="px-4 py-5 text-center bg-indigo-50/20 text-indigo-600 border-x border-slate-100">Monofásico</th>
                  <th colSpan="2" className="px-4 py-5 text-center bg-amber-50/20 text-amber-600 border-x border-slate-100">Trifásico</th>
                  {canEdit && <th className="px-8 py-5 text-right">Ação</th>}
                </tr>
                <tr className="bg-white text-[9px] uppercase font-bold text-slate-400 border-b border-slate-50">
                  <th className="px-8 py-2 text-left">Identificação</th>
                  <th className="px-4 py-2 text-center bg-indigo-50/5 text-indigo-400 italic">À Vista</th>
                  <th className="px-4 py-2 text-center bg-indigo-50/5 text-indigo-400 italic border-r border-slate-100">À Prazo</th>
                  <th className="px-4 py-2 text-center bg-amber-50/5 text-amber-400 italic">À Vista</th>
                  <th className="px-4 py-2 text-center bg-amber-50/5 text-amber-400 italic border-r border-slate-100">À Prazo</th>
                  {canEdit && <th className="px-8 py-2"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr><td colSpan={canEdit ? 6 : 5} className="py-32 text-center"><Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" /><span className="text-slate-400 font-bold tracking-widest">SINCRONIZANDO...</span></td></tr>
                ) : filteredItems?.map(product => (
                  <tr key={product.id} className="group hover:bg-slate-50 transition-all duration-150">
                    <td className="px-8 py-6">
                      <div className="flex flex-col max-w-[300px]">
                        <span className="font-mono text-[10px] font-black text-indigo-400 mb-0.5">{product.sku}</span>
                        <span className="font-bold text-slate-800 leading-tight group-hover:text-indigo-700 text-sm uppercase">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-6 bg-indigo-50/5"><div className="relative w-36 mx-auto"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-300">R$</span><Input id={`input-${product.id}-monoVista`} readOnly={!canEdit} className={`pl-10 h-10 font-black text-right pr-3 ${!canEdit ? 'bg-transparent border-transparent shadow-none' : 'bg-white border-slate-200 rounded-xl'}`} defaultValue={formatBRL(product.sale_price)} onBlur={(e) => handlePriceBlur(product.id, 'monoVista', e.target.value)} /></div></td>
                    <td className="px-4 py-6 bg-indigo-50/5 border-r border-slate-100"><div className="relative w-36 mx-auto"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-300">R$</span><Input id={`input-${product.id}-monoPrazo`} readOnly={!canEdit} className={`pl-10 h-10 font-black text-right pr-3 ${!canEdit ? 'bg-transparent border-transparent shadow-none' : 'bg-white border-slate-200 rounded-xl'}`} defaultValue={formatBRL(product.unit_price)} onBlur={(e) => handlePriceBlur(product.id, 'monoPrazo', e.target.value)} /></div></td>
                    <td className="px-4 py-6 bg-amber-50/5"><div className="relative w-36 mx-auto"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-300">R$</span><Input id={`input-${product.id}-triVista`} readOnly={!canEdit} className={`pl-10 h-10 font-black text-right pr-3 ${!canEdit ? 'bg-transparent border-transparent shadow-none' : 'bg-white border-slate-200 rounded-xl'}`} defaultValue={formatBRL(product.quantity)} onBlur={(e) => handlePriceBlur(product.id, 'triVista', e.target.value)} /></div></td>
                    <td className="px-4 py-6 bg-amber-50/5 border-r border-slate-100"><div className="relative w-36 mx-auto"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-300">R$</span><Input id={`input-${product.id}-triPrazo`} readOnly={!canEdit} className={`pl-10 h-10 font-black text-right pr-3 ${!canEdit ? 'bg-transparent border-transparent shadow-none' : 'bg-white border-slate-200 rounded-xl'}`} defaultValue={formatBRL(product.min_stock)} onBlur={(e) => handlePriceBlur(product.id, 'triPrazo', e.target.value)} /></div></td>
                    {canEdit && (<td className="px-8 py-6 text-right"><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 shadow-md text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all opacity-0 group-hover:opacity-100" onClick={() => saveProductPrice(product)} disabled={!editingPrices[product.id] || updatePriceMutation.isLoading}>{updatePriceMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}Salvar</Button></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
