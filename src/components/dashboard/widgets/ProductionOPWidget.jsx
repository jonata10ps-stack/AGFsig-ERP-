import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Factory, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useCompanyId } from '@/components/useCompanyId';

export default function ProductionOPWidget() {
  const { companyId, loading: companyLoading } = useCompanyId();
  const { data: orders, isLoading } = useQuery({
    queryKey: ['production-widget', companyId],
    queryFn: () => base44.entities.ProductionOrder.filter(
      { company_id: companyId, status: ['ABERTA', 'EM_ANDAMENTO'] },
      '-created_date',
      5
    ),
    enabled: !!companyId,
  });

  const statusColors = {
    ABERTA: 'bg-blue-100 text-blue-700',
    EM_ANDAMENTO: 'bg-amber-100 text-amber-700',
    PAUSADA: 'bg-slate-100 text-slate-700',
    ENCERRADA: 'bg-emerald-100 text-emerald-700',
    CANCELADA: 'bg-rose-100 text-rose-700',
  };

  if (isLoading || companyLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Ordens de Produção</CardTitle>
        <Link to={createPageUrl('ProductionOrders')}>
          <Button variant="ghost" size="sm" className="text-indigo-600 h-8">
            Ver todas <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {orders?.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <Factory className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Nenhuma OP ativa</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders?.map((op) => (
              <div key={op.id} className="p-2 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm text-slate-900">
                    {op.op_number || `OP-${op.id.slice(0, 6)}`}
                  </p>
                  <Badge className={`text-xs ${statusColors[op.status]}`}>
                    {op.status?.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 truncate mb-1">{op.product_name}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Progresso:</span>
                  <span className="font-medium">{op.qty_produced || 0}/{op.qty_planned}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}