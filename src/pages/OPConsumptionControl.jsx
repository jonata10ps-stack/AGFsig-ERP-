import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Search, Filter, X, AlertCircle, CheckCircle2, Package,
  TrendingDown, Clock, Eye, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReverseConsumptionDialog from '@/components/consumption/ReverseConsumptionDialog';

const STATUS_CONFIG = {
  ABERTA: { color: 'bg-blue-100 text-blue-700', label: 'Aberta' },
  EM_ANDAMENTO: { color: 'bg-amber-100 text-amber-700', label: 'Em Andamento' },
  PAUSADA: { color: 'bg-slate-100 text-slate-700', label: 'Pausada' },
  ENCERRADA: { color: 'bg-emerald-100 text-emerald-700', label: 'Encerrada' },
  CANCELADA: { color: 'bg-rose-100 text-rose-700', label: 'Cancelada' },
};

export default function OPConsumptionControl() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ATIVOS');
  const [selectedOP, setSelectedOP] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
  const [selectedConsumption, setSelectedConsumption] = useState(null);

  const { data: controls = [], isLoading: controlsLoading, refetch: refetchControls } = useQuery({
    queryKey: ['op-consumption-controls', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        const result = await base44.entities.OPConsumptionControl.filter({ company_id: companyId });
        console.log('✅ OPConsumptionControl carregados:', result.length);
        return result;
      } catch (error) {
        console.error('❌ Erro ao carregar OPConsumptionControl:', error);
        throw error;
      }
    },
    enabled: !!companyId,
    staleTime: 0,
    retry: 1,
  });

  const { data: materialConsumptions = [], isLoading: materialLoading, refetch: refetchMaterials } = useQuery({
    queryKey: ['material-consumptions', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        const result = await base44.entities.MaterialConsumption.filter({ company_id: companyId });
        console.log('✅ MaterialConsumption carregados:', result.length);
        return result;
      } catch (error) {
        console.error('❌ ERRO MaterialConsumption:', error.response?.status, error.response?.data || error.message);
        return [];
      }
    },
    enabled: !!companyId,
    staleTime: 0,
    retry: false,
  });

  const { data: allOPs = [] } = useQuery({
    queryKey: ['ops-all', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        const result = await base44.entities.ProductionOrder.filter({ company_id: companyId });
        console.log('✅ ProductionOrder carregados:', result.length);
        return result;
      } catch (error) {
        console.error('❌ ERRO ProductionOrder:', error.response?.status, error.response?.data || error.message);
        return [];
      }
    },
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const { data: bomDeliveries = [], refetch: refetchBOM } = useQuery({
    queryKey: ['bom-delivery-controls', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        const result = await base44.entities.BOMDeliveryControl.filter({});
        console.log('✅ BOMDeliveryControl carregados:', result.length);
        // Suportar qty e qty_delivered para retrocompatibilidade
        console.log('✅ BOM Deliveries com qty > 0:', result.filter(d => (Number(d.qty || d.qty_delivered) || 0) > 0).length);
        return result;
      } catch (error) {
        console.error('❌ Erro ao carregar BOMDeliveryControl:', error);
        throw error;
      }
    },
    enabled: !!companyId,
    staleTime: 0,
    retry: 1,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        const result = await base44.entities.Warehouse.filter({ company_id: companyId });
        console.log('✅ Warehouse carregados:', result.length);
        return result;
      } catch (error) {
        console.error('❌ ERRO Warehouse:', error.response?.status, error.response?.data || error.message);
        return [];
      }
    },
    enabled: !!companyId,
    retry: false,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        const result = await base44.entities.Location.filter({ company_id: companyId });
        console.log('✅ Location carregados:', result.length);
        return result;
      } catch (error) {
        console.error('❌ ERRO Location:', error.response?.status, error.response?.data || error.message);
        return [];
      }
    },
    enabled: !!companyId,
    retry: false,
  });

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        const result = await base44.entities.Product.filter({ company_id: companyId });
        console.log('✅ Product carregados:', result.length);
        return result;
      } catch (error) {
        console.error('❌ ERRO Product:', error.response?.status, error.response?.data || error.message);
        return [];
      }
    },
    enabled: !!companyId,
    retry: false,
  });

  const { data: inventoryMoves = [], refetch: refetchMoves } = useQuery({
    queryKey: ['inventory-moves-to-op', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        const moves = await base44.entities.InventoryMove.filter({ company_id: companyId });
        // Filtrar APENAS SAIDA e PRODUCAO_CONSUMO (excluir TRANSFERENCIA)
        const filtered = moves.filter(m => 
          m.related_type === 'OP' && 
          m.related_id && 
          (m.type === 'SAIDA' || m.type === 'PRODUCAO_CONSUMO') &&
          m.type !== 'TRANSFERENCIA'
        );
        console.log('✅ InventoryMoves para OP:', filtered.length);
        return filtered;
      } catch (error) {
        console.error('❌ Erro ao carregar InventoryMoves:', error);
        throw error;
      }
    },
    enabled: !!companyId,
    staleTime: 0,
    retry: 1,
  });

  // Combinar consumos registrados com movimentos de inventário diretos e MaterialConsumption
  
  // Registrar todos os inventory_move_ids já cobertos por algum OPConsumptionControl
  const coveredMoveIds = new Set(
    controls.filter(c => c.control_status !== 'FECHADO' && c.inventory_move_id)
      .map(c => c.inventory_move_id)
  );

  // Somar todos os OPConsumptionControl por par op+produto (para saber quanto já está coberto)
  const opControlQtyByKey = {};
  controls.filter(c => c.control_status !== 'FECHADO').forEach(c => {
    const key = `${c.op_id}-${c.consumed_product_id}`;
    opControlQtyByKey[key] = (opControlQtyByKey[key] || 0) + (Number(c.qty) || 0);
  });

  // Registrar pares op+produto cobertos por BOMDeliveries (para evitar duplicata com InventoryMoves manuais)
  const bomOpProductKeys = new Set();
  bomDeliveries.forEach(bd => {
    const qty = Number(bd.qty || bd.qty_delivered) || 0;
    if (qty > 0) {
      const compId = bd.consumed_product_id || bd.component_id;
      bomOpProductKeys.add(`${bd.op_id}-${compId}`);
    }
  });

  const allConsumptions = [
    // Só mostrar controles ABERTOS
    ...controls.filter(c => c.control_status !== 'FECHADO'),
     // BOM Deliveries - mostrar se há quantidade entregue além do que OPConsumptionControl já cobre
     ...bomDeliveries.filter(bd => {
        const qty = Number(bd.qty || bd.qty_delivered) || 0;
        if (qty === 0) return false;
        
        const compId = bd.consumed_product_id || bd.component_id;
        const key = `${bd.op_id}-${compId}`;
        const coveredByControl = opControlQtyByKey[key] || 0;
        // Mostrar se há qty de BOMPicking não coberta por OPConsumptionControl
        return (qty - coveredByControl) > 0;
      }).map(delivery => {
        const compId = delivery.consumed_product_id || delivery.component_id;
        const qty = Number(delivery.qty || delivery.qty_delivered) || 0;
        
        const key = `${delivery.op_id}-${compId}`;
        const coveredByControl = opControlQtyByKey[key] || 0;
        const bomPickingQty = qty - coveredByControl;
        
        const op = allOPs.find(o => o.id === delivery.op_id);
        const product = products?.find(p => p.id === compId);
        const warehouse = warehouses?.find(w => w.id === delivery.from_warehouse_id);
        const location = locations?.find(l => l.id === delivery.from_location_id);
        const locationDescription = location ? `${location.rua || ''}${location.rua && location.modulo ? ' / ' : ''}${location.modulo || ''}${(location.rua || location.modulo) && location.nivel ? ' / ' : ''}${location.nivel || ''}${(location.rua || location.modulo || location.nivel) && location.posicao ? ' / ' : ''}${location.posicao || ''}`.trim() : '';

        return {
          id: `bom-${delivery.id}`,
          op_id: delivery.op_id,
          op_number: delivery.op_number || op?.op_number || '',
          numero_op_externo: op?.numero_op_externo || '',
          product_id: op?.product_id || '',
          product_name: op?.product_name || '',
          consumed_product_id: compId,
          consumed_product_sku: delivery.consumed_product_sku || delivery.component_sku || product?.sku || '',
          consumed_product_name: delivery.consumed_product_name || delivery.component_name || product?.name || '',
          qty: bomPickingQty,
          op_status: op?.status,
          control_status: 'ABERTO',
          created_date: delivery.updated_date || delivery.created_date,
          warehouse_id: delivery.from_warehouse_id,
          warehouse_name: delivery.from_warehouse_name || warehouse?.name || '',
          location_id: delivery.from_location_id,
          location_barcode: delivery.from_location_barcode || location?.barcode || '',
          location_description: locationDescription,
          from_bom_delivery: true,
        };
      }),
      // Material Consumptions - apenas se NÃO existe OPConsumptionControl para este produto+OP
      ...materialConsumptions.filter(consumption => {
        const key = `${consumption.op_id}-${consumption.product_id}`;
        return !opControlQtyByKey[key] && !bomOpProductKeys.has(key);
      }).map(consumption => {
        const op = allOPs.find(o => o.id === consumption.op_id);
        const warehouse = warehouses?.find(w => w.id === consumption.warehouse_id);
        const location = locations?.find(l => l.id === consumption.location_id);
        const locationDescription = location ? `${location.rua || ''}${location.rua && location.modulo ? ' / ' : ''}${location.modulo || ''}${(location.rua || location.modulo) && location.nivel ? ' / ' : ''}${location.nivel || ''}${(location.rua || location.modulo || location.nivel) && location.posicao ? ' / ' : ''}${location.posicao || ''}`.trim() : '';
        return {
          id: `material-${consumption.id}`,
          op_id: consumption.op_id,
          op_number: op?.op_number || consumption.op_id || '',
          product_id: op?.product_id || '',
          product_name: op?.product_name || '',
          consumed_product_id: consumption.product_id,
          consumed_product_sku: consumption.product_sku || '',
          consumed_product_name: consumption.product_name || '',
          qty: consumption.qty_consumed,
          op_status: op?.status,
          control_status: 'ABERTO',
          created_date: consumption.registered_date,
          warehouse_id: consumption.warehouse_id,
          warehouse_name: warehouse?.name || '',
          location_id: consumption.location_id,
          location_barcode: location?.barcode || '',
          location_description: locationDescription,
          from_material_consumption: true,
        };
      }),
      // Inventory Moves - apenas se NÃO há OPConsumptionControl vinculado E NÃO há BOMDelivery para o mesmo par OP+produto
      ...inventoryMoves.filter(move => {
        if (coveredMoveIds.has(move.id)) return false;
        if (bomOpProductKeys.has(`${move.related_id}-${move.product_id}`)) return false;
        if (opControlQtyByKey[`${move.related_id}-${move.product_id}`]) return false;
        return true;
      }).map(move => {
        const op = allOPs.find(o => o.id === move.related_id);
        const product = products?.find(p => p.id === move.product_id);
        return {
          id: `move-${move.id}`,
          op_id: move.related_id,
          op_number: op?.op_number || '',
          product_id: op?.product_id || '',
          product_name: op?.product_name || '',
          consumed_product_id: move.product_id,
          consumed_product_sku: product?.sku || '',
          consumed_product_name: product?.name || '',
          qty: move.qty,
          op_status: op?.status,
          control_status: 'ABERTO',
          created_date: move.created_date,
          inventory_move_id: move.id,
          from_inventory_move: true,
        };
      })
   ];

  // Agrupar por OP (consumos existentes)
    const groupedByOP = allConsumptions.reduce((acc, control) => {
      const op = allOPs.find(o => o.id === control.op_id);
      const opStatus = op?.status || control.op_status;

      const existing = acc.find(g => g.op_id === control.op_id);
      if (existing) {
        existing.items.push(control);
      } else {
        acc.push({
          op_id: control.op_id,
          op_number: control.op_number || op?.op_number || 'N/A',
          product_name: control.product_name || op?.product_name || 'N/A',
          op_status: opStatus,
          items: [control]
        });
      }
      return acc;
    }, []);

  // Incluir OPs ativas que ainda não têm nenhum consumo registrado
  const ACTIVE_STATUSES_ALL = ['ABERTA', 'EM_ANDAMENTO', 'PAUSADA'];
  allOPs.filter(op => ACTIVE_STATUSES_ALL.includes(op.status)).forEach(op => {
    if (!groupedByOP.find(g => g.op_id === op.id)) {
      groupedByOP.push({
        op_id: op.id,
        op_number: op.op_number || op.numero_op_externo || 'N/A',
        product_name: op.product_name || 'N/A',
        op_status: op.status,
        items: []
      });
    }
  });

  // Filtrar por busca e status
  const ACTIVE_STATUSES = ['ABERTA', 'EM_ANDAMENTO', 'PAUSADA'];
  const filtered = groupedByOP.filter(group => {
    const matchesSearch = group.op_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesStatus;
    if (statusFilter === 'TODOS') {
      matchesStatus = true;
    } else if (statusFilter === 'ATIVOS') {
      matchesStatus = ACTIVE_STATUSES.includes(group.op_status);
    } else {
      matchesStatus = group.op_status === statusFilter;
    }
    return matchesSearch && matchesStatus;
  });

  const handleShowDetails = (group) => {
    setSelectedOP(group);
    setDetailDialogOpen(true);
  };

  const handleReverseConsumption = (item) => {
    setSelectedConsumption(item);
    setReverseDialogOpen(true);
  };

  if (controlsLoading || materialLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const totalItems = filtered.reduce((sum, g) => sum + g.items.length, 0);
  const totalOPs = filtered.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Controle de Consumo em OP</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-slate-600 text-sm">OPs Abertas</p>
                <p className="text-3xl font-bold text-indigo-600">{totalOPs}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-slate-600 text-sm">Itens em Controle</p>
                <p className="text-3xl font-bold text-amber-600">{totalItems}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-slate-600 text-sm">Últimas 24h</p>
                <p className="text-3xl font-bold text-slate-600">
                  {allConsumptions.filter(c => {
                    const date = new Date(c.created_date);
                    const now = new Date();
                    return (now - date) < 24 * 60 * 60 * 1000;
                  }).length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Pesquisar por número da OP ou produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ATIVOS">OPs Ativas (padrão)</SelectItem>
            <SelectItem value="TODOS">Todos os Status</SelectItem>
            <SelectItem value="ABERTA">Aberta</SelectItem>
            <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
            <SelectItem value="PAUSADA">Pausada</SelectItem>
            <SelectItem value="ENCERRADA">Encerrada</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        {searchTerm && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSearchTerm('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* OPs List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">
                   {allConsumptions.length === 0 ? 'Nenhuma OP com consumo em controle' : 'Nenhuma OP encontrada'}
                 </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((group) => (
            <Card key={group.op_id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-lg">{group.op_number}</CardTitle>
                      <Badge className={STATUS_CONFIG[group.op_status]?.color}>
                        {STATUS_CONFIG[group.op_status]?.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">
                      <Package className="h-4 w-4 inline mr-2" />
                      {group.product_name}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShowDetails(group)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Itens
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm text-slate-900">
                          {item.consumed_product_name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          SKU: {item.consumed_product_sku}
                        </p>
                        {(item.warehouse_name || item.location_description) && (
                          <p className="text-xs text-slate-600 mt-1">
                            {item.warehouse_name && <span>{item.warehouse_name}</span>}
                            {item.warehouse_name && item.location_description && <span> • </span>}
                            {item.location_description && <span>{item.location_description}</span>}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {item.qty} un
                        </Badge>
                        <p className="text-xs text-slate-500 mt-1">
                          {format(new Date(item.created_date), 'dd/MM HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-slate-600">Total: </span>
                    <span className="font-bold text-slate-900">
                      {group.items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0).toFixed(2)} unidades
                    </span>
                  </div>
                  <Link to={createPageUrl(`ProductionOrderDetail?id=${group.op_id}`)}>
                    <Button variant="outline" size="sm">
                      Abrir OP
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reverse Consumption Dialog */}
      <ReverseConsumptionDialog
        open={reverseDialogOpen}
        onOpenChange={setReverseDialogOpen}
        consumptionItem={selectedConsumption}
        bomDelivery={selectedConsumption ? bomDeliveries.find(bd => {
          const compId = bd.consumed_product_id || bd.component_id;
          return bd.op_id === selectedConsumption.op_id && compId === selectedConsumption.consumed_product_id;
        }) : null}
        companyId={companyId}
      />

      {/* Detail Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        selectedOP={selectedOP}
        liveOP={selectedOP ? (groupedByOP.find(g => g.op_id === selectedOP.op_id) || selectedOP) : null}
        onReverseConsumption={handleReverseConsumption}
      />
    </div>
  );
}

function DetailDialog({ open, onOpenChange, selectedOP, liveOP, onReverseConsumption }) {
  if (!selectedOP || !liveOP) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes - OP {liveOP.op_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="text-xs text-slate-500">Produto</p>
              <p className="font-medium text-slate-900">{liveOP.product_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <Badge className={STATUS_CONFIG[liveOP.op_status]?.color}>
                {STATUS_CONFIG[liveOP.op_status]?.label}
              </Badge>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <th className="text-left p-2 font-semibold text-slate-700">Produto Consumido</th>
                  <th className="text-left p-2 font-semibold text-slate-700">SKU</th>
                  <th className="text-center p-2 font-semibold text-slate-700">Qtd</th>
                  <th className="text-left p-2 font-semibold text-slate-700">Data</th>
                  <th className="text-center p-2 font-semibold text-slate-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {liveOP.items.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-slate-50">
                    <td className="p-2">
                      <p className="text-sm">{item.consumed_product_name}</p>
                      {(item.warehouse_name || item.location_description) && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.warehouse_name && <span>{item.warehouse_name}</span>}
                          {item.warehouse_name && item.location_description && <span> • </span>}
                          {item.location_description && <span>{item.location_description}</span>}
                        </p>
                      )}
                    </td>
                    <td className="p-2 font-mono text-xs text-slate-600">{item.consumed_product_sku}</td>
                    <td className="p-2 text-center font-medium">{item.qty}</td>
                    <td className="p-2 text-xs text-slate-600">
                      {format(new Date(item.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReverseConsumption(item)}
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-slate-50 font-bold">
                  <td colSpan="2" className="p-2">Total</td>
                  <td className="p-2 text-center">
                    {liveOP.items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0).toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}