import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, Search, Eye, MoreHorizontal, ClipboardList, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  ABERTA: { color: 'bg-blue-100 text-blue-700', label: 'Aberta' },
  PARCIAL: { color: 'bg-amber-100 text-amber-700', label: 'Parcial' },
  ATENDIDA: { color: 'bg-emerald-100 text-emerald-700', label: 'Atendida' },
  CANCELADA: { color: 'bg-rose-100 text-rose-700', label: 'Cancelada' },
};

const PRIORITY_CONFIG = {
  BAIXA: { color: 'bg-slate-100 text-slate-700', label: 'Baixa' },
  NORMAL: { color: 'bg-blue-100 text-blue-700', label: 'Normal' },
  ALTA: { color: 'bg-amber-100 text-amber-700', label: 'Alta' },
  URGENTE: { color: 'bg-rose-100 text-rose-700', label: 'Urgente' },
};

export default function MaterialRequests() {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyId();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: requests, isLoading } = useQuery({
    queryKey: ['material-requests', companyId],
    queryFn: () => companyId ? base44.entities.MaterialRequest.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await base44.entities.MaterialRequest.update(id, { 
        status
      });

      if (status === 'CANCELADA') {
        const items = await base44.entities.MaterialRequestItem.filter({ request_id: id });
        if (items?.length > 0) {
          await Promise.all(items.map(item => 
            base44.entities.MaterialRequestItem.update(item.id, { qty_pending: 0 })
          ));
        }
      }
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['material-requests', companyId] });
      if (variables.status === 'CANCELADA') {
        toast.success('Solicitação cancelada com sucesso');
      } else {
        toast.success('Status atualizado');
      }
    },
    onError: (err) => {
      toast.error('Erro ao atualizar status: ' + err.message);
    }
  });

  const filtered = requests?.filter(r => {
    const matchesSearch = r.request_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.requester?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Solicitações de Materiais</h1>
          <p className="text-slate-500">Gerencie as solicitações de compra</p>
        </div>
        <Link to={createPageUrl('MaterialRequestDetail')}>
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            Nova Solicitação
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por número, descrição ou solicitante..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
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
              <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono text-indigo-600 font-medium">
                      {request.request_number}
                    </TableCell>
                    <TableCell>{request.description || '-'}</TableCell>
                    <TableCell>{request.requester || '-'}</TableCell>
                    <TableCell className="text-slate-500">
                      {request.created_date ? format(new Date(request.created_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={PRIORITY_CONFIG[request.priority]?.color}>
                        {PRIORITY_CONFIG[request.priority]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_CONFIG[request.status]?.color}>
                        {STATUS_CONFIG[request.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={createPageUrl(`MaterialRequestDetail?id=${request.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </Link>
                          </DropdownMenuItem>
                          {(request.status === 'ABERTA' || request.status === 'PARCIAL') && (
                            <DropdownMenuItem 
                              onClick={() => {
                                if (confirm('Deseja realmente CANCELAR esta solicitação? Todos os itens pendentes serão zerados.')) {
                                  updateStatusMutation.mutate({ id: request.id, status: 'CANCELADA' });
                                }
                              }}
                              className="text-red-600"
                              disabled={updateStatusMutation.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              {updateStatusMutation.isPending ? 'Cancelando...' : 'Cancelar'}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}