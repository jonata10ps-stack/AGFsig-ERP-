import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Package, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function BOMDeliveryPickingList() {
  const { companyId } = useCompanyId();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: ops = [], isLoading } = useQuery({
    queryKey: ['ops-with-bom', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // Buscar OPs ativas (não canceladas nem encerradas)
      const allOps = await base44.entities.ProductionOrder.filter({
        company_id: companyId,
        status: { $nin: ['CANCELADA', 'ENCERRADA'] }
      });
      
      return allOps || [];
    },
    enabled: !!companyId,
  });

  const filteredOps = ops.filter(op =>
    op.op_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors = {
    'ABERTA': 'bg-blue-100 text-blue-800',
    'EM_ANDAMENTO': 'bg-amber-100 text-amber-800',
    'PAUSADA': 'bg-orange-100 text-orange-800',
    'ENCERRADA': 'bg-emerald-100 text-emerald-800',
    'CANCELADA': 'bg-red-100 text-red-800',
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Separação de BOM</h1>
            <p className="text-sm text-slate-500">Selecione uma OP com BOM para iniciar a separação</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por OP ou produto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* OPs List */}
      <div className="grid gap-4">
        {filteredOps.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhuma OP em andamento com BOM encontrada</p>
            </CardContent>
          </Card>
        ) : (
          filteredOps.map((op) => (
            <Card
              key={op.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(createPageUrl('BOMDeliveryPicking') + `?op_id=${op.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg text-slate-900">OP {op.op_number}</h3>
                      <Badge className={statusColors[op.status]}>
                        {op.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{op.product_name}</p>
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-slate-500">Planejado</p>
                        <p className="font-semibold">{op.qty_planned}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Produzido</p>
                        <p className="font-semibold text-emerald-600">{op.qty_produced || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Prazo</p>
                        <p className="font-semibold">
                          {op.due_date ? format(new Date(op.due_date), 'dd/MM', { locale: ptBR }) : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button className="ml-4 bg-indigo-600 hover:bg-indigo-700 flex-shrink-0">
                    <Package className="h-4 w-4 mr-2" />
                    Separar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}