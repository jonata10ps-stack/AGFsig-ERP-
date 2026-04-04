import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, Search, Eye, Package, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  PENDENTE_CONFERENCIA: { color: 'bg-amber-100 text-amber-700', label: 'Pendente Conferência' },
  CONFERIDO: { color: 'bg-blue-100 text-blue-700', label: 'Conferido' },
  ARMAZENADO: { color: 'bg-emerald-100 text-emerald-700', label: 'Armazenado' },
};

export default function ReceivingList() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: batches, isLoading } = useQuery({
    queryKey: ['receiving-batches', companyId],
    queryFn: () => companyId ? base44.entities.ReceivingBatch.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const filtered = batches?.filter(b => {
    const matchesSearch = b.batch_number?.toLowerCase().includes(search.toLowerCase()) ||
      b.nf_number?.toLowerCase().includes(search.toLowerCase()) ||
      b.supplier?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || b.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recebimentos</h1>
          <p className="text-slate-500">Gerencie os recebimentos de mercadorias</p>
        </div>
        <Link to={createPageUrl('InventoryReceive')}>
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            Novo Recebimento
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por número, NF ou fornecedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum recebimento encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Desktop Table */}
              <Table className="hidden sm:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>NF</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-mono text-indigo-600 font-medium">
                        {batch.batch_number}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {batch.received_date ? format(new Date(batch.received_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell>{batch.nf_number || '-'}</TableCell>
                      <TableCell>{batch.supplier || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(batch.total_value)}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_CONFIG[batch.status]?.color}>
                          {STATUS_CONFIG[batch.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link to={createPageUrl(`ReceivingConference?batch=${batch.id}`)}>
                          <Button variant="ghost" size="icon">
                            {batch.status === 'CONFERIDO' || batch.status === 'ARMAZENADO' ? (
                              <Printer className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Mobile Card View */}
              <div className="sm:hidden divide-y divide-slate-100">
                {filtered?.map((batch) => (
                  <Link 
                    key={batch.id} 
                    to={createPageUrl(`ReceivingConference?batch=${batch.id}`)}
                    className="block p-4 space-y-3 active:bg-slate-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-indigo-600 font-bold">{batch.batch_number}</span>
                      <Badge className={cn("text-[10px]", STATUS_CONFIG[batch.status]?.color)}>
                        {STATUS_CONFIG[batch.status]?.label}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Data:</p>
                        <p className="text-slate-600 truncate">{batch.received_date ? format(new Date(batch.received_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Total:</p>
                        <p className="font-medium text-slate-900">{formatCurrency(batch.total_value)}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">Fornecedor:</p>
                      <p className="text-slate-600 truncate">{batch.supplier || 'N/A'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}