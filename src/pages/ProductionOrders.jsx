import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { validateProductionOrderCancellation, validateProductionOrderClose } from '@/functions/validateOperationCancellation';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, Search, Eye, MoreHorizontal, Factory, Play, Pause, CheckCircle, XCircle, Link as LinkIcon, QrCode, AlertCircle, Loader2 } from 'lucide-react';
import QRCode from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';
import {
  Dialog as QRDialog,
  DialogContent as QRDialogContent,
  DialogHeader as QRDialogHeader,
  DialogTitle as QRDialogTitle,
} from '@/components/ui/dialog';

const STATUS_CONFIG = {
  ABERTA: { color: 'bg-blue-100 text-blue-700', label: 'Aberta' },
  EM_ANDAMENTO: { color: 'bg-amber-100 text-amber-700', label: 'Em Andamento' },
  PAUSADA: { color: 'bg-slate-100 text-slate-700', label: 'Pausada' },
  ENCERRADA: { color: 'bg-emerald-100 text-emerald-700', label: 'Encerrada' },
  CANCELADA: { color: 'bg-rose-100 text-rose-700', label: 'Cancelada' },
};

const PRIORITY_CONFIG = {
  BAIXA: { color: 'bg-slate-100 text-slate-700', label: 'Baixa' },
  NORMAL: { color: 'bg-blue-100 text-blue-700', label: 'Normal' },
  ALTA: { color: 'bg-amber-100 text-amber-700', label: 'Alta' },
  URGENTE: { color: 'bg-rose-100 text-rose-700', label: 'Urgente' },
};

function CreateOPForm({ products, routes, orders, warehouses, locations, onSave, onCancel, loading, companyId }) {
  const [form, setForm] = useState({
    numero_op_externo: '',
    product_id: '',
    product_name: '',
    route_id: '',
    route_name: '',
    qty_planned: 1,
    priority: 'NORMAL',
    start_date: '',
    due_date: '',
    parent_op_id: '',
    warehouse_id: '',
    warehouse_name: '',
    location_id: '',
    location_barcode: '',
    notes: ''
  });

  const [warehouseLocations, setWarehouseLocations] = useState([]);

  const handleProductChange = (productId) => {
    const product = products?.find(p => p.id === productId);
    const route = routes?.find(r => r.product_id === productId);
    setForm({ 
      ...form, 
      product_id: productId, 
      product_sku: product?.sku || '',
      product_name: product?.name || '',
      route_id: route?.id || '',
      route_name: route?.name || ''
    });
  };

  const handleWarehouseChange = async (warehouseId) => {
    const warehouse = warehouses?.find(w => w.id === warehouseId);
    setForm({
      ...form,
      warehouse_id: warehouseId,
      warehouse_name: warehouse?.name || '',
      location_id: '',
      location_barcode: ''
    });

    // Fetch locations for selected warehouse
    if (warehouseId && companyId) {
      const locs = await base44.entities.Location.filter({
        company_id: companyId,
        warehouse_id: warehouseId,
        active: true
      });
      setWarehouseLocations(locs || []);
    } else {
      setWarehouseLocations([]);
    }
  };

  const handleLocationChange = (locationId) => {
    const location = warehouseLocations?.find(l => l.id === locationId);
    setForm({
      ...form,
      location_id: locationId,
      location_barcode: location?.barcode || ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.numero_op_externo) {
      toast.error('Número da OP (TOTVS) é obrigatório');
      return;
    }
    if (!form.product_id || form.qty_planned <= 0) {
      toast.error('Produto e quantidade são obrigatórios');
      return;
    }
    if (!form.warehouse_id) {
      toast.error('Armazém de destino é obrigatório');
      return;
    }
    const opNumber = `OP-${Date.now().toString().slice(-8)}`;
    onSave({ ...form, op_number: opNumber, qty_produced: 0, status: 'ABERTA' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label className="text-base font-semibold">Número da OP (TOTVS) *</Label>
        <Input
          value={form.numero_op_externo}
          onChange={(e) => setForm({ ...form, numero_op_externo: e.target.value.toUpperCase() })}
          placeholder="Digite o número da OP do TOTVS"
          className="text-lg font-mono"
          autoFocus
        />
        <p className="text-sm text-slate-500">Digite o número da OP já criada no sistema TOTVS</p>
      </div>

      <ProductSearchSelect
        label="Produto"
        value={form.product_id}
        onSelect={handleProductChange}
        placeholder="Buscar por código ou descrição..."
        required
      />

      {form.route_name && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-sm text-emerald-700">
            ✓ Roteiro de produção será aplicado: <strong>{form.route_name}</strong>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Quantidade *</Label>
          <Input
            type="number"
            min="1"
            value={form.qty_planned}
            onChange={(e) => setForm({ ...form, qty_planned: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Prioridade</Label>
          <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data Início</Label>
          <Input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Data Prevista</Label>
          <Input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Armazém de Destino *</Label>
          <Select value={form.warehouse_id} onValueChange={handleWarehouseChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {warehouses?.map(w => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Localização de Destino</Label>
          <Select 
            value={form.location_id} 
            onValueChange={handleLocationChange}
            disabled={!form.warehouse_id}
          >
            <SelectTrigger>
              <SelectValue placeholder={form.warehouse_id ? "Selecione..." : "Escolha um armazém"} />
            </SelectTrigger>
            <SelectContent>
              {warehouseLocations?.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {l.barcode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Vincular a OP Pai (Opcional)</Label>
        <Select value={form.parent_op_id} onValueChange={(v) => setForm({ ...form, parent_op_id: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma OP pai..." />
          </SelectTrigger>
          <SelectContent>
            {orders?.filter(o => o.status !== 'ENCERRADA' && o.status !== 'CANCELADA').map(o => (
              <SelectItem key={o.id} value={o.id}>
                {o.numero_op_externo} - {o.product_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">Esta OP será vinculada como sub-operação</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Criando...' : 'Criar OP'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function ProductionOrders() {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyId();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedOPForQR, setSelectedOPForQR] = useState(null);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [closeWarnings, setCloseWarnings] = useState([]);
  const [pendingCloseOPId, setPendingCloseOPId] = useState(null);
  const [pendingCloseOPData, setPendingCloseOPData] = useState(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['production-orders', companyId],
    queryFn: () => companyId ? base44.entities.ProductionOrder.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ['products-all', companyId],
    queryFn: () => companyId ? base44.entities.Product.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: routes } = useQuery({
    queryKey: ['production-routes', companyId],
    queryFn: () => companyId ? base44.entities.ProductionRoute.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => companyId ? base44.entities.Warehouse.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => companyId ? base44.entities.Location.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Criar OP
      const op = await base44.entities.ProductionOrder.create({ ...data, company_id: companyId });
      console.log('✅ OP criada:', op.id, op.numero_op_externo);
      
      // Buscar BOM do produto — is_active é text no banco, pode ser "true" ou true
      const boms = await base44.entities.BOM.filter({ 
        company_id: companyId,
        product_id: data.product_id
      });
      
      console.log('🔍 BOMs encontradas para product_id', data.product_id, ':', boms.length, boms);
      
      // Filtrar manualmente por is_active (pode ser string "true" ou boolean true)
      const activeBoms = boms.filter(b => 
        b.is_active === true || b.is_active === 'true' || b.is_active === 'TRUE'
      );
      console.log('🔍 BOMs ativas:', activeBoms.length);
      
      if (activeBoms.length > 0) {
        const bom = activeBoms[0];
        console.log('📋 BOM selecionada:', bom.id, 'current_version_id:', bom.current_version_id);
        
        // Buscar itens do BOM — tentar com bom_version_id primeiro, fallback para bom_id
        let bomItems = [];
        
        if (bom.current_version_id) {
          bomItems = await base44.entities.BOMItem.filter({ 
            bom_version_id: bom.current_version_id 
          });
          console.log('🔍 BOMItems por bom_version_id:', bomItems.length);
        }
        
        // Fallback: buscar por bom_id se não encontrou por versão
        if (bomItems.length === 0) {
          bomItems = await base44.entities.BOMItem.filter({ 
            bom_id: bom.id 
          });
          console.log('🔍 BOMItems por bom_id (fallback):', bomItems.length);
        }
        
        console.log('📦 BOMItems encontrados:', bomItems.length, bomItems.map(i => i.component_name));
        
        // Criar etapas baseadas nos roteiros dos componentes do BOM
        let stepSequence = 1;
        const stepsToCreate = [];
        
        for (const bomItem of bomItems.sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0))) {
          // Se o item tem roteiros definidos (array routes)
          if (bomItem.routes && Array.isArray(bomItem.routes) && bomItem.routes.length > 0) {
            for (const routeRef of bomItem.routes.sort((a, b) => a.sequence - b.sequence)) {
              const routeSteps = await base44.entities.ProductionRouteStep.filter({ 
                company_id: companyId,
                route_id: routeRef.route_id 
              });
              
              if (routeSteps && routeSteps.length > 0) {
                for (const step of routeSteps.sort((a, b) => a.sequence - b.sequence)) {
                  stepsToCreate.push({
                    company_id: companyId,
                    op_id: op.id,
                    sequence: stepSequence++,
                    name: `${bomItem.component_name} - ${step.name}`,
                    description: step.description,
                    resource_type: step.resource_type,
                    resource_id: step.resource_id,
                    status: 'PENDENTE'
                  });
                }
              }
            }
          }
          // Fallback: se não tem array routes mas tem route_id
          else if (bomItem.route_id) {
            const routeSteps = await base44.entities.ProductionRouteStep.filter({ 
              company_id: companyId,
              route_id: bomItem.route_id 
            });
            
            if (routeSteps && routeSteps.length > 0) {
              for (const step of routeSteps.sort((a, b) => a.sequence - b.sequence)) {
                stepsToCreate.push({
                  company_id: companyId,
                  op_id: op.id,
                  sequence: stepSequence++,
                  name: `${bomItem.component_name} - ${step.name}`,
                  description: step.description,
                  resource_type: step.resource_type,
                  resource_id: step.resource_id,
                  status: 'PENDENTE'
                });
              }
            }
          }
        }
        
        // Criar todas as etapas
        if (stepsToCreate.length > 0) {
          await Promise.all(
            stepsToCreate.map(step => base44.entities.ProductionStep.create(step))
          );
          console.log('✅ Etapas criadas:', stepsToCreate.length);
        }

        // --- Criar controles de entrega de material (BOMDeliveryControl) ---
        console.log('🚀 Criando BOMDeliveryControl para', bomItems.length, 'itens...');
        for (const bomItem of bomItems) {
          const qtyPlannedNum = Number(bomItem.quantity || 0) * Number(data.qty_planned || 0);
          
          try {
            const ctrl = await base44.entities.BOMDeliveryControl.create({
              op_id: op.id,
              op_number: String(op.numero_op_externo || op.op_number || ''),
              numero_op_externo: String(op.numero_op_externo || ''),
              product_id: op.product_id,
              component_id: bomItem.component_id,
              qty_planned: isNaN(qtyPlannedNum) ? "0" : String(qtyPlannedNum),
              qty: "0",
              status: 'ABERTO'
            });
            console.log('✅ BOMDeliveryControl criado:', ctrl?.id, bomItem.component_name);
          } catch (err) {
            console.error('❌ Erro ao criar BOMDeliveryControl:', err, 'para', bomItem.component_name);
          }
        }
      } else {
        console.warn('⚠️ Nenhuma BOM ativa encontrada para o produto', data.product_id);
      }
      
      return op;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-orders', companyId] });
      setDialogOpen(false);
      toast.success('Ordem de Produção criada com sucesso');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, currentOrders, skipValidation = false }) => {
      const childOps = currentOrders?.filter(o => o.parent_op_id === id);

      if (status === 'ENCERRADA' && childOps?.length > 0) {
        const openChildren = childOps.filter(c => c.status !== 'ENCERRADA' && c.status !== 'CANCELADA');
        if (openChildren.length > 0) {
          throw new Error('Não é possível encerrar uma OP pai enquanto houver sub-operações em aberto');
        }
      }

      // Validações de encerramento (apenas se não for forçado)
      if (status === 'ENCERRADA' && !skipValidation) {
        const warnings = [];
        
        // 1. Verificar etapas pendentes
        const steps = await base44.entities.ProductionStep.filter({ 
          company_id: companyId, 
          op_id: id 
        });
        const pendingSteps = steps.filter(s => s.status !== 'CONCLUIDA' && s.status !== 'PULADA');
        if (pendingSteps.length > 0) {
          warnings.push(`${pendingSteps.length} etapa(s) de produção ainda não concluída(s)`);
        }
        
        // 2. Verificar se está vinculada a OP pai não encerrada
        const op = currentOrders?.find(o => o.id === id);
        if (op?.parent_op_id) {
          const parentOP = currentOrders?.find(o => o.id === op.parent_op_id);
          if (parentOP && parentOP.status !== 'ENCERRADA') {
            warnings.push(`Vinculada à OP pai ${parentOP.numero_op_externo} que ainda não foi encerrada`);
          }
        }
        
        // 3. Verificar BOM não entregue
        if (op) {
          const allBoms = await base44.entities.BOM.filter({
            company_id: companyId,
            product_id: op.product_id
          });
          const boms = allBoms.filter(b => b.is_active === true || b.is_active === 'true');
          
          if (boms?.[0]) {
            const bomItems = await base44.entities.BOMItem.filter({
              bom_version_id: boms[0].current_version_id
            });
            
            if (bomItems.length > 0) {
              const deliveryControls = await base44.entities.BOMDeliveryControl.filter({
                op_id: id
              });
              
              for (const bomItem of bomItems) {
                const qtyNeeded = bomItem.quantity * op.qty_planned;
                const delivered = deliveryControls
                  .filter(dc => dc.bom_item_id === bomItem.id)
                  .reduce((sum, dc) => sum + (dc.qty_delivered || 0), 0);
                
                if (delivered < qtyNeeded) {
                  warnings.push(`Componente ${bomItem.component_sku} - faltam ${qtyNeeded - delivered} unidades`);
                }
              }
            }
          }
        }
        
        // Se houver avisos, lançar erro com os warnings
        if (warnings.length > 0) {
          const error = new Error('VALIDACAO_PENDENCIAS');
          error.warnings = warnings;
          error.opData = op;
          throw error;
        }
      }

      // Se cancela a OP, deletar ProductionSteps órfãos
      if (status === 'CANCELADA') {
        const steps = await base44.entities.ProductionStep.filter({ company_id: companyId, op_id: id });
        if (steps?.length > 0) {
          for (const step of steps) {
            await base44.entities.ProductionStep.delete(step.id);
          }
        }
      }

      const updateData = { status };
      if (status === 'ENCERRADA') {
        updateData.closed_at = new Date().toISOString();
      }
      return base44.entities.ProductionOrder.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-orders', companyId] });
      toast.success('Status atualizado');
    },
    onError: (error) => {
      if (error.message === 'VALIDACAO_PENDENCIAS') {
        setCloseWarnings(error.warnings || []);
        setPendingCloseOPData(error.opData || null);
        setShowCloseWarning(true);
      } else {
        toast.error(error.message);
      }
    },
  });

  const linkMutation = useMutation({
    mutationFn: ({ childId, parentId }) => 
      base44.entities.ProductionOrder.update(childId, { parent_op_id: parentId || '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-orders', companyId] });
      toast.success('Vínculo atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar vínculo');
    },
  });

  const productSkuMap = useMemo(() => {
    const map = {};
    products?.forEach(p => { map[p.id] = p.sku; });
    return map;
  }, [products]);

  const filtered = orders?.filter(o => {
    const sku = o.product_sku || productSkuMap[o.product_id] || '';
    const matchesSearch = !search ||
      o.op_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.numero_op_externo?.toLowerCase().includes(search.toLowerCase()) ||
      o.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      sku.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ordens de Produção</h1>
          <p className="text-slate-500">Gerencie as ordens de produção</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-2" />
          Nova OP
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por OP TOTVS, número interno, SKU ou produto..."
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
              <Factory className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhuma OP encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OP</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Data Prevista</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((op) => {
                  const progress = op.qty_planned > 0 ? Math.round((op.qty_produced || 0) / op.qty_planned * 100) : 0;
                  
                  return (
                    <TableRow key={op.id}>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            {op.parent_op_id && <LinkIcon className="h-3 w-3 text-amber-500" />}
                            <span className="font-mono text-indigo-600 font-semibold text-base">{op.numero_op_externo}</span>
                          </div>
                          <p className="text-xs text-slate-500">Sistema: {op.op_number}</p>
                          {op.parent_op_id && (
                            <p className="text-xs text-amber-600">
                              {orders?.find(o => o.id === op.parent_op_id)?.numero_op_externo && `Vinculada a: ${orders.find(o => o.id === op.parent_op_id).numero_op_externo}`}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {(op.product_sku || productSkuMap[op.product_id]) && (
                            <p className="font-mono text-xs text-indigo-600 font-semibold">{op.product_sku || productSkuMap[op.product_id]}</p>
                          )}
                          <p className="font-medium">{op.product_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Progress value={progress} className="w-24 h-2" />
                          <span className="text-sm text-slate-500">
                            {op.qty_produced || 0}/{op.qty_planned}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={PRIORITY_CONFIG[op.priority]?.color}>
                          {PRIORITY_CONFIG[op.priority]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {op.due_date ? format(new Date(op.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_CONFIG[op.status]?.color}>
                          {STATUS_CONFIG[op.status]?.label}
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
                              <Link to={createPageUrl(`ProductionOrderDetail?id=${op.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalhes
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedOPForQR(op);
                              setQrDialogOpen(true);
                            }}>
                              <QrCode className="h-4 w-4 mr-2" />
                              Ver QR Code
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <button
                                onClick={() => {
                                  const parentOps = orders?.filter(o => o.status !== 'ENCERRADA' && o.status !== 'CANCELADA' && o.id !== op.id);
                                  if (parentOps?.length === 0) {
                                    toast.error('Nenhuma OP disponível para vincular');
                                    return;
                                  }
                                  const newParentId = prompt('Digite o ID ou número da OP pai (deixe em branco para desvincular):');
                                  if (newParentId !== null) {
                                    if (newParentId === '') {
                                      linkMutation.mutate({ childId: op.id, parentId: '' });
                                    } else {
                                      const parent = parentOps.find(p => p.id === newParentId || p.numero_op_externo === newParentId);
                                      if (parent) {
                                        linkMutation.mutate({ childId: op.id, parentId: parent.id });
                                      } else {
                                        toast.error('OP pai não encontrada');
                                      }
                                    }
                                  }
                                }}
                                className="w-full text-left"
                              >
                                <LinkIcon className="h-4 w-4 mr-2" />
                                {op.parent_op_id ? 'Alterar Vínculo' : 'Vincular a OP Pai'}
                              </button>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {op.status === 'ABERTA' && (
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: op.id, status: 'EM_ANDAMENTO', currentOrders: orders })}>
                                <Play className="h-4 w-4 mr-2" />
                                Iniciar
                              </DropdownMenuItem>
                            )}
                            {op.status === 'EM_ANDAMENTO' && (
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: op.id, status: 'PAUSADA', currentOrders: orders })}>
                                <Pause className="h-4 w-4 mr-2" />
                                Pausar
                              </DropdownMenuItem>
                            )}
                            {op.status === 'PAUSADA' && (
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: op.id, status: 'EM_ANDAMENTO', currentOrders: orders })}>
                                <Play className="h-4 w-4 mr-2" />
                                Retomar
                              </DropdownMenuItem>
                            )}
                            {['ABERTA', 'EM_ANDAMENTO', 'PAUSADA'].includes(op.status) && (
                              <>
                                <DropdownMenuItem 
                                  onClick={async () => {
                                    const validation = await validateProductionOrderClose({ opId: op.id, companyId, orders });
                                    if (!validation.canClose) {
                                      toast.error(validation.message);
                                      return;
                                    }
                                    setPendingCloseOPId(op.id);
                                    updateStatusMutation.mutate({ id: op.id, status: 'ENCERRADA', currentOrders: orders });
                                  }}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Encerrar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={async () => {
                                    try {
                                      const validation = await validateProductionOrderCancellation({ opId: op.id, companyId });
                                      if (!validation.canCancel) {
                                        toast.error(validation.message);
                                        return;
                                      }
                                      updateStatusMutation.mutate({ id: op.id, status: 'CANCELADA', currentOrders: orders });
                                    } catch (error) {
                                      toast.error(error.message || 'Erro ao validar cancelamento');
                                    }
                                  }}
                                  className="text-red-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancelar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Ordem de Produção</DialogTitle>
          </DialogHeader>
          <CreateOPForm
            products={products}
            routes={routes}
            orders={orders}
            warehouses={warehouses}
            locations={locations}
            companyId={companyId}
            onSave={(data) => createMutation.mutate(data)}
            onCancel={() => setDialogOpen(false)}
            loading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Close Warning Dialog */}
      <Dialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Atenção: Pendências Identificadas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-600">
              Foram identificadas as seguintes pendências para esta OP:
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              {closeWarnings.map((warning, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-900">{warning}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-600">
              Deseja encerrar a OP mesmo assim?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCloseWarning(false);
              setPendingCloseOPId(null);
              setPendingCloseOPData(null);
            }}>
              Cancelar
            </Button>
            {pendingCloseOPData?.parent_op_id && closeWarnings.some(w => w.includes('OP pai')) && (
              <Button 
                onClick={async () => {
                  try {
                    await base44.entities.ProductionOrder.update(pendingCloseOPId, { parent_op_id: null });
                    updateStatusMutation.mutate({ 
                      id: pendingCloseOPId, 
                      status: 'ENCERRADA', 
                      currentOrders: orders,
                      skipValidation: true 
                    });
                    setShowCloseWarning(false);
                    setPendingCloseOPId(null);
                    setPendingCloseOPData(null);
                  } catch (e) {
                    toast.error('Erro ao desvincular OP');
                  }
                }}
                disabled={updateStatusMutation.isPending}
                variant="outline"
              >
                Desvincular e Encerrar
              </Button>
            )}
            <Button 
              onClick={() => {
                updateStatusMutation.mutate({ 
                  id: pendingCloseOPId, 
                  status: 'ENCERRADA', 
                  currentOrders: orders,
                  skipValidation: true 
                });
                setShowCloseWarning(false);
                setPendingCloseOPId(null);
                setPendingCloseOPData(null);
              }}
              disabled={updateStatusMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Encerrar Mesmo Assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <QRDialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <QRDialogContent className="max-w-md">
          <QRDialogHeader>
            <QRDialogTitle>QR Code da OP</QRDialogTitle>
          </QRDialogHeader>
          {selectedOPForQR && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-indigo-600 mb-1">
                  {selectedOPForQR.numero_op_externo}
                </p>
                <p className="text-sm text-slate-600">{selectedOPForQR.product_name}</p>
              </div>
              <div className="bg-white p-6 rounded-lg border-2 border-slate-200">
                <QRCode 
                  value={selectedOPForQR.numero_op_externo} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-xs text-slate-500 text-center">
                Escaneie este código para vincular movimentações a esta OP
              </p>
              <Button
                onClick={() => {
                  const canvas = document.querySelector('canvas');
                  const url = canvas.toDataURL();
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `OP-${selectedOPForQR.numero_op_externo}.png`;
                  a.click();
                  toast.success('QR Code baixado');
                }}
                variant="outline"
                className="w-full"
              >
                Baixar QR Code
              </Button>
            </div>
          )}
        </QRDialogContent>
      </QRDialog>
    </div>
  );
}