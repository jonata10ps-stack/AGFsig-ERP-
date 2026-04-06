import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, X, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCompanyId } from '@/components/useCompanyId';

export default function ClientSearchSelect({ 
  value, 
  onSelect = () => {}, 
  onChange = () => {}, 
  label = '', 
  placeholder = 'Buscar cliente...', 
  required = false 
}) {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const wrapperRef = useRef(null);

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);

  const { data: result, isLoading } = useQuery({
    queryKey: ['clients-search', companyId, search, page],
    queryFn: async () => {
      if (!companyId) return { data: [], count: 0 };
      
      const conditions = { company_id: companyId };
      const searchFields = search ? ['name', 'document', 'code'] : [];
      
      return base44.entities.Client.queryPaginated(
        conditions, 
        'name', 
        PAGE_SIZE, 
        page * PAGE_SIZE,
        searchFields,
        search
      );
    },
    enabled: !!companyId && isOpen,
    staleTime: 30000,
  });

  const clients = result?.data || [];
  const totalCount = result?.count || 0;

  useEffect(() => {
    // If we have a value but no selectedClient, we should fetch that specific client
    if (value && !selectedClient && companyId) {
      base44.entities.Client.filter({ id: value }).then(r => {
        if (r && r[0]) setSelectedClient(r[0]);
      });
    }
  }, [value, selectedClient, companyId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredClients = clients; // Now using server-side results directly

  const handleSelect = (client) => {
    setSelectedClient(client);
    if (typeof onSelect === 'function') onSelect(client.id, client);
    if (typeof onChange === 'function') onChange(client.id, client.name || client.client_name || '');
    setSearch('');
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelectedClient(null);
    if (typeof onSelect === 'function') onSelect(null, null);
    if (typeof onChange === 'function') onChange(null, '');
    setSearch('');
  };

  return (
    <div className="space-y-2" ref={wrapperRef}>
      {label && <Label>{label} {required && '*'}</Label>}
      
      <div className="relative">
        {selectedClient ? (
          <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md bg-white">
            <Users className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-900">{selectedClient.name || selectedClient.client_name}</span>
              {(selectedClient.document || selectedClient.client_document) && (
                <span className="text-xs text-slate-500 ml-2">• {selectedClient.document || selectedClient.client_document}</span>
              )}
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
              placeholder={placeholder || "Digite nome, código, CPF/CNPJ..."}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              className="pl-10"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </>
        )}

        {isOpen && !selectedClient && search && !isLoading && filteredClients.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center">
            <p className="text-sm text-slate-500">Nenhum cliente encontrado para "{search}"</p>
          </div>
        )}

        {isOpen && !selectedClient && filteredClients && filteredClients.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => handleSelect(client)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors text-left border-b last:border-b-0",
                  value === client.id && "bg-indigo-50"
                )}
              >
                <Users className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {client.code && (
                      <span className="font-mono text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {client.code}
                      </span>
                    )}
                    <p className="text-sm font-medium text-slate-900">{client.name || client.client_name}</p>
                  </div>
                  {(client.document || client.client_document) && (
                    <p className="text-xs text-slate-500 mt-0.5">CNPJ/CPF: {client.document || client.client_document}</p>
                  )}
                  {client.email && (
                    <p className="text-xs text-slate-500">{client.email}</p>
                  )}
                </div>
              </button>
            ))}
            {totalCount > PAGE_SIZE && (
              <div className="p-2 border-t bg-slate-50 flex items-center justify-between text-[10px] text-slate-500">
                <span>Total: {totalCount} clientes</span>
                <div className="flex gap-1">
                  <button 
                    type="button"
                    disabled={page === 0}
                    onClick={(e) => { e.stopPropagation(); setPage(p => p - 1); }}
                    className="px-2 py-1 bg-white border rounded disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button 
                    type="button"
                    disabled={(page + 1) * PAGE_SIZE >= totalCount}
                    onClick={(e) => { e.stopPropagation(); setPage(p => p + 1); }}
                    className="px-2 py-1 bg-white border rounded disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}