import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, X, Warehouse } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCompanyId } from '@/components/useCompanyId';

export default function WarehouseSearchSelect({ value, onSelect, label, placeholder, required }) {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const wrapperRef = useRef(null);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => companyId ? base44.entities.Warehouse.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  useEffect(() => {
    if (value && warehouses) {
      const warehouse = warehouses.find(w => w.id === value);
      setSelectedWarehouse(warehouse);
    } else {
      setSelectedWarehouse(null);
    }
  }, [value, warehouses]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredWarehouses = warehouses?.filter(w =>
    search === '' ||
    w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.code?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  const handleSelect = (warehouse) => {
    setSelectedWarehouse(warehouse);
    onSelect(warehouse.id);
    setSearch('');
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelectedWarehouse(null);
    onSelect('');
    setSearch('');
  };

  return (
    <div className="space-y-2" ref={wrapperRef}>
      {label && <Label className="text-sm font-medium">{label} {required && '*'}</Label>}
      
      <div className="relative">
        {selectedWarehouse ? (
          <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md bg-white shadow-sm">
            <Warehouse className="h-4 w-4 text-indigo-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-slate-900">{selectedWarehouse.name}</span>
              {selectedWarehouse.code && (
                <span className="text-xs text-slate-500 ml-2 font-mono">• {selectedWarehouse.code}</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        ) : (
          <>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder={placeholder || "Buscar armazém..."}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              className="pl-10 h-10 border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </>
        )}

        {isOpen && !selectedWarehouse && filteredWarehouses && filteredWarehouses.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
            {filteredWarehouses.map((warehouse) => (
              <button
                key={warehouse.id}
                type="button"
                onClick={() => handleSelect(warehouse)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 hover:bg-indigo-50 transition-colors text-left border-b border-slate-50 last:border-b-0",
                  value === warehouse.id && "bg-indigo-50 shadow-inner"
                )}
              >
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Warehouse className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{warehouse.name}</p>
                    {warehouse.code && (
                      <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded uppercase">
                        {warehouse.code}
                      </span>
                    )}
                  </div>
                  {warehouse.type && (
                    <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{warehouse.type}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        
        {isOpen && !selectedWarehouse && filteredWarehouses?.length === 0 && search && (
           <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-4 text-center">
             <p className="text-sm text-slate-500 italic">Nenhum armazém encontrado para "{search}"</p>
           </div>
        )}
      </div>
    </div>
  );
}
