import React, { useState, useMemo } from 'react';
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

  // Queries
  const { data: controls = [], isLoading: controlsLoading } = useQuery({
    queryKey: ['op-consumption-controls', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return await base44.entities.OPConsumptionControl.filter({ company_id: companyId });
    },
    enabled: !!companyId,
  });

  const { data: materialConsumptions = [], isLoading: materialLoading } = useQuery({
    queryKey: ['material-consumptions', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      try {
        return await base44.entities.MaterialConsumption.filter({ company_id: companyId });
      } catch (e) { return []; }
    },
    enabled: !!companyId,
  });

  const { data: allOPs = [] } = useQuery({
    queryKey: ['ops-all', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return await base44.entities.ProductionOrder.filter({ company_id: companyId });
    },
    enabled: !!companyId,
  });

  const { data: bomDeliveries = [] } = useQuery({
    queryKey: ['bom-delivery-controls', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      // Busca global já que a tabela não tem company_id
      return await base44.entities.BOMDeliveryControl.list('-created_at', 5000);
    },
    enabled: !!companyId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return await base44.entities.Warehouse.filter({ company_id: companyId });
    },
    enabled: !!companyId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return await base44.entities.Location.filter({ company_id: companyId });
    },
    enabled: !!companyId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return await base44.entities.Product.filter({ company_id: companyId });
    },
    enabled: !!companyId,
  });

  const { data: inventoryMoves = [] } = useQuery({
    queryKey: ['inventory-moves-to-op', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const moves = await base44.entities.InventoryMove.filter({ company_id: companyId });
      return moves.filter(m => 
        m.related_type === 'OP' && 
        (m.type === 'SAIDA' || m.type === 'PRODUCAO_CONSUMO')
      );
    },
    enabled: !!companyId,
  });

  // Data processing logic wrapped in useMemo to prevent re-calculations and stabilize refs
  const allConsumptions = useMemo(() => {
    // Inventory Moves já cobertos por OPConsumptionControl
    const coveredMoveIds = new Set(
      controls.filter(c => c.control_status !== 'FECHADO' && c.inventory_move_id)
        .map(c => c.inventory_move_id)
    );

    // Soma de quantidades por par OP+Produto já em Controle
    const opControlQtyByKey = {};
    controls.filter(c => c.control_status !== 'FECHADO').forEach(c => {
      const key = `${c.op_id}-${c.consumed_product_id}`;
      opControlQtyByKey[key] = (opControlQtyByKey[key] || 0) + (Number(c.qty) || 0);
    });

    // Chaves OP+Produto já atendidas via BOMDelivery para evitar duplicatas manuais
    const bomOpProductKeys = new Set();
    bomDeliveries.forEach(bd => {
      const qty = Number(bd.qty) || 0;
      if (qty > 0) {
        const compId = bd.consumed_product_id || bd.component_id;
        bomOpProductKeys.add(`${bd.op_id}-${compId}`);
      }
    });

    const items = [
      // 1. Controles Abertos existentes
      ...controls.filter(c => c.control_status !== 'FECHADO'),

      // 2. BOM Deliveries não vinculados
      ...bomDeliveries.filter(bd => {
        const qty = Number(bd.qty) || 0;
        if (qty <= 0) return false;
        const compId = bd.consumed_product_id || bd.component_id;
        const key = `${bd.op_id}-${compId}`;
        const covered = opControlQtyByKey[key] || 0;
        return (qty - covered) > 0.001;
      }).map(delivery => {
        const compId = delivery.consumed_product_id || delivery.component_id;
        const qty = Number(delivery.qty) || 0;
        const key = `${delivery.op_id}-${compId}`;
        const coveredByControl = opControlQtyByKey[key] || 0;
        const bomPickingQty = qty - coveredByControl;
        
        const op = allOPs.find(o => o.id === delivery.op_id);
        const product = products.find(p => p.id === compId);
        const location = locations.find(l => l.id === delivery.from_location_id);
        
        return {
          id: `bom-${delivery.id}`,
          op_id: delivery.op_id,
          op_number: delivery.op_number || op?.op_number || 'N/A',
          numero_op_externo: op?.numero_op_externo || '',
          product_id: op?.product_id || '',
          product_name: op?.product_name || 'N/A',
          consumed_product_id: compId,
          consumed_product_sku: delivery.consumed_product_sku || delivery.component_sku || product?.sku || 'N/A',
          consumed_product_name: delivery.consumed_product_name || delivery.component_name || product?.name || 'N/A',
          qty: bomPickingQty,
          op_status: op?.status || 'ABERTA',
          control_status: 'ABERTO',
          created_date: delivery.updated_date || delivery.created_date,
          warehouse_id: delivery.from_warehouse_id,
          warehouse_name: delivery.from_warehouse_name || '',
          location_barcode: delivery.from_location_barcode || location?.barcode || '',
          from_bom_delivery: true,
        };
      }),

      // 3. Material Consumptions sem controle
      ...materialConsumptions.filter(consumption => {
        const key = `${consumption.op_id}-${consumption.product_id}`;
        return !opControlQtyByKey[key] && !bomOpProductKeys.has(key);
      }).map(consumption => {
        const op = allOPs.find(o => o.id === consumption.op_id);
        return {
          id: `material-${consumption.id}`,
          op_id: consumption.op_id,
          op_number: op?.op_number || 'N/A',
          product_name: op?.product_name || 'N/A',
          consumed_product_id: consumption.product_id,
          consumed_product_sku: consumption.product_sku || 'N/A',
          consumed_product_name: consumption.product_name || 'N/A',
          qty: consumption.qty_consumed,
          op_status: op?.status || 'ABERTA',
          control_status: 'ABERTO',
          created_date: consumption.registered_date,
          from_material_consumption: true,
        };
      }),

      // 4. Inventory Moves residuais
      ...inventoryMoves.filter(move => {
        if (coveredMoveIds.has(move.id)) return false;
        const key = `${move.related_id}-${move.product_id}`;
        if (bomOpProductKeys.has(key)) return false;
        if (opControlQtyByKey[key]) return false;
        return true;
      }).map(move => {
        const op = allOPs.find(o => o.id === move.related_id);
        const product = products.find(p => p.id === move.product_id);
        return {
          id: `move-${move.id}`,
          op_id: move.related_id,
          op_number: op?.op_number || 'N/A',
          product_name: op?.product_name || 'N/A',
          consumed_product_id: move.product_id,
          consumed_product_sku: product?.sku || 'N/A',
          consumed_product_name: product?.name || 'N/A',
          qty: move.qty,
          op_status: op?.status || 'ABERTA',
          control_status: 'ABERTO',
          created_date: move.created_date,
          inventory_move_id: move.id,
          from_inventory_move: true,
        };
      })
    ];
    return items;
  }, [controls, bomDeliveries, materialConsumptions, inventoryMoves, allOPs, products, locations]);

  // Group items by OP
  const groupedData = useMemo(() => {
    const acc = [];
    allConsumptions.forEach(item => {
      let group = acc.find(g => g.op_id === item.op_id);
      if (!group) {
        group = {
          op_id: item.op_id,
          op_number: item.op_number || 'N/A',
          product_name: item.product_name || 'N/A',
          op_status: item.op_status || 'ABERTA',
          items: []
        };
        acc.push(group);
      }
      group.items.push(item);
    });

    // Adicionar OPs ativas sem consumo
    const ACTIVE_STATUSES = ['ABERTA', 'EM_ANDAMENTO', 'PAUSADA'];
    allOPs.filter(op => ACTIVE_STATUSES.includes(op.status)).forEach(op => {
      if (!acc.find(g => g.op_id === op.id)) {
        acc.push({
          op_id: op.id,
          op_number: op.op_number || 'N/A',
          product_name: op.product_name || 'N/A',
          op_status: op.status,
          items: []
        });
      }
    });
    return acc;
  }, [allConsumptions, allOPs]);

  // Filter grouped data
  const filteredGroups = useMemo(() => {
    const filter = statusFilter;
    const term = searchTerm.toLowerCase();
    const ACTIVE_STATUSES = ['ABERTA', 'EM_ANDAMENTO', 'PAUSADA'];

    return groupedData.filter(group => {
      const matchesSearch = (group.op_number || '').toLowerCase().includes(term) ||
                            (group.product_name || '').toLowerCase().includes(term);
      let matchesStatus = true;
      if (filter === 'ATIVOS') matchesStatus = ACTIVE_STATUSES.includes(group.op_status);
      else if (filter !== 'TODOS') matchesStatus = group.op_status === filter;

      return matchesSearch && matchesStatus;
    });
  }, [groupedData, searchTerm, statusFilter]);

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
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Stats omitted for brevity or can be re-added if needed */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Controle de Consumo em OP</h1>
      </div>

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
            <SelectItem value="ATIVOS">OPs Ativas</SelectItem>
            <SelectItem value="TODOS">Todos os Status</SelectItem>
            <SelectItem value="ABERTA">Aberta</SelectItem>
            <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
            <SelectItem value="PAUSADA">Pausada</SelectItem>
            <SelectItem value="ENCERRADA">Encerrada</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredGroups.length === 0 ? (
        <Card><CardContent className="pt-12 text-center text-slate-500">Nenhuma OP encontrada</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(group => (
            <Card key={group.op_id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="bg-slate-50 pb-3 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{group.op_number}</CardTitle>
                    <Badge className={STATUS_CONFIG[group.op_status]?.color || 'bg-slate-100'}>
                      {STATUS_CONFIG[group.op_status]?.label || group.op_status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 font-medium">{group.product_name}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleShowDetails(group)}>
                  <Eye className="h-4 w-4 mr-2" /> Ver Itens
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {group.items.slice(0, 3).map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border text-sm">
                      <div>
                        <p className="font-medium">{item.consumed_product_name}</p>
                        <p className="text-xs text-slate-500">SKU: {item.consumed_product_sku}</p>
                      </div>
                      <Badge variant="secondary">{item.qty} un</Badge>
                    </div>
                  ))}
                  {group.items.length > 3 && (
                    <p className="text-xs text-center text-slate-400">+{group.items.length - 3} outros itens</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedOP && (
        <DetailDialog 
          open={detailDialogOpen} 
          onOpenChange={setDetailDialogOpen} 
          group={selectedOP} 
          onReverse={handleReverseConsumption}
        />
      )}

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
    </div>
  );
}

function DetailDialog({ open, onOpenChange, group, onReverse }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Itens da OP {group.op_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {group.items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
              <div className="flex-1">
                <p className="font-semibold text-sm">{item.consumed_product_name}</p>
                <p className="text-xs text-slate-500">SKU: {item.consumed_product_sku}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {item.created_date ? format(new Date(item.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : ''}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-indigo-600">{item.qty} un</span>
                <Button variant="ghost" size="sm" onClick={() => onReverse(item)} className="text-amber-600">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {group.items.length === 0 && <p className="text-center py-8 text-slate-400">Nenhum consumo pendente</p>}
        </div>
        <div className="pt-4 border-t flex justify-between items-center text-sm">
          <span className="font-medium text-slate-600">Total de itens: {group.items.length}</span>
          <Link to={createPageUrl(`ProductionOrderDetail?id=${group.op_id}`)}>
            <Button size="sm">Abrir Detalhes da OP</Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}