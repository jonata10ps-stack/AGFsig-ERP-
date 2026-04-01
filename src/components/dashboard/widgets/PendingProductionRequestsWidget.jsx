import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCompanyId } from '@/components/useCompanyId';

const PRIORITY_CONFIG = {
  BAIXA: { color: 'bg-slate-100 text-slate-700', label: 'Baixa' },
  NORMAL: { color: 'bg-blue-100 text-blue-700', label: 'Normal' },
  ALTA: { color: 'bg-amber-100 text-amber-700', label: 'Alta' },
  URGENTE: { color: 'bg-rose-100 text-rose-700', label: 'Urgente' },
};

export default function PendingProductionRequestsWidget() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyId();

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['production-requests-pending', companyId],
    queryFn: async () => {
      const allRequests = await base44.entities.ProductionRequest.filter({ company_id: companyId });
      // Filtrar apenas solicitações com quantidade pendente > 0 (PENDENTE ou PARCIAL)
      const pendingRequests = allRequests.filter(r => {
        const qtdPendente = (r.qty_requested || 0) - (r.qty_fulfilled || 0);
        return qtdPendente > 0 && (r.status === 'PENDENTE' || r.status === 'PARCIAL');
      });
      return pendingRequests;
    },
    enabled: !!companyId,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = base44.entities.ProductionRequest.subscribe((event) => {
      console.log('ProductionRequest event:', event);
      refetch();
    });

    return () => unsubscribe();
  }, [refetch]);

  const pendingCount = requests?.length || 0;
  const totalQtyPending = requests?.reduce((sum, r) => sum + (r.qty_requested - (r.qty_fulfilled || 0)), 0) || 0;

  return (
    <Card className="col-span-full lg:col-span-2 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('ProductionRequests'))}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Solicitações Pendentes</CardTitle>
            <CardDescription>Controle de solicitações de produção em aberto</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-2xl font-bold text-amber-600">
            <TrendingUp className="h-5 w-5" />
            {pendingCount}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-700">Qtd Total Pendente</p>
              <p className="text-2xl font-bold text-amber-900">{totalQtyPending}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-600">Solicitações</p>
              <p className="text-2xl font-bold text-slate-900">{pendingCount}</p>
            </div>
          </div>

          {isLoading || companyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : pendingCount === 0 ? (
            <div className="text-center py-6">
              <AlertCircle className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">Nenhuma solicitação pendente</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs text-right">Qtd Solicitada</TableHead>
                    <TableHead className="text-xs text-right">Qtd Pendente</TableHead>
                    <TableHead className="text-xs">Prioridade</TableHead>
                    <TableHead className="text-xs">Entrega</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests?.slice(0, 5).map((request) => {
                    const qtdPendente = request.qty_requested - (request.qty_fulfilled || 0);
                    return (
                      <TableRow key={request.id}>
                        <TableCell className="text-sm font-medium">{request.product_name}</TableCell>
                        <TableCell className="text-sm text-right">{request.qty_requested}</TableCell>
                        <TableCell className="text-sm text-right font-semibold text-amber-600">{qtdPendente}</TableCell>
                        <TableCell>
                          <Badge className={PRIORITY_CONFIG[request.priority]?.color} variant="secondary">
                            {PRIORITY_CONFIG[request.priority]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {request.due_date ? format(new Date(request.due_date), 'dd/MM', { locale: ptBR }) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {pendingCount > 5 && (
                <div className="p-3 bg-slate-50 text-center text-sm text-slate-600 border-t">
                  +{pendingCount - 5} mais solicitações
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}