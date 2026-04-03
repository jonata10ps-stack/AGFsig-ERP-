import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, CheckCircle2, Package, MapPin, 
  BarChart3, Loader2, QrCode, X, Zap, AlertTriangle 
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { processProductionOrderControls } from '@/utils/productionControlUtils';
import { executeInventoryTransaction } from '@/utils/inventoryTransactionUtils';
import QRScanner from '@/components/scanner/QRScanner';

export default function BOMDeliveryPicking() {
  const { companyId } = useCompanyId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const opId = urlParams.get('op_id');

  const initializingRef = useRef(false);
  const [scannedComponent, setScannedComponent] = useState(null);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [deliveryQty, setDeliveryQty] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [locationScannerOpen, setLocationScannerOpen] = useState(false);

  // Queries
  const { data: op, isLoading: loadingOP } = useQuery({
    queryKey: ['production-order', opId, companyId],
    queryFn: () => base44.entities.ProductionOrder.filter({ company_id: companyId, id: opId }),
    select: (data) => data?.[0],
    enabled: !!opId && !!companyId,
  });

  const { data: deliveryControls = [], isLoading: loadingControls, refetch: refetchControls } = useQuery({
    queryKey: ['bom-delivery-controls', opId],
    queryFn: () => opId ? base44.entities.BOMDeliveryControl.filter({ op_id: opId }) : Promise.resolve([]),
    enabled: !!opId,
  });

  const { data: opConsumptions = [] } = useQuery({
    queryKey: ['op-consumption-controls-for-picking', opId],
    queryFn: () => opId ? base44.entities.OPConsumptionControl.filter({ op_id: opId }) : Promise.resolve([]),
    enabled: !!opId,
  });

  const { data: materialConsumptions = [] } = useQuery({
    queryKey: ['material-consumptions-for-picking', opId],
    queryFn: () => opId ? base44.entities.MaterialConsumption.filter({ op_id: opId }) : Promise.resolve([]),
    enabled: !!opId,
  });

  const { data: bom } = useQuery({
    queryKey: ['bom', op?.product_id, companyId],
    queryFn: async () => {
      if (!op?.product_id) return null;
      const boms = await base44.entities.BOM.filter({ company_id: companyId, product_id: op.product_id });
      return boms.find(b => b.is_active === true || b.is_active === 'true' || b.is_active === 'TRUE') || null;
    },
    enabled: !!op?.product_id && !!companyId,
  });

  const { data: bomItems = [] } = useQuery({
    queryKey: ['bom-items', bom?.current_version_id],
    queryFn: () => base44.entities.BOMItem.filter({ bom_version_id: bom.current_version_id }),
    enabled: !!bom?.current_version_id,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-all-picking', companyId],
    queryFn: () => companyId ? base44.entities.Product.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations-picking', companyId],
    queryFn: () => companyId ? base44.entities.Location.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: productionSteps = [] } = useQuery({
    queryKey: ['production-steps-picking', op?.route_id, bom?.current_version_id, companyId],
    queryFn: async () => {
      if (!companyId || !bom?.current_version_id) return [];
      try {
        const routeIds = new Set();
        if (op?.route_id) routeIds.add(op.route_id);
        bomItems.forEach(item => {
          if (item.route_id) routeIds.add(item.route_id);
          if (item.routes && Array.isArray(item.routes)) {
            item.routes.forEach(r => { if (r.route_id) routeIds.add(r.route_id); });
          }
        });
        if (routeIds.size === 0) return [];
        const allSteps = [];
        for (const rId of routeIds) {
          const steps = await base44.entities.ProductionRouteStep.filter({ company_id: companyId, route_id: rId });
          allSteps.push(...steps);
        }
        return Array.from(new Map(allSteps.map(s => [s.id, s])).values()).sort((a, b) => a.sequence - b.sequence);
      } catch (e) { return []; }
    },
    enabled: !!bom?.current_version_id && !!companyId,
  });
  const initializeControlMutation = useMutation({
    mutationFn: async ({ bomVersionId, opData }) => {
      console.log('🚀 Inicializando controles de entrega para OP:', opData.op_number);
      const items = await base44.entities.BOMItem.filter({ bom_version_id: bomVersionId });
      
      const promises = items.map(item => {
        const qtyPlannedNum = Number(item.quantity || 0) * Number(opData.qty_planned || 0);
        return base44.entities.BOMDeliveryControl.create({
          company_id: companyId,
          op_id: opData.id,
          numero_op_externo: opData.numero_op_externo,
          product_id: opData.product_id,
          component_id: item.component_id,
          qty_planned: isNaN(qtyPlannedNum) ? "0" : String(qtyPlannedNum),
          qty: "0",
          status: 'ABERTO'
        });
      });
      
      await Promise.all(promises);
      initializingRef.current = false;
      refetchControls();
    }
  });

  // Auto-inicializar se não houver controles
  useEffect(() => {
    if (!loadingControls && !loadingOP && deliveryControls.length === 0 && bom?.current_version_id && op && !initializingRef.current) {
      initializingRef.current = true;
      initializeControlMutation.mutate({ bomVersionId: bom.current_version_id, opData: op });
    }
  }, [deliveryControls, loadingControls, bom, op]);

  // Unify and aggregate all delivery/consumption data
  const unifiedItems = useMemo(() => {
    const itemsMap = {};

    // 1. Iniciar com todos os itens da BOM (planejamento teórico)
    bomItems.forEach(bi => {
      const prodId = bi.component_id;
      if (!prodId) return;
      
      // Cálculo teórico caso não exista registro no banco ainda
      const theoreticalQty = Number(bi.quantity || 0) * Number(op?.qty_planned || 0);

      itemsMap[prodId] = {
        id: `bom-${bi.id}`,
        consumed_product_id: prodId,
        consumed_product_name: bi.component_name || 'N/A',
        consumed_product_sku: bi.component_sku || 'N/A',
        qty_planned: theoreticalQty,
        qty_delivered_bom: 0,
        qty_total_actual: 0,
        status: 'ABERTO',
      };
    });

    // 2. Sobrepor com dados reais de Delivery Control
    deliveryControls.forEach(dc => {
      const prodId = dc.component_id || dc.consumed_product_id;
      if (!prodId) return;

      if (itemsMap[prodId]) {
        itemsMap[prodId].id = dc.id;
        itemsMap[prodId].qty_delivered_bom = Number(dc.qty) || 0;
        itemsMap[prodId].status = dc.status || 'ABERTO';
        
        // PRIORIDADE: Usar a quantidade planejada que está gravada no banco de dados para esta OP
        const dbQtyPlanned = Number(dc.qty_planned || dc.qty_required) || 0;
        if (dbQtyPlanned > 0) {
          itemsMap[prodId].qty_planned = dbQtyPlanned;
        }

        // PRIORIDADE: Buscar nome/sku dinamicamente do cadastro de produtos se não houver na BOM
        const product = products.find(p => p.id === prodId);
        if (product) {
          if (!itemsMap[prodId].consumed_product_name || itemsMap[prodId].consumed_product_name === 'N/A') {
            itemsMap[prodId].consumed_product_name = product.name;
          }
          if (!itemsMap[prodId].consumed_product_sku || itemsMap[prodId].consumed_product_sku === 'N/A') {
            itemsMap[prodId].consumed_product_sku = product.sku;
          }
        }
      } else {
        // Item que estranhamente está no controle mas não na BOMItem atual (talvez versão trocou)
        const product = products.find(p => p.id === prodId);
        itemsMap[prodId] = {
          id: dc.id,
          consumed_product_id: prodId,
          consumed_product_name: dc.product_name || product?.name || 'N/A',
          consumed_product_sku: dc.product_sku || product?.sku || 'N/A',
          qty_planned: Number(dc.qty_planned || dc.qty_required) || 0,
          qty_delivered_bom: Number(dc.qty) || 0,
          qty_total_actual: 0,
          status: dc.status || 'ABERTO',
        };
      }
    });

    // 3. Adicionar consumos extras de OPConsumptionControl
    opConsumptions.forEach(oc => {
      const prodId = oc.consumed_product_id;
      if (!prodId) return;

      if (!itemsMap[prodId]) {
        const product = products.find(p => p.id === prodId);
        itemsMap[prodId] = {
          id: `extra-${prodId}`,
          consumed_product_id: prodId,
          consumed_product_name: oc.consumed_product_name || product?.name || 'Item Extra',
          consumed_product_sku: oc.consumed_product_sku || product?.sku || 'N/A',
          qty_planned: 0,
          qty_delivered_bom: 0,
          qty_total_actual: 0,
          is_extra: true,
          status: 'ENTREGUE'
        };
      }
      itemsMap[prodId].qty_total_actual = Math.max(itemsMap[prodId].qty_total_actual, Number(oc.qty) || 0);
    });

    // 4. Adicionar Material Consumptions 
    materialConsumptions.forEach(mc => {
      const prodId = mc.product_id;
      if (!prodId || !itemsMap[prodId]) return;
      itemsMap[prodId].qty_total_actual = Math.max(itemsMap[prodId].qty_total_actual, Number(mc.qty_consumed) || 0);
    });

    // Final merge: Garantir que qty_total_actual reflita o máximo entre picking e consumo
    Object.values(itemsMap).forEach(item => {
      item.qty_total_actual = Math.max(item.qty_total_actual, item.qty_delivered_bom);
      if (item.qty_planned > 0 && item.qty_total_actual >= item.qty_planned) {
        item.status = 'ENTREGUE';
      }
    });

    return Object.values(itemsMap);
  }, [deliveryControls, opConsumptions, materialConsumptions, bomItems, products, op?.qty_planned]);

  const stats = useMemo(() => {
    const totalRequired = unifiedItems.reduce((sum, item) => sum + (Number(item.qty_planned) || 0), 0);
    const totalDelivered = unifiedItems.reduce((sum, item) => sum + (Number(item.qty_total_actual) || 0), 0);
    const progress = totalRequired > 0 ? Math.min(100, Math.round((totalDelivered / totalRequired) * 100)) : (unifiedItems.length > 0 ? 100 : 0);
    return { totalRequired, totalDelivered, progress };
  }, [unifiedItems]);

  const handleQrScan = (sku) => {
    const searchSku = sku.trim().toUpperCase();
    
    // Check in unified list
    const found = unifiedItems.find(item => item.consumed_product_sku?.trim().toUpperCase() === searchSku);
    if (found) {
      setScannedComponent({
        ...found,
        qty_pending: Math.max(0, found.qty_planned - found.qty_total_actual)
      });
      setDeliveryLocation('');
      setDeliveryQty('');
      setScannerOpen(false);
      toast.success(`Componente ${found.consumed_product_name} encontrado!`);
    } else {
      // Check in general products
      const product = products.find(p => p.sku?.trim().toUpperCase() === searchSku);
      if (product) {
        setScannedComponent({
          id: `extra-${product.id}`,
          consumed_product_id: product.id,
          consumed_product_name: product.name,
          consumed_product_sku: product.sku,
          qty_planned: 0,
          qty_total_actual: 0,
          qty_pending: 0,
          is_extra: true
        });
        setDeliveryLocation('');
        setDeliveryQty('');
        setScannerOpen(false);
        toast.info(`Item EXTRA encontrado: ${product.name}`);
      } else {
        toast.error(`SKU "${sku}" não encontrado no sistema.`);
      }
    }
  };

  const deliverMutation = useMutation({
    mutationFn: async () => {
      if (!scannedComponent || !deliveryLocation || !deliveryQty) throw new Error('Preencha tudo');
      const qty = parseFloat(deliveryQty);
      if (qty <= 0) throw new Error('Qtd inválida');

      const searchLoc = deliveryLocation.trim().toUpperCase();
      const location = locations.find(l => l.barcode?.trim().toUpperCase() === searchLoc);
      if (!location) throw new Error('Local não encontrado');

      const prodId = scannedComponent.consumed_product_id;
      const stockBalances = await base44.entities.StockBalance.filter({ company_id: companyId, product_id: prodId, location_id: location.id });
      const balance = stockBalances.find(b => b.qty_available >= qty);
      if (!balance) throw new Error('Estoque insuficiente neste local');

      // 1. Centralizado: Inventory Move + Stock Update (Garante saldo não negativo)
      const invMove = await executeInventoryTransaction({
        type: 'PRODUCAO_CONSUMO',
        product_id: prodId,
        qty: qty,
        from_warehouse_id: location.warehouse_id,
        from_location_id: location.id,
        related_type: 'OP',
        related_id: opId,
        reason: `Picking p/ OP ${op.op_number}`
      }, companyId);

      // 3. Centralizado: Atualizar Controles de OP (BOM e Consumo)
      // Substitui todo o bloco anterior de atualização manual
      await processProductionOrderControls({
        related_type: 'OP',
        related_id: opId,
        product_id: prodId,
        qty: qty,
        type: 'PRODUCAO_CONSUMO'
      }, companyId, invMove.id);
    },
    onSuccess: () => {
      toast.success('Entrega realizada!');
      queryClient.invalidateQueries({ queryKey: ['bom-delivery-controls'] });
      queryClient.invalidateQueries({ queryKey: ['op-consumption-controls-for-picking'] });
      queryClient.invalidateQueries({ queryKey: ['material-consumptions-for-picking'] });
      setScannedComponent(null);
      setDeliveryLocation('');
      setDeliveryQty('');
    },
    onError: (e) => toast.error(e.message)
  });

  if (loadingOP || loadingControls) return <div className="p-8 space-y-4"><Skeleton className="h-8 w-48"/><Skeleton className="h-64 w-full"/></div>;
  if (!op) return <div className="p-8 text-center"><p>OP não encontrada</p><Link to={createPageUrl('ProductionOrders')}><Button className="mt-4">Voltar</Button></Link></div>;

  return (
    <div className="space-y-6">
      <Card className="bg-indigo-600 border-0 text-white">
        <CardContent className="p-6 flex justify-between items-center">
          <div><h1 className="text-2xl font-bold">Separação de BOM</h1><p className="text-indigo-100">OP {op.op_number} - {op.product_name}</p></div>
          <Button onClick={() => setScannerOpen(!scannerOpen)} className="bg-white text-indigo-600"><QrCode className="h-4 w-4 mr-2"/>Scanner</Button>
        </CardContent>
      </Card>

      {scannerOpen && <Card><CardContent className="p-0"><QRScanner onScan={handleQrScan}/></CardContent></Card>}

      {scannedComponent && (
        <Card className="border-2 border-amber-200 bg-amber-50">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between">
              <div><h3 className="font-bold">{scannedComponent.consumed_product_name}</h3><p className="text-sm">SKU: {scannedComponent.consumed_product_sku}</p></div>
              <Button variant="ghost" onClick={() => setScannedComponent(null)}><X/></Button>
            </div>
            <div className="grid grid-cols-3 gap-4 p-4 bg-white rounded-lg">
              <div className="text-center"><p className="text-xs">Planejado</p><p className="font-bold">{scannedComponent.qty_planned}</p></div>
              <div className="text-center"><p className="text-xs">Entregue</p><p className="font-bold text-emerald-600">{scannedComponent.qty_total_actual}</p></div>
              <div className="text-center"><p className="text-xs">Pendente</p><p className="font-bold text-amber-600">{scannedComponent.qty_pending}</p></div>
            </div>
            {Number(deliveryQty) > scannedComponent.qty_pending && scannedComponent.qty_planned > 0 && (
              <div className="flex items-center gap-2 p-2 bg-amber-100 text-amber-800 rounded text-xs">
                <AlertTriangle className="h-4 w-4"/> Atenção: Você está entregando uma quantidade maior que a planejada na BOM.
              </div>
            )}
            <div className="space-y-2">
              <Label>Localização *</Label>
              <div className="flex gap-2">
                <Input value={deliveryLocation} onChange={e => setDeliveryLocation(e.target.value)} placeholder="Scanner ou Digite..."/>
                <Button variant="outline" onClick={() => setLocationScannerOpen(!locationScannerOpen)}><QrCode className="h-4 w-4"/></Button>
              </div>
              <Label>Qtd a Entregar *</Label>
              <Input type="number" value={deliveryQty} onChange={e => setDeliveryQty(e.target.value)} placeholder="0.00"/>
              <Button onClick={() => deliverMutation.mutate()} className="w-full bg-emerald-600">{deliverMutation.isPending ? 'Processando...' : 'Confirmar Entrega'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-indigo-50">
        <CardContent className="pt-6 space-y-4">
          <div className="flex justify-between items-center"><span className="font-bold">Progresso de Entrega</span><Badge>{stats.progress}%</Badge></div>
          <Progress value={stats.progress} className="h-3"/>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-xs">Necessário</p><p className="text-xl font-bold">{stats.totalRequired}</p></div>
            <div><p className="text-xs">Entregue</p><p className="text-xl font-bold text-emerald-600">{stats.totalDelivered}</p></div>
            <div><p className="text-xs">Pendente</p><p className="text-xl font-bold text-amber-600">{Math.max(0, stats.totalRequired - stats.totalDelivered)}</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {unifiedItems.map(item => (
          <Card key={item.id} className={item.status === 'ENTREGUE' ? 'bg-emerald-50 border-emerald-200' : ''}>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2"><h4 className="font-bold">{item.consumed_product_name}</h4>{item.is_extra && <Badge variant="outline">EXTRA</Badge>}</div>
                  <p className="text-xs">SKU: {item.consumed_product_sku}</p>
                </div>
                <Badge variant="outline">{item.qty_planned || '-'} un</Badge>
              </div>
              <Progress value={item.qty_planned > 0 ? Math.min(100, (item.qty_total_actual / item.qty_planned) * 100) : 100} className="h-2"/>
              <div className="flex justify-between items-center bg-white p-2 rounded text-xs font-bold text-indigo-700 border">
                <span>{item.qty_total_actual} de {item.qty_planned || '?'} entregues</span>
                <span>{item.qty_planned > 0 ? Math.round((item.qty_total_actual / item.qty_planned) * 100) : 100}%</span>
              </div>
              {item.status === 'ABERTO' && (
                <Button onClick={() => setScannedComponent({...item, qty_pending: Math.max(0, item.qty_planned - item.qty_total_actual)})} className="w-full bg-indigo-600 h-8 text-xs">Entregar</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}