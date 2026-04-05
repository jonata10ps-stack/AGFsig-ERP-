import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, Search, Eye, Loader2, Wrench, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';

const statusColors = {
  PENDENTE: 'bg-slate-100 text-slate-700',
  EM_ANDAMENTO: 'bg-indigo-100 text-indigo-700',
  PAUSADA: 'bg-amber-100 text-amber-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

export default function ServiceOrders() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['service-orders', companyId],
    queryFn: () => companyId ? base44.entities.ServiceOrder.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const filteredOrders = orders?.filter(order => {
    const matchSearch = search === '' || 
      order.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      order.os_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ordens de Serviço</h1>
          <p className="text-slate-500">Gestão de ordens de serviço técnico</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por OS, cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="PENDENTE">Pendente</SelectItem>
                <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                <SelectItem value="PAUSADA">Pausada</SelectItem>
                <SelectItem value="CONCLUIDA">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número OS</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      Nenhuma ordem de serviço encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders?.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">{order.os_number}</TableCell>
                      <TableCell>{order.client_name}</TableCell>
                      <TableCell className="text-sm">{order.product_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{order.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{order.technician_name || 'Não atribuído'}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[order.status]}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.created_date || order.created_at ? format(new Date(order.created_date || order.created_at), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={createPageUrl(`ServiceOrderDetail?id=${order.id}`)}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}