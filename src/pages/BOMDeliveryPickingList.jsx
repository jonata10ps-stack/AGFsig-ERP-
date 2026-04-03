import React, { useState, useMemo } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Package, Search, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function BOMDeliveryPickingList() {
  const { companyId } = useCompanyId();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // Buscar TODAS as OPs da empresa
  const { data: allOps = [], isLoading: loadingOps } = useQuery({
    queryKey: ['all-ops', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const ops = await base44.entities.ProductionOrder.filter({
        company_id: companyId
      });
      return ops || [];
    },
    enabled: !!companyId,
  });

  // Buscar TODOS os BOMDeliveryControl (sem company_id pois a tabela não tem)
  const { data: allDeliveryControls = [], isLoading: loadingControls } = useQuery({
    queryKey: ['all-bom-delivery-controls'],
    queryFn: async () => {
      const controls = await base44.entities.BOMDeliveryControl.list('-created_at', 5000);
      return controls || [];
    },
    enabled: !!companyId,
  });

  // Buscar todas as BOMs da empresa para saber quais produtos têm BOM cadastrado
  const { data: allBoms = [], isLoading: loadingBoms } = useQuery({
    queryKey: ['all-boms', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const boms = await base44.entities.BOM.filter({ company_id: companyId });
      return boms || [];
    },
    enabled: !!companyId,
  });

  const isLoading = loadingOps || loadingControls || loadingBoms;

  // Criar mapa: product_id -> tem BOM ativa?
  const productHasBomMap = useMemo(() => {
    const map = {};
    for (const bom of allBoms) {
      // is_active pode ser boolean true ou string "true"
      if (bom.is_active === true || bom.is_active === 'true' || bom.is_active === 'TRUE') {
        map[bom.product_id] = true;
      }
    }
    return map;
  }, [allBoms]);

  // Filtrar OPs ativas (não canceladas nem encerradas) em JS
  const activeOps = useMemo(() => {
    return allOps.filter(op => 
      op.status !== 'CANCELADA' && op.status !== 'ENCERRADA'
    );
  }, [allOps]);

  // Criar mapa de progresso de entrega por OP
  const deliveryProgressMap = useMemo(() => {
    const map = {};
    for (const ctrl of allDeliveryControls) {
      const opId = ctrl.op_id;
      if (!opId) continue;
      if (!map[opId]) {
        map[opId] = { total: 0, delivered: 0, pending: 0, items: [] };
      }
      map[opId].total += 1;
      const qtyPlanned = Number(ctrl.qty_planned) || 0;
      const qtyDelivered = Number(ctrl.qty) || 0;
      if (qtyDelivered >= qtyPlanned && qtyPlanned > 0) {
        map[opId].delivered += 1;
      } else {
        map[opId].pending += 1;
      }
      map[opId].items.push(ctrl);
    }
    return map;
  }, [allDeliveryControls]);

  // Filtro de busca (por op_number, numero_op_externo ou product_name)
  const filteredOps = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return activeOps.filter(op =>
      op.op_number?.toLowerCase().includes(term) ||
      op.numero_op_externo?.toLowerCase().includes(term) ||
      op.product_name?.toLowerCase().includes(term)
    );
  }, [activeOps, searchTerm]);

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
            <p className="text-sm text-slate-500">
              Selecione uma OP para iniciar a separação de materiais
              {activeOps.length > 0 && (
                <span className="ml-2 font-medium text-indigo-600">
                  ({activeOps.length} OP{activeOps.length !== 1 ? 's' : ''} ativa{activeOps.length !== 1 ? 's' : ''})
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por OP TOTVS, número interno ou produto..."
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
              <p className="text-slate-500">
                {searchTerm 
                  ? 'Nenhuma OP encontrada com esse termo de busca' 
                  : 'Nenhuma OP ativa encontrada'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredOps.map((op) => {
            const progress = deliveryProgressMap[op.id];
            const hasMaterials = progress && progress.total > 0;
            const allDelivered = hasMaterials && progress.pending === 0;
            const deliveryPercent = hasMaterials 
              ? Math.round((progress.delivered / progress.total) * 100) 
              : 0;
            const productHasBom = productHasBomMap[op.product_id] || false;

            return (
              <Card
                key={op.id}
                className="hover:shadow-lg transition-shadow cursor-pointer border-l-4"
                style={{
                  borderLeftColor: allDelivered 
                    ? '#10b981' 
                    : hasMaterials 
                      ? '#f59e0b' 
                      : productHasBom
                        ? '#6366f1'
                        : '#94a3b8'
                }}
                onClick={() => navigate(createPageUrl('BOMDeliveryPicking') + `?op_id=${op.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg text-slate-900">
                          {op.numero_op_externo || op.op_number}
                        </h3>
                        {op.numero_op_externo && op.op_number && (
                          <span className="text-xs text-slate-400">({op.op_number})</span>
                        )}
                        <Badge className={statusColors[op.status]}>
                          {op.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">{op.product_name}</p>
                      
                      <div className="grid grid-cols-4 gap-4">
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
                        <div>
                          <p className="text-xs text-slate-500">Materiais</p>
                          {hasMaterials ? (
                            <div className="flex items-center gap-1.5">
                              {allDelivered ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <Clock className="h-4 w-4 text-amber-500" />
                              )}
                              <span className={`font-semibold text-sm ${allDelivered ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {progress.delivered}/{progress.total}
                              </span>
                            </div>
                          ) : productHasBom ? (
                            <div className="flex items-center gap-1.5">
                              <Package className="h-4 w-4 text-indigo-500" />
                              <span className="text-xs font-medium text-indigo-600">Tem BOM</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <AlertCircle className="h-4 w-4 text-slate-400" />
                              <span className="text-xs text-slate-400">Sem BOM</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {hasMaterials && (
                        <div className="mt-3">
                          <Progress value={deliveryPercent} className="h-1.5" />
                        </div>
                      )}
                    </div>
                    <Button className={`ml-4 flex-shrink-0 ${
                      allDelivered 
                        ? 'bg-emerald-600 hover:bg-emerald-700' 
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}>
                      <Package className="h-4 w-4 mr-2" />
                      {allDelivered ? 'Concluído' : 'Separar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}