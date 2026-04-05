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

  const { data: clients } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => companyId ? base44.entities.Client.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  useEffect(() => {
    if (value && clients) {
      const client = clients.find(c => c.id === value);
      setSelectedClient(client);
    } else {
      setSelectedClient(null);
    }
  }, [value, clients]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalize = (str) => str?.toString().toLowerCase().replace(/[^a-z0-9]/g, '') || '';

  const filteredClients = clients?.filter(c => {
    if (search === '') return true;
    
    const term = search.toLowerCase();
    const normalizedTerm = normalize(search);
    
    return (
      c.name?.toLowerCase().includes(term) ||
      c.client_name?.toLowerCase().includes(term) ||
      c.social_name?.toLowerCase().includes(term) ||
      c.razao_social?.toLowerCase().includes(term) ||
      c.code?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      (c.document && normalize(c.document).includes(normalizedTerm)) ||
      (c.client_document && normalize(c.client_document).includes(normalizedTerm))
    );
  }).slice(0, 10);

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
              <span className="text-sm font-medium text-slate-900">{selectedClient.name}</span>
              {selectedClient.document && (
                <span className="text-xs text-slate-500 ml-2">• {selectedClient.document}</span>
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
          </>
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
                    <p className="text-sm font-medium text-slate-900">{client.name}</p>
                  </div>
                  {client.document && (
                    <p className="text-xs text-slate-500 mt-0.5">CNPJ/CPF: {client.document}</p>
                  )}
                  {client.email && (
                    <p className="text-xs text-slate-500">{client.email}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}