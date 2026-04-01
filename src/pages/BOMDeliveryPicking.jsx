import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle2, Package, MapPin, BarChart3, Loader2, QrCode, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

  const { data: op, isLoading: loadingOP } = useQuery({
    queryKey: ['production-order', opId, companyId],
    queryFn: () => base44.entities.ProductionOrder.filter({ company_id: companyId, id: opId }),
    select: (data) => data?.[0],
    enabled: !!opId && !!companyId,
  });

  const { data: deliveryControls = [], isLoading: loadingControls, refetch: refetchControls } = useQuery({
    queryKey: ['bom-delivery-controls', opId],
    queryFn: () => base44.entities.BOMDeliveryControl.filter({ 
      company_id: companyId,
      op_id: opId
    }),
    enabled: !!opId && !!companyId,
  });

  const { data: bom } = useQuery({
    queryKey: ['bom', op?.product_id, companyId],
    queryFn: async () => {
      const boms = await base44.entities.BOM.filter({ 
        company_id: companyId,
        product_id: op.product_id,
        active: true
      });
      return boms?.[0];
    },
    enabled: !!op?.product_id && !!companyId,
  });

  const { data: productionSteps = [] } = useQuery({
    queryKey: ['production-steps', op?.route_id, bom?.current_version_id, companyId],
    queryFn: async () => {
      if (!companyId || !bom?.current_version_id) return [];
      
      try {
        const routeIds = new Set();
        
        // Buscar route_id do OP
        if (op?.route_id) {
          routeIds.add(op.route_id);
        }
        
        // Buscar route_ids dos BOMItems
        const bomItems = await base44.entities.BOMItem.filter({
          company_id: companyId,
          bom_version_id: bom.current_version_id
        });
        
        bomItems.forEach(item => {
          if (item.route_id) {
            routeIds.add(item.route_id);
          }
          if (item.routes && Array.isArray(item.routes)) {
            item.routes.forEach(r => {
              if (r.route_id) routeIds.add(r.route_id);
            });
          }
        });
        
        if (routeIds.size === 0) return [];
        
        const allSteps = [];
        for (const routeId of routeIds) {
          const steps = await base44.entities.ProductionRouteStep.filter({
            company_id: companyId,
            route_id: routeId
          });
          allSteps.push(...steps);
        }
        
        return Array.from(new Map(allSteps.map(s => [s.id, s])).values())
          .sort((a, b) => a.sequence - b.sequence);
      } catch (error) {
        console.error('Erro ao buscar etapas:', error);
        return [];
      }
    },
    enabled: !!bom?.current_version_id && !!companyId,
  });

  const initializeControlMutation = useMutation({
     mutationFn: async ({ bomVersionId, companyIdParam, opIdParam, opNumberParam, qtyPlanned }) => {
       const bomItems = await base44.entities.BOMItem.filter({
         company_id: companyIdParam,
         bom_version_id: bomVersionId
       });

       if (bomItems.length === 0) return;

       const controlsToCreate = bomItems.map(item => ({
         company_id: companyIdParam,
         op_id: opIdParam,
         op_number: opNumberParam,
         bom_item_id: item.id,
         component_id: item.component_id,
         component_sku: item.component_sku,
         component_name: item.component_name,
         qty_required: item.quantity * qtyPlanned,
         qty_delivered: 0,
         qty_pending: item.quantity * qtyPlanned,
         status: 'ABERTO',
         unit: item.unit
       }));

       await base44.entities.BOMDeliveryControl.bulkCreate(controlsToCreate);
     },
    onSuccess: () => {
      refetchControls();
    }
  });

  useEffect(() => {
    if (op && bom && deliveryControls.length === 0 && companyId && opId && bom.current_version_id && !initializingRef.current) {
      initializingRef.current = true;
      initializeControlMutation.mutate({
        bomVersionId: bom.current_version_id,
        companyIdParam: companyId,
        opIdParam: opId,
        opNumberParam: op.op_number,
        qtyPlanned: op.qty_planned
      });
    }
  }, [op, bom, companyId, opId]);

  const handleQrScan = (sku) => {
    const searchSku = sku.trim().toUpperCase();
    const component = deliveryControls.find(item => 
      item.component_sku?.trim().toUpperCase() === searchSku
    );
    
    if (component && component.status === 'ABERTO') {
      setScannedComponent(component);
      setDeliveryLocation('');
      setDeliveryQty('');
      setScannerOpen(false);
      toast.success(`Componente ${component.component_name} encontrado!`);
    } else if (component?.status === 'ENTREGUE') {
      toast.info('Este componente já foi completamente entregue');
    } else {
      const availableSkus = deliveryControls
        .filter(c => c.status === 'ABERTO')
        .map(c => c.component_sku)
        .join(', ');
      toast.error(`SKU "${sku}" não encontrado. SKUs disponíveis: ${availableSkus || 'nenhum'}`);
    }
  };

  const handleLocationScan = (location) => {
    setDeliveryLocation(location);
    setLocationScannerOpen(false);
  };

  const deliverMutation = useMutation({
    mutationFn: async () => {
      console.log('=== INÍCIO ENTREGA ===');
      console.log('Componente:', scannedComponent);
      console.log('Localização digitada:', deliveryLocation);
      console.log('Quantidade:', deliveryQty);

      if (!scannedComponent || !deliveryLocation || !deliveryQty) {
        throw new Error('Preencha todos os campos');
      }

      const qty = parseFloat(deliveryQty);
      if (qty <= 0 || qty > scannedComponent.qty_pending) {
        throw new Error('Quantidade inválida');
      }

      console.log('Validando controle...');
      const currentControl = await base44.entities.BOMDeliveryControl.filter({ id: scannedComponent.id });
      console.log('Controle atual:', currentControl);
      if (!currentControl?.[0] || currentControl[0].status !== 'ABERTO') {
        throw new Error('Este componente não está mais pendente');
      }

      console.log('Buscando localização...');
      const locations = await base44.entities.Location.filter({ company_id: companyId });
      const searchLoc = deliveryLocation.trim().toUpperCase();
      
      const location = locations.find(l => 
        l.barcode?.trim().toUpperCase() === searchLoc
      );

      console.log('Localização encontrada:', location);

      if (!location) {
        const allBarcodes = locations.slice(0, 20).map(l => l.barcode).filter(Boolean).join(', ');
        throw new Error(`Localização "${deliveryLocation}" não encontrada. Localizações disponíveis: ${allBarcodes || 'nenhuma'}`);
      }

      const allBalances = await base44.entities.StockBalance.filter({ company_id: companyId });
      
      const stockBalance = allBalances.find(b =>
        b.product_id === scannedComponent.component_id &&
        b.location_id === location.id &&
        b.qty_available > 0
      );

      if (!stockBalance) {
        const productBalances = allBalances.filter(b => b.product_id === scannedComponent.component_id && b.qty_available > 0);
        const availableLocations = productBalances
          .map(b => {
            const loc = locations.find(l => l.id === b.location_id);
            return `${loc?.barcode || b.location_id} (${b.qty_available}un)`;
          })
          .join(', ');
        throw new Error(`Sem saldo na localização "${location.barcode}". Disponível em: ${availableLocations || 'nenhuma'}`);
      }

      if (stockBalance.qty_available < qty) {
        throw new Error(`Saldo insuficiente. Disponível: ${stockBalance.qty_available}`);
      }

      // 1. Criar movimento de inventário (SAÍDA no Kardex)
      const inventoryMove = await base44.entities.InventoryMove.create({
        company_id: companyId,
        type: 'PRODUCAO_CONSUMO',
        product_id: scannedComponent.component_id,
        qty: qty,
        from_warehouse_id: location.warehouse_id,
        from_location_id: location.id,
        related_type: 'OP',
        related_id: opId,
        reason: `Entrega de ${scannedComponent.component_name} para OP ${op.op_number}`
      });

      // 2. Atualizar saldo de estoque (baixar da localização)
      await base44.entities.StockBalance.update(stockBalance.id, {
        qty_available: stockBalance.qty_available - qty
      });

      // 3. Atualizar controle de entrega
      const newQtyDelivered = (scannedComponent.qty_delivered || 0) + qty;
      const newQtyPending = scannedComponent.qty_required - newQtyDelivered;
      const newStatus = newQtyPending === 0 ? 'ENTREGUE' : 'ABERTO';

      await base44.entities.BOMDeliveryControl.update(scannedComponent.id, {
        qty_delivered: newQtyDelivered,
        qty_pending: newQtyPending,
        status: newStatus
      });

      // 4. Atualizar consumo em OPConsumptionControl
      console.log('=== CRIANDO/ATUALIZANDO OPCONSUMPTIONCONTROL ===');
      const existingControl = await base44.entities.OPConsumptionControl.filter({
        company_id: companyId,
        op_id: opId,
        consumed_product_id: scannedComponent.component_id
      });
      console.log('Controles existentes:', existingControl);

      if (existingControl && existingControl.length > 0) {
        const control = existingControl[0];
        const newTotal = (control.qty || 0) + qty;
        await base44.entities.OPConsumptionControl.update(control.id, {
          qty: newTotal,
          inventory_move_id: inventoryMove.id,
        });
      } else {
        await base44.entities.OPConsumptionControl.create({
          company_id: companyId,
          op_id: opId,
          op_number: op.op_number,
          numero_op_externo: op.numero_op_externo,
          product_id: op.product_id,
          product_name: op.product_name,
          consumed_product_id: scannedComponent.component_id,
          consumed_product_sku: scannedComponent.component_sku,
          consumed_product_name: scannedComponent.component_name,
          qty: qty,
          inventory_move_id: inventoryMove.id,
          op_status: op.status,
          control_status: 'ABERTO',
          notes: `Entregue do local ${deliveryLocation}`
        });
      }
      console.log('=== FIM OPCONSUMPTIONCONTROL ===');
    },
    onSuccess: () => {
      console.log('✓ Entrega concluída com sucesso');
      queryClient.invalidateQueries({ queryKey: ['bom-delivery-controls'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-moves'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
      queryClient.invalidateQueries({ queryKey: ['op-consumption-controls'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-moves-to-op'] });
      queryClient.invalidateQueries({ queryKey: ['material-consumptions'] });
      
      toast.success(`✓ ${scannedComponent.component_name} entregue - verifique o Controle de Consumo`);
      
      setScannedComponent(null);
      setDeliveryLocation('');
      setDeliveryQty('');
      setScannerOpen(true);
    },
    onError: (error) => {
      const message = error?.message || 'Erro ao entregar componente';
      toast.error(message);
    }
  });

  if (loadingOP || loadingControls || initializeControlMutation.isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!op) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Ordem de Produção não encontrada</p>
        <Link to={createPageUrl('ProductionOrders')}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  // Deduplicar por bom_item_id para evitar exibição de duplicatas
  const uniqueDeliveryControls = Object.values(
    deliveryControls.reduce((acc, item) => {
      const key = item.bom_item_id || item.component_id;
      if (!acc[key]) {
        acc[key] = item;
      }
      return acc;
    }, {})
  );

  const totalRequired = uniqueDeliveryControls.reduce((sum, item) => sum + item.qty_required, 0);
  const totalDelivered = uniqueDeliveryControls.reduce((sum, item) => sum + (item.qty_delivered || 0), 0);
  const progress = totalRequired > 0 ? Math.round((totalDelivered / totalRequired) * 100) : 0;
  const allDelivered = uniqueDeliveryControls.every(item => item.status === 'ENTREGUE');

  return (
    <div className="space-y-6">
      {/* Header with QR Scanner */}
      <Card className="bg-gradient-to-r from-indigo-600 to-indigo-700 border-0 text-white">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Separação de BOM</h1>
              <p className="text-indigo-100">OP {op.op_number} - {op.product_name}</p>
            </div>
            <button 
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-indigo-500/50"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>

          <Button
            onClick={() => setScannerOpen(!scannerOpen)}
            className="w-full bg-white text-indigo-600 hover:bg-indigo-50"
          >
            <QrCode className="h-4 w-4 mr-2" />
            {scannerOpen ? 'Fechar Scanner' : 'Abrir Scanner de QR Code'}
          </Button>
        </CardContent>
      </Card>

      {/* QR Scanner Modal */}
        {scannerOpen && (
          <Card className="border-2 border-indigo-300">
            <CardContent className="p-0">
              <QRScanner 
                onScan={handleQrScan}
                placeholder="Posicione o código QR/código de barras do componente"
              />
            </CardContent>
          </Card>
        )}

        {/* Debug Info - BOM e Roteiros */}
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Status de Etapas de Produção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">BOM encontrado:</span>
              <span className="font-medium">{bom ? '✓ Sim' : '✗ Não'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Versão BOM:</span>
              <span className="font-medium">{bom?.current_version_id || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Etapas encontradas:</span>
              <span className="font-medium">{productionSteps.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Route ID da OP:</span>
              <span className="font-medium">{op?.route_id || '-'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Production Steps */}
        {productionSteps.length > 0 && (
          <Card>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Etapas de Produção
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {productionSteps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-start gap-4 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm flex-shrink-0">
                      {step.sequence}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{step.name}</h4>
                      {step.description && (
                        <p className="text-sm text-slate-600 mt-1">{step.description}</p>
                      )}
                      <div className="flex gap-4 mt-2">
                        {step.resource_type && (
                          <span className="text-xs text-slate-500">
                            <Badge variant="outline" className="capitalize">{step.resource_type.toLowerCase()}</Badge>
                          </span>
                        )}
                        {step.estimated_time && (
                          <span className="text-xs text-slate-500">
                            ⏱ {step.estimated_time} min
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

       {/* Scanned Component Panel */}
      {scannedComponent && (
        <Card className="border-2 border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{scannedComponent.component_name}</h3>
                <p className="text-sm text-slate-600">SKU: {scannedComponent.component_sku}</p>
              </div>
              <button
                onClick={() => {
                    setScannedComponent(null);
                    setDeliveryLocation('');
                    setDeliveryQty('');
                  }}
                className="p-2 rounded-lg hover:bg-amber-100"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6 p-4 bg-white rounded-lg">
              <div className="text-center">
                <p className="text-xs text-slate-500">Necessário</p>
                <p className="text-2xl font-bold text-slate-900">{scannedComponent.qty_required}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">Entregue</p>
                <p className="text-2xl font-bold text-emerald-600">{scannedComponent.qty_delivered || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">Faltam</p>
                <p className="text-2xl font-bold text-amber-600">{scannedComponent.qty_pending}</p>
              </div>
            </div>

            <div className="space-y-4">
               <div>
                 <Label className="text-slate-700 font-medium">Localização do Componente *</Label>
                 <div className="flex gap-2 mt-2">
                   <Input
                     placeholder="Ex: A1, B5, Corredor 2..."
                     value={deliveryLocation}
                     onChange={(e) => setDeliveryLocation(e.target.value)}
                   />
                   <Button
                     onClick={() => setLocationScannerOpen(!locationScannerOpen)}
                     variant="outline"
                     className="px-3"
                   >
                     <QrCode className="h-4 w-4" />
                   </Button>
                 </div>
                 {locationScannerOpen && (
                   <div className="mt-3 p-4 bg-slate-50 rounded-lg border">
                     <QRScanner 
                       onScan={handleLocationScan}
                       placeholder="Leia o QR code da localização"
                     />
                   </div>
                 )}
               </div>

              <div>
                <Label className="text-slate-700 font-medium">Quantidade a Entregar *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={scannedComponent.qty_pending}
                  placeholder={`Máximo: ${scannedComponent.qty_pending}`}
                  value={deliveryQty}
                  onChange={(e) => setDeliveryQty(e.target.value)}
                  className="mt-2"
                />
              </div>

              <Button 
                onClick={() => deliverMutation.mutate()}
                disabled={!deliveryLocation || !deliveryQty || deliverMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {deliverMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Entregando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar Entrega
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-900">Progresso de Entrega</span>
              <Badge className="bg-indigo-600 text-white">{progress}%</Badge>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-slate-500">Necessário</p>
                <p className="text-xl font-bold text-slate-900">{totalRequired}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">Entregue</p>
                <p className="text-xl font-bold text-emerald-600">{totalDelivered}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">Pendente</p>
                <p className="text-xl font-bold text-amber-600">{totalRequired - totalDelivered}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Components List */}
      <div className="grid gap-4">
        {deliveryControls.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum componente para entregar</p>
            </CardContent>
          </Card>
        ) : (
          uniqueDeliveryControls.map((item) => {
            const itemProgress = item.qty_required > 0 
              ? Math.round(((item.qty_delivered || 0) / item.qty_required) * 100) 
              : 0;

            return (
              <Card 
                key={item.id}
                className={item.status === 'ENTREGUE' ? 'bg-emerald-50 border-emerald-200' : ''}
              >
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-slate-900">{item.component_name}</h3>
                          {item.status === 'ENTREGUE' && (
                            <Badge className="bg-emerald-100 text-emerald-700">Entregue</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">SKU: {item.component_sku}</p>
                      </div>
                      <Badge variant="outline" className="text-lg">
                        {item.qty_required} un
                      </Badge>
                    </div>

                    <Progress value={itemProgress} className="h-2" />

                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">
                        Entregues: {item.qty_delivered || 0} / {item.qty_required}
                      </span>
                      <span className="font-medium">{itemProgress}%</span>
                    </div>

                    {item.status === 'ABERTO' && (
                       <Button
                         onClick={() => {
                           setScannedComponent(item);
                           setDeliveryLocation('');
                           setDeliveryQty('');
                         }}
                         className="w-full bg-indigo-600 hover:bg-indigo-700"
                       >
                         <Package className="h-4 w-4 mr-2" />
                         Entregar Componente
                       </Button>
                     )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Summary */}
      {allDelivered && deliveryControls.length > 0 && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-emerald-900">Todos os componentes foram entregues!</p>
                <p className="text-sm text-emerald-700">A OP está pronta para produção</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}


    </div>
  );
}