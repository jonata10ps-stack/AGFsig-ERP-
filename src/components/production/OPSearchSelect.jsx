import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OPSearchSelect({ 
  label = "Ordem de Produção", 
  value, 
  onSelect, 
  placeholder = "Buscar OP...",
  required = false,
  companyId = null
}) {
  const [open, setOpen] = useState(false);

  const { data: ops } = useQuery({
    queryKey: ['production-orders-select', companyId],
    queryFn: () => base44.entities.ProductionOrder.filter({ 
      ...(companyId ? { company_id: companyId } : {}),
      status: ['ABERTA', 'EM_ANDAMENTO', 'PAUSADA']
    }, '-created_date'), // Ordenar pelas mais recentes
  });

  const selectedOP = ops?.find(op => op.id === value);

  return (
    <div className="space-y-2">
      {label && <Label>{label} {required && '*'}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedOP ? (
              <span className="truncate">
                {selectedOP.numero_op_externo || selectedOP.op_number} - {selectedOP.product_name || 'Sem Produto'}
              </span>
            ) : (
              <span className="text-slate-500">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[450px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar por número ou produto..." />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>Nenhuma OP ativa encontrada.</CommandEmpty>
              {value && (
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onSelect(null);
                      setOpen(false);
                    }}
                    className="text-red-600 font-medium"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Limpar Seleção (Desvincular)
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {ops?.map((op) => (
                  <CommandItem
                    key={op.id}
                    value={`${op.numero_op_externo || ''} ${op.product_name || ''} ${op.op_number || ''}`.trim()}
                    onSelect={() => {
                      onSelect(op.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === op.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{op.numero_op_externo || op.op_number}</span>
                      <span className="text-xs text-slate-500">{op.product_name || 'Produto não identificado'}</span>
                      <div className="flex gap-2 mt-1">
                         <span className="text-[10px] bg-slate-100 px-1 rounded">{op.status}</span>
                         <span className="text-[10px] text-slate-400">{op.op_number}</span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}