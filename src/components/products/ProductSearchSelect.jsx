import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, X, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCompanyId } from '@/components/useCompanyId';

export default function ProductSearchSelect({ value, onSelect, label, placeholder, required }) {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const wrapperRef = useRef(null);

  const { data: products } = useQuery({
    queryKey: ['products-all', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      // Busca paginada para garantir todos os registros (API limita 5000 por chamada)
      const PAGE = 5000;
      let all = [];
      let skip = 0;
      while (true) {
        const page = await base44.entities.Product.filter({ company_id: companyId }, 'sku', PAGE, skip);
        if (!page || page.length === 0) break;
        all = all.concat(page);
        if (page.length < PAGE) break;
        skip += PAGE;
      }
      return all;
    },
    enabled: !!companyId,
    staleTime: 0,
  });

  useEffect(() => {
    if (value && products) {
      const product = products.find(p => p.id === value);
      setSelectedProduct(product);
    } else {
      setSelectedProduct(null);
    }
  }, [value, products]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);

  const isSearching = search.trim() !== '';

  const filteredProducts = products?.filter(p =>
    !isSearching ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = filteredProducts ? Math.ceil(filteredProducts.length / PAGE_SIZE) : 0;
  const pagedProducts = isSearching
    ? filteredProducts?.slice(0, 99999)
    : filteredProducts?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSelect = (product) => {
    setSelectedProduct(product);
    if (onSelect) {
      onSelect(product.id, product);
    }
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
    if (onSelect) {
      onSelect('', null);
    }
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
            {!isSearching && totalPages > 1 && (
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
                  Pág. {page + 1}/{totalPages} · {filteredProducts?.length} produtos
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
            {isSearching && filteredProducts && (
              <div className="px-3 py-1.5 border-t bg-slate-50 text-xs text-slate-500 text-center">
                {filteredProducts.length} resultado(s)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}