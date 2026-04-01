import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Search, Eye, Package, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ReceivingConferenceList() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');

  const { data: items, isLoading } = useQuery({
    queryKey: ['receiving-items-pending', companyId],
    queryFn: async () => {
      return companyId ? await base44.entities.ReceivingItem.filter({ company_id: companyId, status: 'RECEBIDO' }, '-created_date') : Promise.resolve([]);
    },
    enabled: !!companyId,
  });

  const { data: batches } = useQuery({
    queryKey: ['receiving-batches-pending', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const allBatches = await base44.entities.ReceivingBatch.filter({ company_id: companyId }, '-created_date');
      return allBatches.filter(b => b.status === 'RECEBIDO');
    },
    enabled: !!companyId,
  });

  const batchMap = batches?.reduce((acc, b) => ({ ...acc, [b.id]: b }), {}) || {};

  const filtered = items?.filter(item => {
    return item.product_sku?.toLowerCase().includes(search.toLowerCase()) ||
      item.product_name?.toLowerCase().includes(search.toLowerCase());
  })?.filter(item => batchMap[item.batch_id]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Conferência de Recebimentos</h1>
        <p className="text-slate-500">Itens com status "Recebido Provisório" pendentes de conferência</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por SKU, produto ou lote..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
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
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-300 mb-4" />
              <p className="text-slate-500">Nenhum item pendente de conferência</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead className="text-right">Qtd Recebida</TableHead>
                  <TableHead>Armazém</TableHead>
                  <TableHead>Preço Unit.</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((item) => {
                  const batch = batchMap[item.batch_id];
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-indigo-600 font-medium">
                        {item.product_sku}
                      </TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell className="text-slate-500">
                        {batch?.batch_number || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.qty}
                      </TableCell>
                      <TableCell>{item.warehouse_name || '-'}</TableCell>
                      <TableCell>
                        {formatCurrency(item.unit_cost)}
                      </TableCell>
                      <TableCell>
                        <Link to={createPageUrl(`ReceivingConference?batch=${item.batch_id}`)}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}