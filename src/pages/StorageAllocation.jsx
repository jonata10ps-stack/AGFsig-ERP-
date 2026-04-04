import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  ArrowLeft, Package, MapPin, CheckCircle, AlertCircle, Loader2, Plus, Minus, Sparkles, Edit2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import QRScanner from '../components/scanner/QRScanner';
import { executeInventoryTransaction } from '@/utils/inventoryTransactionUtils';
import { cn } from '@/lib/utils';

// FunÃ§Ã£o para calcular score de uma localizaÃ§Ã£o
function calculateLocationScore(location, product, stockBalances) {
  let score = 100;

  // LocalizaÃ§Ã£o jÃ¡ tem este produto? (FIFO + consolidaÃ§Ã£o)
  const hasProduct = stockBalances?.find(
    sb => sb.location_id === location.id && sb.product_id === product.id
  );
  if (hasProduct) {
    score += 50; // Priorizar consolidaÃ§Ã£o
  }

  // Verificar ocupaÃ§Ã£o da localizaÃ§Ã£o
  const locationOccupancy = stockBalances?.filter(
    sb => sb.location_id === location.id
  ).reduce((sum, sb) => sum + (sb.qty_available || 0), 0) || 0;

  const occupancyRate = location.capacity ? locationOccupancy / location.capacity : 0;

  // Penalizar localizaÃ§Ãµes muito cheias (< 20% espaÃ§o livre)
  if (occupancyRate > 0.8) {
    score -= 30;
  } else if (occupancyRate > 0.5) {
    score -= 10;
  }

  // Bonificar localizaÃ§Ãµes vazias se nÃ£o hÃ¡ produto consolidado
  if (!hasProduct && occupancyRate === 0) {
    score += 20;
  }

  // Priorizar nÃ­veis mÃ©dios (mais ergonÃ´micos)
  const nivel = location.nivel?.toUpperCase();
  if (nivel === 'M' || nivel === 'MEDIO' || nivel === '2') {
    score += 15;
  } else if (nivel === 'A' || nivel === 'ALTO' || nivel === '3') {
    score += 5;
  }

  // Priorizar ruas/mÃ³dulos iniciais (mais prÃ³ximos)
  const rua = parseInt(location.rua) || 999;
  const modulo = parseInt(location.modulo) || 999;
  
  score -= rua * 2; // Menos score para ruas mais distantes
  score -= modulo * 1;

  return score;
}

// Sugerir melhores localizaÃ§Ãµes
function suggestBestLocations(product, locations, stockBalances, warehouseId, limit = 3) {
  if (!locations || !product) return [];

  // Filtrar localizaÃ§Ãµes: preferir do mesmo armazÃ©m, mas aceitar sem warehouse_id
  let validLocations = locations.filter(l => l.active !== false);
  
  // Se temos localizaÃ§Ãµes do armazÃ©m especÃ­fico, usar sÃ³ essas
  const warehouseLocations = validLocations.filter(l => l.warehouse_id === warehouseId);
  if (warehouseLocations.length > 0) {
    validLocations = warehouseLocations;
  }

  // Se nÃ£o hÃ¡ localizaÃ§Ãµes, retornar todas as ativas
  if (validLocations.length === 0) {
    validLocations = locations.filter(l => l.active !== false);
  }

  // Calcular score para cada localizaÃ§Ã£o
  const scored = validLocations.map(location => ({
    location,
    score: calculateLocationScore(location, product, stockBalances || []),
    hasProduct: !!stockBalances?.find(
      sb => sb.location_id === location.id && sb.product_id === product.id
    ),
    occupancy: stockBalances?.filter(
      sb => sb.location_id === location.id
    ).reduce((sum, sb) => sum + (sb.qty_available || 0), 0) || 0
  }));

  // Ordenar por score (maior primeiro)
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

export default function StorageAllocation() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [suggestedLocations, setSuggestedLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [qtyToAllocate, setQtyToAllocate] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const [manualLocationCode, setManualLocationCode] = useState('');
  const isSubmittingRef = React.useRef(false);

  const { data: pendingItems } = useQuery({
    queryKey: ['pending-allocation', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const [receivingItems, stockBalances, expeditionWarehouses, productionRequests] = await Promise.all([
        base44.entities.ReceivingItem.filter({ company_id: companyId, status: 'CONFERIDO' }),
        base44.entities.StockBalance.filter({ company_id: companyId }),
        base44.entities.Warehouse.filter({ company_id: companyId, type: 'EXPEDICAO' }),
        base44.entities.ProductionRequest.filter({ company_id: companyId, status: 'PRODUZIDO' })
      ]);

      const expWhIds = new Set(expeditionWarehouses.map(w => w.id));
      
      // 1. Itens vindos do recebimento de compras
      const validReceivingItems = receivingItems.filter(item => item.qty > 0);
      
      // 2. Itens vindos da produção
      const validProductionItems = productionRequests.map(pr => ({
        ...pr,
        qty: pr.qty || 0,
        isFromProduction: true,
        product_name: pr.product_name || 'Produto Produzido'
      })).filter(item => item.qty > 0);
      
      // 3 e 4. Saldos em estoque (Limbo ou Doca) - CONSOLIDADO
      const stockGroups = stockBalances.reduce((acc, sb) => {
        const isLimbo = !sb.warehouse_id && !sb.location_id;
        const isDock = expWhIds.has(sb.warehouse_id) && !sb.location_id;
        const qty = parseFloat(sb.qty_available) || 0;
        
        if ((isLimbo || isDock) && qty > 0) {
          const key = `${sb.product_id}-${sb.warehouse_id || 'limbo'}-${sb.location_id || 'none'}`;
          if (!acc[key]) {
            acc[key] = { 
              ...sb, 
              qty: 0,
              isFromStockBalance: isLimbo,
              isFromExpeditionDock: isDock
            };
          }
          acc[key].qty += qty;
        }
        return acc;
      }, {});

      const consolidatedStock = Object.values(stockGroups);
      
      return [...validReceivingItems, ...validProductionItems, ...consolidatedStock];
    },
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => companyId ? base44.entities.Location.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: batches } = useQuery({
    queryKey: ['receiving-batches', companyId],
    queryFn: () => companyId ? base44.entities.ReceivingBatch.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: stockBalances } = useQuery({
    queryKey: ['stock-balances-allocation', companyId],
    queryFn: () => companyId ? base44.entities.StockBalance.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  // Quando selecionar um item, gerar sugestÃµes
  useEffect(() => {
    if (selectedItem && products && locations) {
      const product = products.find(p => p.id === selectedItem.product_id);
      if (product) {
        const suggestions = suggestBestLocations(
          product,
          locations,
          stockBalances || [],
          selectedItem.warehouse_id,
          5
        );
        setSuggestedLocations(suggestions);
      }
    } else if (!selectedItem) {
      setSuggestedLocations([]);
    }
  }, [selectedItem, products, locations, stockBalances]);

  const allocateMutation = useMutation({
   mutationFn: async ({ item, locationId, qty }) => {
     const batch = batches?.find(b => b.id === item.batch_id);
     
     // Se o item nÃ£o tem warehouse_id, buscar armazÃ©m padrÃ£o
     let warehouseId = item.warehouse_id;
     if (!warehouseId) {
       const warehouses = await base44.entities.Warehouse.filter({
         company_id: companyId,
         active: true
       });
       const defaultWarehouse = warehouses.find(w => w.type === 'ACABADO') || warehouses[0];
       if (!defaultWarehouse) {
         throw new Error('Nenhum armazÃ©m ativo encontrado');
       }
       warehouseId = defaultWarehouse.id;
       
       // Atualizar o item com o warehouse_id
       await base44.entities.ReceivingItem.update(item.id, {
         warehouse_id: warehouseId,
         warehouse_name: defaultWarehouse.name
       });
     }

     // Verificar se o item já está no sistema (StockBalance) em algum lugar
     // Se estiver, tratamos como TRANSFERÊNCIA. Se não, é ENTRADA.
     const existingMove = await base44.entities.InventoryMove.filter({
       company_id: companyId,
       product_id: item.product_id,
       related_id: item.id, // Usar item.id para ser específico deste recebimento
       type: 'ENTRADA'
     });

     const isNewEntry = !item.isFromStockBalance && !item.isFromExpeditionDock && existingMove.length === 0;

     // Executar transação centralizada
     await executeInventoryTransaction({
       type: isNewEntry ? 'ENTRADA' : 'TRANSFERENCIA',
       product_id: item.product_id,
       qty: qty,
       from_warehouse_id: item.warehouse_id || null, 
       from_location_id: item.location_id || null,
       to_warehouse_id: warehouseId,
       to_location_id: locationId,
       unit_cost: item.unit_cost || item.avg_cost || 0,
       related_type: isNewEntry ? 'COMPRA' : 'PEDIDO',
       related_id: item.id,
       reason: isNewEntry 
          ? `Recebimento - Lote ${batch?.batch_number || 'N/A'}`
          : `Alocação de Saldo Pendente (Origem: ${item.warehouse_name || 'Doca'})`
     }, companyId);

      // Calcular quantidade restante no item (arredondar para evitar imprecisão float)
       const remainingQty = Math.round((item.qty - qty) * 1000) / 1000;

       if (!item.isFromStockBalance && !item.isFromExpeditionDock) {
           if (remainingQty > 0.0001) {
             await base44.entities.ReceivingItem.update(item.id, {
               qty: remainingQty
             });
           } else {
            await base44.entities.ReceivingItem.update(item.id, { 
              status: 'ARMAZENADO',
              location_id: locationId
            });
          }

          // Verificar se todos os itens do batch foram armazenados
          const batchItems = await base44.entities.ReceivingItem.filter({ batch_id: item.batch_id });
          const allStored = batchItems.every(i => i.id === item.id ? remainingQty === 0 : i.status === 'ARMAZENADO');
          
          if (allStored && batch) {
            await base44.entities.ReceivingBatch.update(batch.id, {
              status: 'ARMAZENADO'
            });
          }
       }

      // Auditoria
       const user = await base44.auth.me();
       const location = locations?.find(l => l.id === locationId);
       await base44.entities.AuditLog.create({
         company_id: companyId,
         action: 'ALOCACAO_ESTOQUE',
         entity_type: 'ReceivingItem',
         entity_id: item.id,
         new_data: JSON.stringify({
           product: item.product_sku,
           qty: qty,
           location: location?.barcode,
           remaining: remainingQty
         }),
         user_email: user.email
       });
    },
    onSuccess: (data, variables) => {
      const remainingQty = variables.item.qty - variables.qty;
      
      queryClient.invalidateQueries({ queryKey: ['pending-allocation'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balances-allocation'] });
      
      setSelectedItem(null);
      setSelectedLocation(null);
      setSuggestedLocations([]);
      setQtyToAllocate(0);
      setManualMode(false);
      setManualLocationCode('');
      
      if (remainingQty > 0) {
        toast.success(`${variables.qty} alocado(s)! Restam ${remainingQty} unidades deste item.`);
      } else {
        toast.success('Item totalmente alocado!');
      }
    },
    onSettled: () => {
      isSubmittingRef.current = false;
    },
    onError: (error) => {
      toast.error('Erro ao alocar: ' + error.message);
    }
  });

   const handleRecalculateBalance = async (productId) => {
     if (!productId || !companyId) return;
     const tId = toast.loading('Recalculando e auditando saldos do produto...');
     try {
       // 1. Obter todos os movimentos históricos deste produto
       const moves = await base44.entities.InventoryMove.filter({ product_id: productId, company_id: companyId });
       
       // 2. Agrupar por Armazém/Localização
       const actualBalances = {}; // { "wh_id_loc_id": { wh, loc, qty } }
       
       for (const move of moves) {
         const qty = parseFloat(move.qty) || 0;
         const { type, from_warehouse_id, from_location_id, to_warehouse_id, to_location_id } = move;

         // Auxiliar para somar/subtrair
         const updateMap = (wh, loc, delta) => {
           if (!wh) return;
           const key = `${wh}_${loc || 'null'}`;
           if (!actualBalances[key]) actualBalances[key] = { wh, loc: loc || null, qty: 0 };
           actualBalances[key].qty = Math.round((actualBalances[key].qty + delta) * 1000) / 1000;
         };

         // Lógica de Somas/Subtrações baseada no inventoryTransactionUtils.js
         if (['ENTRADA', 'PRODUCAO_ENTRADA', 'PRODUCAO_REVERSO', 'ESTORNO'].includes(type)) {
           updateMap(to_warehouse_id, to_location_id, qty);
         } else if (['SAIDA', 'PRODUCAO_CONSUMO', 'BAIXA', 'RESERVA'].includes(type)) {
           updateMap(from_warehouse_id, from_location_id, -qty);
         } else if (['TRANSFERENCIA', 'SEPARACAO'].includes(type)) {
           updateMap(from_warehouse_id, from_location_id, -qty);
           updateMap(to_warehouse_id, to_location_id, qty);
         }
       }

       // 3. Buscar saldos atuais e atualizar/criar conforme o calculado
       const currentStockBalances = await base44.entities.StockBalance.filter({ product_id: productId, company_id: companyId });
       
       // Atualizar existentes
       for (const balance of currentStockBalances) {
         const key = `${balance.warehouse_id}_${balance.location_id || 'null'}`;
         const target = actualBalances[key];
         const actualQty = target ? target.qty : 0;
         
         if (parseFloat(balance.qty_available) !== actualQty) {
           await base44.entities.StockBalance.update(balance.id, { qty_available: String(actualQty) });
         }
         // Marcar como processado
         if (target) delete actualBalances[key];
       }

       // Criar faltantes (que têm movimento no Kardex mas não têm linha no StockBalance)
       for (const key in actualBalances) {
         const item = actualBalances[key];
         if (item.qty === 0) continue; // Ignorar saldos zerados se não existir o registro
         
         await base44.entities.StockBalance.create({
           company_id: companyId,
           product_id: productId,
           warehouse_id: item.wh,
           location_id: item.loc,
           qty_available: String(item.qty),
           qty_separated: '0',
           qty_reserved: '0',
           avg_cost: '0',
           last_move_date: new Date().toISOString()
         });
       }

       toast.dismiss(tId);
       toast.success('Auditoria completa! Saldos recalculados e corrigidos com sucesso.');
       queryClient.invalidateQueries({ queryKey: ['pending-allocation'] });
       queryClient.invalidateQueries({ queryKey: ['stock-balances-allocation'] });
     } catch (err) {
       toast.dismiss(tId);
       console.error('Erro na auditoria:', err);
       toast.error('Erro ao recalcular saldo: ' + err.message);
     }
   };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setQtyToAllocate(item.qty);
    setSelectedLocation(null);
    setManualMode(false);
  };

  const handleSelectLocation = (location) => {
    setSelectedLocation(location);
    setManualMode(false);
  };

  const handleManualLocationSubmit = () => {
    if (!manualLocationCode) return;
    
    const location = locations?.find(
      l => l.barcode?.toUpperCase() === manualLocationCode.toUpperCase()
    );
    
    if (!location) {
      toast.error('LocalizaÃ§Ã£o nÃ£o encontrada');
      return;
    }

    if (location.warehouse_id !== selectedItem.warehouse_id) {
      toast.error('LocalizaÃ§Ã£o pertence a outro armazÃ©m');
      return;
    }

    setSelectedLocation(location);
    setManualLocationCode('');
    toast.success(`LocalizaÃ§Ã£o selecionada: ${location.barcode}`);
  };

  const handleAllocate = () => {
    if (!selectedItem || !selectedLocation) {
      toast.error('Selecione item e localizaÃ§Ã£o');
      return;
    }

    if (qtyToAllocate <= 0 || qtyToAllocate > selectedItem.qty) {
      toast.error('Quantidade invÃ¡lida');
      return;
    }

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    allocateMutation.mutate({
      item: selectedItem,
      locationId: selectedLocation.id,
      qty: qtyToAllocate
    });
  };

  const totalPendingQty = pendingItems?.reduce((sum, item) => sum + item.qty, 0) || 0;

  return (
    <div className="space-y-6 px-1 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('ReceivingList')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Alocação Inteligente</h1>
            <p className="text-xs sm:text-sm text-slate-500">Sistema de sugestão automática de localizações</p>
          </div>
        </div>
        <Badge className={cn(
          "w-fit sm:w-auto self-start sm:self-auto",
          totalPendingQty > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
        )}>
          {pendingItems?.length || 0} item(ns) / {totalPendingQty} unidades pendentes
        </Badge>
      </div>

      {totalPendingQty === 0 && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-900">Nenhum item pendente de alocação</p>
              <p className="text-sm text-emerald-700">Todos os itens conferidos foram alocados.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Select Item */}
        <Card className={selectedItem ? 'border-indigo-200' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              Bipar Produto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <QRScanner 
              onScan={(code) => {
                const item = pendingItems?.find(i => i.product_sku === code);
                if (item) {
                  handleSelectItem(item);
                  toast.success(`Produto: ${item.product_name}`);
                } else {
                  toast.error('Produto não encontrado nos itens pendentes');
                }
              }}
              placeholder="Escaneie o código do produto"
              active={!selectedItem}
            />

            <Separator />

            {!pendingItems || pendingItems.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <Package className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm">Nenhum item pendente</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pendingItems.map((item) => {
                  const batch = batches?.find(b => b.id === item.batch_id);
                  const isSelected = selectedItem?.id === item.id;
                  
                  return (
                    <div
                      key={item.id}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200'
                          : 'bg-white border-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      <div 
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() => handleSelectItem(item)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm text-indigo-600 font-bold">
                            {item.product_sku || (products?.find(p => p.id === item.product_id)?.sku)}
                          </p>
                          <p className="font-medium text-sm truncate">
                            {item.product_name || (products?.find(p => p.id === item.product_id)?.name)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {item.isFromProduction ? (
                              <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[10px]">PRODUÇÃO</Badge>
                            ) : item.isFromExpeditionDock ? (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px]">DOCA EXPEDIÇÃO</Badge>
                            ) : item.isFromStockBalance ? (
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[10px]">SEM ENDEREÇO</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px]">RECEBIMENTO</Badge>
                            )}
                            {batch?.batch_number && (
                              <Badge variant="outline" className="text-[10px]">{batch.batch_number}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-lg font-bold text-slate-900">{item.qty}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 justify-end pointer-events-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRecalculateBalance(item.product_id)}
                          className="text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                          title="Reparar Saldo"
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSelectItem(item)}
                          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        >
                          Alocar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Suggested Locations */}
        <Card className={selectedLocation ? 'border-emerald-200' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              Bipar LocalizaÃ§Ã£o
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedItem ? (
              <div className="text-center py-6 text-slate-500">
                <MapPin className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm">Bipe o produto primeiro</p>
              </div>
            ) : (
              <>
                <QRScanner 
                  onScan={(code) => {
                    const location = locations?.find(l => l.barcode === code);
                    if (!location) {
                      toast.error('LocalizaÃ§Ã£o nÃ£o encontrada');
                      return;
                    }
                    if (location.warehouse_id !== selectedItem.warehouse_id) {
                      toast.error('LocalizaÃ§Ã£o pertence a outro armazÃ©m');
                      return;
                    }
                    handleSelectLocation(location);
                    toast.success(`LocalizaÃ§Ã£o: ${location.barcode}`);
                  }}
                  placeholder="Escaneie o cÃ³digo da localizaÃ§Ã£o"
                  active={!!selectedItem && !selectedLocation}
                />

                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-xs text-slate-500">ou escolha sugerida</span>
                  <Separator className="flex-1" />
                </div>

                {!selectedItem ? (
                   <div className="text-center py-4 text-slate-500">
                     <MapPin className="h-6 w-6 mx-auto text-slate-300 mb-2" />
                     <p className="text-xs">Escaneie ou selecione um produto</p>
                   </div>
                 ) : suggestedLocations.length === 0 ? (
                   <div className="text-center py-4 text-slate-500">
                     <AlertCircle className="h-6 w-6 mx-auto text-slate-300 mb-2" />
                     <p className="text-xs">Nenhuma localizaÃ§Ã£o disponÃ­vel</p>
                   </div>
                 ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {suggestedLocations.map((suggested, index) => {
                      const { location, hasProduct, occupancy } = suggested;
                      const isSelected = selectedLocation?.id === location.id;
                      const isBest = index === 0;

                      return (
                        <button
                          key={location.id}
                          onClick={() => handleSelectLocation(location)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200'
                              : 'bg-white border-slate-200 hover:border-emerald-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <p className="font-mono font-bold text-slate-900">{location.barcode}</p>
                              {isBest && (
                                <Badge className="bg-amber-100 text-amber-700 text-xs flex items-center gap-1">
                                  <Sparkles className="h-3 w-3" />
                                  Sugerida
                                </Badge>
                              )}
                            </div>
                            {isSelected && <CheckCircle className="h-5 w-5 text-emerald-600" />}
                          </div>
                          <p className="text-xs text-slate-600 mb-2">
                            {[location.rua, location.modulo, location.nivel].filter(Boolean).join(' / ')}
                          </p>
                          <div className="flex gap-2">
                            {hasProduct && (
                              <Badge className="bg-blue-100 text-blue-700 text-xs">
                                Produto jÃ¡ aqui
                              </Badge>
                            )}
                            {occupancy > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {occupancy} itens
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Confirm Allocation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold">
                3
              </div>
              Confirmar AlocaÃ§Ã£o
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedItem || !selectedLocation ? (
              <div className="text-center py-6 text-slate-500">
                <Package className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm">Complete os passos anteriores</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Produto</p>
                    <p className="font-mono text-sm font-bold text-indigo-600">{selectedItem.product_sku}</p>
                    <p className="text-sm font-medium">{selectedItem.product_name}</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">LocalizaÃ§Ã£o</p>
                    <p className="font-mono text-sm font-bold text-emerald-600">{selectedLocation.barcode}</p>
                    <p className="text-sm">
                      {[selectedLocation.rua, selectedLocation.modulo, selectedLocation.nivel]
                        .filter(Boolean).join(' / ')}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Quantidade a Alocar</Label>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setQtyToAllocate(Math.max(0.01, qtyToAllocate - 1))}
                        disabled={qtyToAllocate <= 0.01}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        value={qtyToAllocate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setQtyToAllocate(Math.min(selectedItem.qty, Math.max(0, val)));
                        }}
                        className="text-center font-bold text-lg"
                        step="0.01"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setQtyToAllocate(Math.min(selectedItem.qty, qtyToAllocate + 1))}
                        disabled={qtyToAllocate >= selectedItem.qty}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">DisponÃ­vel: {selectedItem.qty}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setQtyToAllocate(selectedItem.qty)}
                      >
                        MÃ¡ximo
                      </Button>
                    </div>
                  </div>

                  {qtyToAllocate < selectedItem.qty && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        AlocaÃ§Ã£o parcial - Restam {(selectedItem.qty - qtyToAllocate).toFixed(2)} unidades
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleAllocate}
                  disabled={allocateMutation.isPending || qtyToAllocate <= 0}
                  size="lg"
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                  {allocateMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Alocando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Confirmar AlocaÃ§Ã£o
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
