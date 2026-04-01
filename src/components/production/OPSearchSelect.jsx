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
import { Check, ChevronsUpDown } from 'lucide-react';
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
      status: { $in: ['ABERTA', 'EM_ANDAMENTO', 'PAUSADA'] }
    }),
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
                {selectedOP.numero_op_externo} - {selectedOP.product_name}
              </span>
            ) : (
              <span className="text-slate-500">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command>
            <CommandInput placeholder="Buscar por número ou produto..." />
            <CommandList>
              <CommandEmpty>Nenhuma OP encontrada.</CommandEmpty>
              <CommandGroup>
                {ops?.map((op) => (
                  <CommandItem
                    key={op.id}
                    value={`${op.numero_op_externo} ${op.product_name} ${op.op_number}`}
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
                      <span className="font-medium">{op.numero_op_externo}</span>
                      <span className="text-sm text-slate-500">{op.product_name}</span>
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