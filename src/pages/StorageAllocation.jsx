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

// Função para calcular score de uma localização
function calculateLocationScore(location, product, stockBalances) {
  let score = 100;

  // Localização já tem este produto? (FIFO + consolidação)
  const hasProduct = stockBalances?.find(
    sb => sb.location_id === location.id && sb.product_id === product.id
  );
  if (hasProduct) {
    score += 50; // Priorizar consolidação
  }

  // Verificar ocupação da localização
  const locationOccupancy = stockBalances?.filter(
    sb => sb.location_id === location.id
  ).reduce((sum, sb) => sum + (sb.qty_available || 0), 0) || 0;

  const occupancyRate = location.capacity ? locationOccupancy / location.capacity : 0;

  // Penalizar localizações muito cheias (< 20% espaço livre)
  if (occupancyRate > 0.8) {
    score -= 30;
  } else if (occupancyRate > 0.5) {
    score -= 10;
  }

  // Bonificar localizações vazias se não há produto consolidado
  if (!hasProduct && occupancyRate === 0) {
    score += 20;
  }

  // Priorizar níveis médios (mais ergonômicos)
  const nivel = location.nivel?.toUpperCase();
  if (nivel === 'M' || nivel === 'MEDIO' || nivel === '2') {
    score += 15;
  } else if (nivel === 'A' || nivel === 'ALTO' || nivel === '3') {
    score += 5;
  }

  // Priorizar ruas/módulos iniciais (mais próximos)
  const rua = parseInt(location.rua) || 999;
  const modulo = parseInt(location.modulo) || 999;
  
  score -= rua * 2; // Menos score para ruas mais distantes
  score -= modulo * 1;

  return score;
}

// Sugerir melhores localizações
function suggestBestLocations(product, locations, stockBalances, warehouseId, limit = 3) {
  if (!locations || !product) return [];

  // Filtrar localizações: preferir do mesmo armazém, mas aceitar sem warehouse_id
  let validLocations = locations.filter(l => l.active !== false);
  
  // Se temos localizações do armazém específico, usar só essas
  const warehouseLocations = validLocations.filter(l => l.warehouse_id === warehouseId);
  if (warehouseLocations.length > 0) {
    validLocations = warehouseLocations;
  }

  // Se não há localizações, retornar todas as ativas
  if (validLocations.length === 0) {
    validLocations = locations.filter(l => l.active !== false);
  }

  // Calcular score para cada localização
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

  const { data: pendingItems } = useQuery({
    queryKey: ['pending-allocation', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const receivingItems = await base44.entities.ReceivingItem.filter({ company_id: companyId, status: 'CONFERIDO' });
      
      // Excluir itens com quantidade 0
      const validReceivingItems = receivingItems.filter(item => item.qty > 0);
      
      const stockBalances = await base44.entities.StockBalance.filter({ company_id: companyId });
      const pendingStockBalances = stockBalances.filter(sb => !sb.warehouse_id && !sb.location_id && sb.qty_available > 0).map(sb => ({ ...sb, isFromStockBalance: true }));
      
      return [...validReceivingItems, ...pendingStockBalances];
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

  // Quando selecionar um item, gerar sugestões
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
     
     // Se o item não tem warehouse_id, buscar armazém padrão
     let warehouseId = item.warehouse_id;
     if (!warehouseId) {
       const warehouses = await base44.entities.Warehouse.filter({
         company_id: companyId,
         active: true
       });
       const defaultWarehouse = warehouses.find(w => w.type === 'ACABADO') || warehouses[0];
       if (!defaultWarehouse) {
         throw new Error('Nenhum armazém ativo encontrado');
       }
       warehouseId = defaultWarehouse.id;
       
       // Atualizar o item com o warehouse_id
       await base44.entities.ReceivingItem.update(item.id, {
         warehouse_id: warehouseId,
         warehouse_name: defaultWarehouse.name
       });
     }

     // Buscar saldo existente do item (criado no recebimento) - CRÍTICO: filtrar por company_id
     const currentBalance = await base44.entities.StockBalance.filter({
       company_id: companyId,
       product_id: item.product_id,
       warehouse_id: warehouseId,
       location_id: item.location_id
     });

     // Transferência: RETIRAR da localização original
     if (currentBalance.length > 0) {
       const balance = currentBalance[0];
       const remainingQtyAfterAlloc = Math.round((balance.qty_available - qty) * 1000) / 1000;

       if (remainingQtyAfterAlloc > 0) {
         // Ainda tem estoque na localização original
         await base44.entities.StockBalance.update(balance.id, {
           qty_available: remainingQtyAfterAlloc
         });
       } else {
         // Removeu tudo da localização original
         await base44.entities.StockBalance.delete(balance.id);
       }
     }

     // ADICIONAR na nova localização - CRÍTICO: filtrar por company_id
     const targetBalance = await base44.entities.StockBalance.filter({
       company_id: companyId,
       product_id: item.product_id,
       warehouse_id: warehouseId,
       location_id: locationId
     });

     if (targetBalance.length > 0) {
       const balance = targetBalance[0];
       const newQty = Math.round(((balance.qty_available || 0) + qty) * 1000) / 1000;
       const newAvgCost = ((balance.qty_available || 0) * (balance.avg_cost || 0) + qty * (currentBalance[0]?.avg_cost || item.unit_cost)) / newQty;
       await base44.entities.StockBalance.update(balance.id, {
         qty_available: newQty,
         avg_cost: newAvgCost
       });
     } else {
       await base44.entities.StockBalance.create({
         company_id: companyId,
         product_id: item.product_id,
         warehouse_id: warehouseId,
         location_id: locationId,
         qty_available: Math.round(qty * 1000) / 1000,
         qty_reserved: 0,
         qty_separated: 0,
         avg_cost: currentBalance[0]?.avg_cost || item.unit_cost
       });
     }

     // Movimento de entrada no armazém (recebimento)
     await base44.entities.InventoryMove.create({
       company_id: companyId,
       type: 'ENTRADA',
       product_id: item.product_id,
       qty: qty,
       to_warehouse_id: warehouseId,
       to_location_id: locationId,
       related_type: 'COMPRA',
       related_id: item.batch_id,
       reason: `Recebimento/Alocação - Lote ${batch?.batch_number || 'N/A'}`
     });

      // Calcular quantidade restante no item (arredondar para evitar imprecisão float)
       const remainingQty = Math.round((item.qty - qty) * 1000) / 1000;

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
    onError: (error) => {
      toast.error('Erro ao alocar: ' + error.message);
    }
  });

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
      toast.error('Localização não encontrada');
      return;
    }

    if (location.warehouse_id !== selectedItem.warehouse_id) {
      toast.error('Localização pertence a outro armazém');
      return;
    }

    setSelectedLocation(location);
    setManualLocationCode('');
    toast.success(`Localização selecionada: ${location.barcode}`);
  };

  const handleAllocate = () => {
    if (!selectedItem || !selectedLocation) {
      toast.error('Selecione item e localização');
      return;
    }

    if (qtyToAllocate <= 0 || qtyToAllocate > selectedItem.qty) {
      toast.error('Quantidade inválida');
      return;
    }

    allocateMutation.mutate({
      item: selectedItem,
      locationId: selectedLocation.id,
      qty: qtyToAllocate
    });
  };

  const totalPendingQty = pendingItems?.reduce((sum, item) => sum + item.qty, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('ReceivingList')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Alocação Inteligente</h1>
            <p className="text-slate-500">Sistema de sugestão automática de localizações</p>
          </div>
        </div>
        <Badge className={totalPendingQty > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>
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
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200'
                          : 'bg-white border-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm text-indigo-600 font-bold">{item.product_sku}</p>
                          <p className="font-medium text-sm truncate">{item.product_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {batch?.batch_number}
                            </Badge>
                            <span className="text-xs text-slate-500">{item.warehouse_name}</span>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-lg font-bold text-slate-900">{item.qty}</p>
                        </div>
                      </div>
                    </button>
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
              Bipar Localização
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
                      toast.error('Localização não encontrada');
                      return;
                    }
                    if (location.warehouse_id !== selectedItem.warehouse_id) {
                      toast.error('Localização pertence a outro armazém');
                      return;
                    }
                    handleSelectLocation(location);
                    toast.success(`Localização: ${location.barcode}`);
                  }}
                  placeholder="Escaneie o código da localização"
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
                     <p className="text-xs">Nenhuma localização disponível</p>
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
                                Produto já aqui
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
              Confirmar Alocação
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
                    <p className="text-xs text-slate-500 mb-1">Localização</p>
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
                      <span className="text-xs text-slate-500">Disponível: {selectedItem.qty}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setQtyToAllocate(selectedItem.qty)}
                      >
                        Máximo
                      </Button>
                    </div>
                  </div>

                  {qtyToAllocate < selectedItem.qty && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Alocação parcial - Restam {(selectedItem.qty - qtyToAllocate).toFixed(2)} unidades
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
                      Confirmar Alocação
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