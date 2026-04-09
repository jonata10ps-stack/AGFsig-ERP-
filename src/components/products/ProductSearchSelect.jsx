import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, X, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function ProductSearchSelect({ 
  value, 
  onSelect = () => {}, 
  onChange = () => {}, 
  label = '', 
  placeholder = 'Buscar produto...', 
  required = false 
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const wrapperRef = useRef(null);

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);

  // Fetch selected product details if not already in local search results
  const { data: valueProduct } = useQuery({
    queryKey: ['product-single', value],
    queryFn: () => value ? base44.entities.Product.filter({ id: value }).then(r => r[0]) : null,
    enabled: !!value,
  });

  const { data: result, isLoading } = useQuery({
    queryKey: ['products-search', search, page],
    queryFn: async () => {
      const conditions = {}; // MODO UNIFICADO: Busca em todas as empresas
      const searchFields = search ? ['sku', 'name', 'category'] : [];
      
      const { data, count } = await base44.entities.Product.queryPaginated(
        conditions, 
        'sku', 
        PAGE_SIZE, 
        page * PAGE_SIZE,
        searchFields,
        search
      );

      // Desduplicação básica por SKU
      const uniqueData = (data || []).reduce((acc, current) => {
        const x = acc.find(item => item.sku === current.sku);
        if (!x) return acc.concat([current]);
        return acc;
      }, []);

      return { data: uniqueData, count };
    },
    enabled: isOpen,
    staleTime: 30000,
  });

  const products = result?.data || [];
  const totalCount = result?.count || 0;

  useEffect(() => {
    if (valueProduct) {
      setSelectedProduct(valueProduct);
    } else if (!value) {
      setSelectedProduct(null);
    }
  }, [value, valueProduct]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSearching = search.trim() !== '';
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const pagedProducts = React.useMemo(() => {
    if (!products || !search) return products;
    const s = search.toLowerCase();
    return [...products].sort((a, b) => {
      const aSku = a.sku?.toLowerCase() || '';
      const bSku = b.sku?.toLowerCase() || '';
      const aName = a.name?.toLowerCase() || '';
      const bName = b.name?.toLowerCase() || '';

      const aExact = aSku === s || aName === s;
      const bExact = bSku === s || bName === s;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      const aStarts = aSku.startsWith(s) || aName.startsWith(s);
      const bStarts = bSku.startsWith(s) || bName.startsWith(s);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      return 0;
    });
  }, [products, search]);

  const handleSelect = (product) => {
    setSelectedProduct(product);
    if (typeof onSelect === 'function') onSelect(product.id, product);
    if (typeof onChange === 'function') onChange(product.id, product);
    setSearch('');
    setIsOpen(false);
    setPage(0);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(0);
    setIsOpen(true);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelectedProduct(null);
    if (typeof onSelect === 'function') onSelect(null, null);
    if (typeof onChange === 'function') onChange(null, null);
    setSearch('');
  };

  return (
    <div className="space-y-2" ref={wrapperRef}>
      {label && <Label>{label} {required && '*'}</Label>}
      
      <div className="relative">
        {selectedProduct ? (
          <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md bg-white">
            <Package className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-mono text-sm text-indigo-600 mr-2">{selectedProduct.sku}</span>
              <span className="text-sm text-slate-900">{selectedProduct.name}</span>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-slate-100 rounded"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        ) : (
          <>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder={placeholder || "Digite código ou descrição..."}
              value={search}
              onChange={handleSearchChange}
              onFocus={() => setIsOpen(true)}
              className="pl-10"
            />
          </>
        )}

        {isOpen && !selectedProduct && pagedProducts && pagedProducts.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
            {pagedProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => handleSelect(product)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors text-left border-b last:border-b-0",
                  value === product.id && "bg-indigo-50"
                )}
              >
                <Package className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-indigo-600 font-medium">{product.sku}</p>
                  <p className="text-sm text-slate-900">{product.name}</p>
                  {product.category && (
                    <p className="text-xs text-slate-500 mt-0.5">{product.category}</p>
                  )}
                </div>
              </button>
            ))}
            {(isSearching || totalPages > 1) && (
              <div className="flex items-center justify-between px-3 py-2 border-t bg-slate-50 sticky bottom-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPage(p => Math.max(0, p - 1)); }}
                  disabled={page === 0}
                  className="text-xs px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-slate-500">
                  {isSearching ? `Filtro: ${totalCount} itens` : `Pág. ${page + 1}/${totalPages}`}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPage(p => Math.min(totalPages - 1, p + 1)); }}
                  disabled={page >= totalPages - 1}
                  className="text-xs px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40"
                >
                  Próxima →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}