import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { 
  Search, Package, CheckCircle, Truck, ArrowRight, RotateCcw, Printer, 
  Package2, Calendar, User, FileText, X, Camera, Trash2, Upload, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { executeInventoryTransaction } from '@/utils/inventoryTransactionUtils';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import QRScanner from '@/components/scanner/QRScanner';
import ShippingLabel from '@/components/shipping/ShippingLabel';
import SerialNumberInput from '@/components/shipping/SerialNumberInput';
import ShippingReport from '@/components/shipping/ShippingReport';

export default function Shipping() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]); // Support for multiple selection
  const [printLabel, setPrintLabel] = useState(null);
  const [showReport, setShowReport] = useState(false);

  const [activeTab, setActiveTab] = useState('pendentes'); // 'pendentes' | 'expedidos'
  const [editingOrder, setEditingOrder] = useState(null);
  const [serialInput, setSerialInput] = useState(null);
  const [shippingData, setShippingData] = useState({
    nf_number: '',
    carrier: '',
    weight: '',
    volume: '',
    driver_name: '',
    driver_cpf: '',
    shipping_notes: '',
    signed_nf_photo: [], // modificado para array para aceitar multiplos
    load_photos: [],
    shipping_batch_id: '' 
  });

  const handleImageCapture = (e, field) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach(file => {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`A imagem ${file.name} dev ter no máximo 20MB. Ajuste a resolução.`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        if (field === 'signed_nf_photo') {
          setShippingData(prev => ({ 
            ...prev, 
            signed_nf_photo: [...(prev.signed_nf_photo || []), base64String] 
          }));
        } else if (field === 'load_photos') {
          setShippingData(prev => ({ 
            ...prev, 
            load_photos: [...(prev.load_photos || []), base64String] 
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeSignedNfPhoto = (index) => {
    setShippingData(prev => {
      const newPhotos = [...(prev.signed_nf_photo || [])];
      newPhotos.splice(index, 1);
      return { ...prev, signed_nf_photo: newPhotos };
    });
  };

  const removeLoadPhoto = (index) => {
    setShippingData(prev => {
      const newPhotos = [...(prev.load_photos || [])];
      newPhotos.splice(index, 1);
      return { ...prev, load_photos: newPhotos };
    });
  };

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders-for-shipping', companyId],
    queryFn: async () => {
      // Buscar últimos pedidos e mostrar Sepados e Expedidos
      const all = await base44.entities.SalesOrder.filter({ company_id: companyId }, '-created_date', 300);
      return (all || []).filter(o => ['SEPARADO', 'EXPEDIDO', 'FATURADO'].includes(o.status));
    },
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ active: true }),
  });

  const { data: rawItems, isLoading: loadingItems } = useQuery({
    queryKey: ['order-items-shipping', selectedOrder?.id, companyId],
    queryFn: async () => {
      if (!selectedOrder || !companyId) return [];
      
      const [orderItems, separationMoves, locations, serials] = await Promise.all([
        base44.entities.SalesOrderItem.filter({ order_id: selectedOrder.id }),
        base44.entities.InventoryMove.filter({ related_id: selectedOrder.id, type: 'SEPARACAO' }),
        base44.entities.Location.listAll({ company_id: companyId }), // Usa listAll para garantir cache consistente
        base44.entities.SerialNumber.filter({ order_id: selectedOrder.id })
      ]);

      // Mapear localizações de separação e números de série para exibição na UI
      return orderItems.map(item => {
        const moves = separationMoves.filter(m => m.product_id === item.product_id);
        const locIds = [...new Set(moves.map(m => m.from_location_id).filter(Boolean))];
        const locNames = locIds.map(id => locations.find(l => l.id === id)?.barcode).filter(Boolean).sort();
        
        const itemSerials = serials
          ?.filter(s => s.product_id === item.product_id)
          ?.map(s => s.serial_number) || [];

        return {
          ...item,
          separation_location: locNames.join(', ') || null,
          serial_numbers: itemSerials
        };
      });
    },
    enabled: !!selectedOrder && !!companyId,
  });

  const isProductService = (p) => {
    if (!p) return false;
    // Aceita tanto objeto Produto (name) quanto Item de Pedido (product_name)
    const nameStr = (p.name || p.product_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const categoryStr = (p.category || '').toUpperCase();
    const skuStr = (p.sku || p.product_sku || '').toUpperCase();
    
    return categoryStr === 'SV' || 
           categoryStr === 'SERVICO' ||
           nameStr.includes('ASSISTENCIA TECNICA') || 
           nameStr.includes('SERVICO') ||
           nameStr.includes('MAO DE OBRA') ||
           skuStr.startsWith('SV-');
  };

  const items = React.useMemo(() => {
    if (!rawItems || !products) return rawItems;
    return rawItems.filter(item => {
      const product = products.find(p => p.id === item.product_id);
      return !isProductService(product || item);
    });
  }, [rawItems, products]);

  const parsePhotos = (photoData) => {
    if (!photoData) return [];
    if (typeof photoData === 'string') {
      if (photoData.startsWith('[')) {
        try { return JSON.parse(photoData); } catch { return [photoData]; }
      }
      return [photoData];
    }
    if (Array.isArray(photoData)) return photoData;
    return [];
  };

  const shipOrderMutation = useMutation({
    mutationFn: async (orderOrIds) => {
      const ids = Array.isArray(orderOrIds) ? orderOrIds : [orderOrIds.id];
      const ordersToShip = orders.filter(o => ids.includes(o.id));

      for (const order of ordersToShip) {
        if (order.status === 'EXPEDIDO') {
           console.log(`Pedido ${order.order_number} já expedido. Ignorando.`);
           continue;
        }
        // 1. Buscar itens do pedido (filtrando serviços)
        const allItems = await base44.entities.SalesOrderItem.filter({ order_id: order.id });
        const productsList = products || (await base44.entities.Product.filter({ company_id: companyId }));
        
        const orderItems = allItems.filter(i => {
           const p = productsList.find(prod => prod.id === i.product_id);
           return !isProductService(p || i);
        });

        // 2. Buscar movimentações existentes
        const moves = await base44.entities.InventoryMove.filter({ related_id: order.id });
        const separationMoves = moves.filter(m => m.type === 'SEPARACAO');
        const existingSaidas = moves.filter(m => m.type === 'SAIDA');
        const existingEstornos = moves.filter(m => m.type === 'ESTORNO');

        // 3. Concluir reservas
        const reservations = await base44.entities.Reservation.filter({ order_id: order.id });
        for (const res of reservations) {
          if (res.status === 'CANCELADA' || res.status === 'CONCLUIDA') continue;
          await base44.entities.Reservation.update(res.id, { status: 'CONCLUIDA' });
        }

        // 4. Baixa de estoque
        if (order.moves_stock !== false) {
          for (const item of orderItems) {
            const itemQty = parseFloat(item.qty) || 0;
            if (!item.product_id || itemQty <= 0) continue;

            const totalSaida = existingSaidas.filter(s => s.product_id === item.product_id).reduce((acc, curr) => acc + (parseFloat(curr.qty) || 0), 0);
            const totalEstorno = existingEstornos.filter(s => s.product_id === item.product_id).reduce((acc, curr) => acc + (parseFloat(curr.qty) || 0), 0);
            let remainingToShip = itemQty - (totalSaida - totalEstorno);
            if (remainingToShip <= 0.0001) continue;

            const sameSkuProdIds = productsList
              .filter(p => p.sku === item.product_sku)
              .map(p => p.id);
            
            const itemSeparations = separationMoves.filter(m => sameSkuProdIds.includes(m.product_id));
            for (const sep of itemSeparations) {
               if (remainingToShip <= 0) break;
               const qtyToDeduct = Math.min(parseFloat(sep.qty), remainingToShip);
               if (qtyToDeduct > 0) {
                  await executeInventoryTransaction({
                    type: 'SAIDA',
                    product_id: item.product_id,
                    qty: qtyToDeduct,
                    from_warehouse_id: sep.to_warehouse_id,
                    from_location_id: sep.to_location_id,
                    related_id: order.id,
                    reason: `Expedição ${ids.length > 1 ? 'coletiva ' : ''}(Picking) do pedido ${order.order_number || order.id}`,
                  }, order.company_id);
                 remainingToShip -= qtyToDeduct;
               }
            }
            if (remainingToShip > 0) {
               throw new Error(`O item ${item.product_name || item.product_sku} (Pedido ${order.order_number}) não possui separação suficiente.`);
            }
            await base44.entities.SalesOrderItem.update(item.id, { qty_separated: itemQty });
          }
        }

        // 5. Atualizar pedido
        const finalSignedNfPhoto = shippingData.signed_nf_photo?.length > 0 
          ? JSON.stringify(shippingData.signed_nf_photo) 
          : order.signed_nf_photo;

        await base44.entities.SalesOrder.update(order.id, { 
          status: 'EXPEDIDO',
          nf_number: ids.length === 1 ? (shippingData.nf_number || order.nf_number) : order.nf_number,
          carrier: shippingData.carrier || order.carrier,
          weight: ids.length === 1 ? (shippingData.weight || order.weight) : order.weight,
          volume: ids.length === 1 ? (shippingData.volume || order.volume) : order.volume,
          driver_name: shippingData.driver_name || order.driver_name,
          driver_cpf: shippingData.driver_cpf || order.driver_cpf,
          shipping_notes: shippingData.shipping_notes || order.shipping_notes,
          signed_nf_photo: finalSignedNfPhoto,
          load_photos: shippingData.load_photos?.length > 0 ? shippingData.load_photos : order.load_photos,
          shipping_batch_id: shippingData.shipping_batch_id || order.shipping_batch_id
        });
      }
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['orders-for-shipping'] });
       setEditingOrder(null);
       setSelectedIds([]);
       toast.success('Pedidos expedidos com sucesso');
     },
     onError: (error) => {
       toast.error('Erro na expedição: ' + error.message);
     }
  });

  const updateShippingInfoMutation = useMutation({
    mutationFn: async (orderOrIds) => {
      const ids = Array.isArray(orderOrIds) ? orderOrIds : [orderOrIds.id];
      const ordersToUpdate = orders.filter(o => ids.includes(o.id));

      const finalSignedNfPhoto = shippingData.signed_nf_photo?.length > 0 
        ? JSON.stringify(shippingData.signed_nf_photo) 
        : undefined;

      for (const order of ordersToUpdate) {
        await base44.entities.SalesOrder.update(order.id, {
          nf_number: ids.length === 1 ? (shippingData.nf_number || order.nf_number) : order.nf_number,
          carrier: shippingData.carrier || order.carrier,
          weight: ids.length === 1 ? (shippingData.weight || order.weight) : order.weight,
          volume: ids.length === 1 ? (shippingData.volume || order.volume) : order.volume,
          driver_name: shippingData.driver_name || order.driver_name,
          driver_cpf: shippingData.driver_cpf || order.driver_cpf,
          shipping_notes: shippingData.shipping_notes || order.shipping_notes,
          signed_nf_photo: finalSignedNfPhoto || order.signed_nf_photo,
          load_photos: shippingData.load_photos?.length > 0 ? shippingData.load_photos : order.load_photos,
          shipping_batch_id: shippingData.shipping_batch_id || order.shipping_batch_id
        });
      }
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['orders-for-shipping', companyId] });
       setEditingOrder(null);
       setSelectedOrder(prev => {
         if (!prev) return null;
         return {
           ...prev,
           nf_number: shippingData.nf_number || prev.nf_number,
           carrier: shippingData.carrier || prev.carrier,
           weight: shippingData.weight || prev.weight,
           volume: shippingData.volume || prev.volume,
           driver_name: shippingData.driver_name || prev.driver_name,
           driver_cpf: shippingData.driver_cpf || prev.driver_cpf,
           shipping_notes: shippingData.shipping_notes || prev.shipping_notes,
           signed_nf_photo: shippingData.signed_nf_photo?.length > 0 ? JSON.stringify(shippingData.signed_nf_photo) : prev.signed_nf_photo,
           load_photos: shippingData.load_photos?.length > 0 ? shippingData.load_photos : prev.load_photos,
           shipping_batch_id: shippingData.shipping_batch_id || prev.shipping_batch_id
         };
       });
       toast.success('Dados de expedição atualizados');
     },
     onError: (error) => {
       toast.error('Erro ao atualizar dados: ' + error.message);
     }
  });

  const cancelShippingMutation = useMutation({
    mutationFn: async (order) => {
      // 1. Buscar itens do pedido (filtrando serviços)
      const allItems = await base44.entities.SalesOrderItem.filter({ order_id: order.id });
      const products = await base44.entities.Product.filter({ company_id: companyId });
      
      const orderItems = allItems.filter(i => {
         const p = products.find(prod => prod.id === i.product_id);
         return p?.category !== 'SV';
      });
      
      // 2. Buscar movimentações existentes para calcular o estorno correto (Idempotência)
      const moves = await base44.entities.InventoryMove.filter({ related_id: order.id });
      const saidas = moves.filter(m => m.type === 'SAIDA');
      const estornosExistentes = moves.filter(m => m.type === 'ESTORNO');
      
      // 3. Garantir a existência da Doca de Expedição Genérica
      let expWarehouse = (await base44.entities.Warehouse.filter({ company_id: order.company_id, type: 'EXPEDICAO' }))[0];
      if (!expWarehouse) {
        expWarehouse = await base44.entities.Warehouse.create({
           company_id: order.company_id,
           code: 'EXP',
           name: 'Doca de Expedição',
           type: 'EXPEDICAO',
           active: true
        });
      }
      
      // 4. Estornar APENAS o que ainda não foi estornado
      for (const item of orderItems) {
        const qtySaida = saidas
          .filter(m => m.product_id === item.product_id)
          .reduce((acc, curr) => acc + (parseFloat(curr.qty) || 0), 0);
        
        const qtyEstorno = estornosExistentes
          .filter(m => m.product_id === item.product_id)
          .reduce((acc, curr) => acc + (parseFloat(curr.qty) || 0), 0);
        
        const netToEstorno = qtySaida - qtyEstorno;
        
        if (netToEstorno > 0) {
          await executeInventoryTransaction({
             type: 'ESTORNO',
             product_id: item.product_id,
             qty: netToEstorno,
             to_warehouse_id: expWarehouse.id,
             to_location_id: null,
             related_type: 'PEDIDO',
             related_id: order.id,
             reason: `Estorno de cancelamento de expedição do pedido ${order.order_number || order.id}`
          }, order.company_id);
        }
      }
      
      // 5. Atualizar status do pedido
      await base44.entities.SalesOrder.update(order.id, { 
        status: 'SEPARADO',
      });
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['orders-for-shipping', companyId] });
       setSelectedOrder(prev => prev ? { ...prev, status: 'SEPARADO' } : null);
       toast.success('Expedição cancelada! Itens retornaram para a Doca.');
     },
     onError: (error) => {
       toast.error('Erro ao cancelar expedição: ' + error.message);
     }
  });

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setSelectedIds([order.id]); // Ao clicar, assume seleção única por padrão
    setShippingData({
      nf_number: order.nf_number || '',
      carrier: order.carrier || '',
      weight: order.weight || '',
      volume: order.volume || '',
      driver_name: order.driver_name || '',
      driver_cpf: order.driver_cpf || '',
      shipping_notes: order.shipping_notes || '',
      signed_nf_photo: parsePhotos(order.signed_nf_photo),
      load_photos: Array.isArray(order.load_photos) ? order.load_photos : [],
      shipping_batch_id: order.shipping_batch_id || ''
    });
  };

  const toggleSelectOrder = (id) => {
    setSelectedIds(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const filteredOrders = orders?.filter(o =>
    o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.nf_number?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingSelected = orders?.filter(o => 
    selectedIds.includes(o.id) && 
    o.status !== 'EXPEDIDO' && 
    o.status !== 'FATURADO'
  ) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Expedição</h1>
        <p className="text-slate-500">Gere etiquetas e expida pedidos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        <div className="lg:col-span-1">
          <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Pedidos</CardTitle>
            <div className="flex bg-slate-100 p-1 rounded-lg mt-3">
              <button
                onClick={() => setActiveTab('pendentes')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeTab === 'pendentes' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Prontos ({orders?.filter(o => o.status !== 'EXPEDIDO' && o.status !== 'FATURADO').length || 0})
              </button>
              <button
                onClick={() => setActiveTab('expedidos')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeTab === 'expedidos' 
                    ? 'bg-white text-emerald-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Expedidos ({orders?.filter(o => o.status === 'EXPEDIDO' || o.status === 'FATURADO').length || 0})
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              <QRScanner
                onScan={(code) => {
                  const order = orders?.find(
                    o => o.order_number === code || o.numero_pedido_externo === code
                  );
                  if (order) {
                    setSelectedOrder(order);
                    setActiveTab(order.status === 'EXPEDIDO' || order.status === 'FATURADO' ? 'expedidos' : 'pendentes');
                    toast.success(`Pedido ${order.order_number} selecionado`);
                  } else {
                    toast.error('Pedido não encontrado');
                  }
                }}
                placeholder="Escaneie o pedido"
              />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Busque por número ou cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-9 text-sm"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (()=>{
                const tabOrders = orders?.filter(o => {
                  const isExp = o.status === 'EXPEDIDO' || o.status === 'FATURADO';
                  return activeTab === 'expedidos' ? isExp : !isExp;
                });
                
                const searchResults = tabOrders?.filter(o =>
                  o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
                  o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
                  o.nf_number?.toLowerCase().includes(search.toLowerCase())
                );

                if (searchResults?.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <Truck className="h-10 w-10 mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-400 text-sm">Nenhum pedido nesta lista</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {searchResults?.map((order) => (
                    <div key={order.id} className="relative flex items-center gap-2">
                       <input 
                         type="checkbox" 
                         checked={selectedIds.includes(order.id)}
                         onChange={() => toggleSelectOrder(order.id)}
                         className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                       />
                       <button
                        onClick={() => handleSelectOrder(order)}
                        className={`flex-1 text-left p-2.5 rounded-lg border transition-all ${
                          selectedOrder?.id === order.id
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <p className="font-mono text-xs text-indigo-600 font-bold">
                            {order.order_number || `#${order.id.slice(0, 8)}`}
                          </p>
                          {order.shipping_batch_id && <Badge variant="outline" className="text-[9px] bg-slate-100">Batch: {order.shipping_batch_id}</Badge>}
                        </div>
                        <p className="text-[13px] text-slate-700 font-medium truncate">{order.client_name}</p>
                        <div className="flex justify-between items-center mt-1">
                          <Badge className={`text-[10px] px-1.5 py-0 ${
                            order.status === 'EXPEDIDO' ? 'bg-emerald-100 text-emerald-700' :
                            order.status === 'FATURADO' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {order.status}
                          </Badge>
                          {order.delivery_date && (
                            <span className="text-[10px] text-slate-500">
                              {format(new Date(order.delivery_date), 'dd/MM', { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
            </CardContent>
          </Card>
        </div>

        {/* Items & Labels */}
        <div className="lg:col-span-2 space-y-4">
          {(selectedIds.length > 0) && (editingOrder || (selectedOrder?.status !== 'EXPEDIDO')) && (
            <Card className={selectedIds.length > 1 ? "border-amber-200 bg-amber-50/10" : ""}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                   <span>{selectedIds.length > 1 ? `Expedição Coletiva (${selectedIds.length} pedidos)` : 'Dados de Expedição'}</span>
                   {selectedIds.length > 1 && <Badge className="bg-amber-100 text-amber-800">Frete Compartilhado</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {selectedIds.length === 1 && (
                    <div>
                      <label className="text-sm font-medium text-slate-700">NF</label>
                      <Input
                        placeholder="Número da nota fiscal"
                        value={shippingData.nf_number}
                        onChange={(e) => setShippingData({...shippingData, nf_number: e.target.value})}
                        className="mt-1"
                        disabled={selectedOrder?.status === 'EXPEDIDO' && !editingOrder}
                      />
                    </div>
                  )}
                  {selectedIds.length > 1 && (
                    <div className="col-span-1">
                      <label className="text-sm font-medium text-slate-700">Lote / Vínculo de Carga</label>
                      <Input
                        placeholder="Ex: CARGA-SUL-2204"
                        value={shippingData.shipping_batch_id}
                        onChange={(e) => setShippingData({...shippingData, shipping_batch_id: e.target.value.toUpperCase()})}
                        className="mt-1 bg-amber-50 border-amber-200"
                      />
                    </div>
                  )}
                  <div className={selectedIds.length > 1 ? "col-span-1" : ""}>
                    <label className="text-sm font-medium text-slate-700">Transportadora</label>
                    <Input
                      placeholder="Nome da transportadora"
                      value={shippingData.carrier}
                      onChange={(e) => setShippingData({...shippingData, carrier: e.target.value})}
                      className="mt-1"
                      disabled={selectedOrder?.status === 'EXPEDIDO' && !editingOrder}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Peso (kg)</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={shippingData.weight}
                      onChange={(e) => setShippingData({...shippingData, weight: e.target.value})}
                      className="mt-1"
                      disabled={selectedOrder?.status === 'EXPEDIDO' && !editingOrder}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Volume (m³)</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={shippingData.volume}
                      onChange={(e) => setShippingData({...shippingData, volume: e.target.value})}
                      className="mt-1"
                      disabled={selectedOrder?.status === 'EXPEDIDO' && !editingOrder}
                    />
                  </div>
                </div>

                <Separator className="my-2" />
                <h3 className="text-md font-bold text-slate-800">Registro de Retirada</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Nome de quem retirou</label>
                    <Input
                      placeholder="Nome do motorista / cliente"
                      value={shippingData.driver_name}
                      onChange={(e) => setShippingData({...shippingData, driver_name: e.target.value})}
                      className="mt-1"
                      disabled={selectedOrder?.status === 'EXPEDIDO' && !editingOrder}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">CPF do Motorista</label>
                    <Input
                      placeholder="000.000.000-00"
                      value={shippingData.driver_cpf}
                      onChange={(e) => setShippingData({...shippingData, driver_cpf: e.target.value})}
                      className="mt-1"
                      disabled={selectedOrder?.status === 'EXPEDIDO' && !editingOrder}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-slate-700">Observações de Expedição</label>
                    <textarea
                      placeholder="Alguma avaria ou instrução extra?"
                      value={shippingData.shipping_notes}
                      onChange={(e) => setShippingData({...shippingData, shipping_notes: e.target.value})}
                      className="w-full mt-1 min-h-20 text-sm p-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                      disabled={selectedOrder?.status === 'EXPEDIDO' && !editingOrder}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Foto NF Assinada */}
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                     <div className="flex justify-between items-center mb-2">
                       <p className="text-sm font-bold text-slate-800">Canhoto / NF Assinada</p>
                       <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                         {shippingData.signed_nf_photo?.length || 0} fotos
                       </span>
                     </div>
                     
                     {shippingData.signed_nf_photo?.length > 0 && (
                       <div className="grid grid-cols-2 gap-2 mb-3">
                         {shippingData.signed_nf_photo.map((photo, i) => (
                           <div key={i} className="relative aspect-video bg-black/5 rounded-md overflow-hidden group">
                             <img src={photo} className="w-full h-full object-cover" alt={`NF Assinada ${i+1}`} />
                             <button
                               onClick={() => removeSignedNfPhoto(i)} 
                               className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                             >
                                <X className="h-3 w-3" />
                             </button>
                           </div>
                         ))}
                       </div>
                     )}

                     {!(selectedOrder?.status === 'EXPEDIDO' && !editingOrder) && (
                       <label className="flex items-center justify-center w-full h-10 border border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors text-slate-600 font-medium text-sm gap-2 mt-4">
                          <Upload className="w-4 h-4" />
                          Adicionar Foto
                          <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleImageCapture(e, 'signed_nf_photo')} />
                       </label>
                     )}
                  </div>

                  {/* Fotos da Carga */}
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                     <div className="flex justify-between items-center mb-2">
                       <p className="text-sm font-bold text-slate-800">Fotos da Carga</p>
                       <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                         {shippingData.load_photos?.length || 0} fotos
                       </span>
                     </div>
                     
                     {shippingData.load_photos?.length > 0 && (
                       <div className="grid grid-cols-3 gap-2 mb-3">
                         {shippingData.load_photos.map((photo, i) => (
                           <div key={i} className="relative aspect-square bg-black/5 rounded-md overflow-hidden group">
                             <img src={photo} className="w-full h-full object-cover" alt={`Carga ${i+1}`} />
                             <button
                               onClick={() => removeLoadPhoto(i)} 
                               className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                             >
                                <X className="h-3 w-3" />
                             </button>
                           </div>
                          ))}
                        </div>
                      )}

                      {!(selectedOrder?.status === 'EXPEDIDO' && !editingOrder) && (
                        <label className="flex items-center justify-center w-full h-10 border border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors text-slate-600 font-medium text-sm gap-2 mt-4">
                           <Upload className="w-4 h-4" />
                           Adicionar Foto
                           <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleImageCapture(e, 'load_photos')} />
                        </label>
                      )}
                  </div>
                </div>

                <div className="flex gap-2">
                    {!(selectedOrder?.status === 'EXPEDIDO' && !editingOrder) && (
                      <Button
                        onClick={() => updateShippingInfoMutation.mutate(selectedIds)}
                        disabled={updateShippingInfoMutation.isPending}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        {selectedOrder?.status === 'EXPEDIDO' ? 'Salvar Edição' : 'Atualizar Dados'}
                      </Button>
                    )}
                    {(pendingSelected.length > 0) && (
                        <Button
                          onClick={() => shipOrderMutation.mutate(pendingSelected.map(o => o.id))}
                          disabled={shipOrderMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                        >
                          <Truck className="h-4 w-4 mr-2" />
                          {pendingSelected.length > 1 ? `Expedir ${pendingSelected.length} Pedidos` : 'Expedir Agora'}
                        </Button>
                    )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {selectedOrder 
                  ? `Etiquetas - ${selectedOrder.order_number || `#${selectedOrder.id.slice(0, 8)}`}`
                  : 'Selecione um pedido'
                }
                {selectedOrder?.is_shipment && (
                  <Badge variant="outline" className="ml-2 border-indigo-200 text-indigo-700 bg-indigo-50 font-bold uppercase text-[10px]">
                    Remessa
                  </Badge>
                )}
              </CardTitle>
              <div className="flex gap-2">
                {selectedOrder?.status === 'EXPEDIDO' && (
                  <>
                    <Button
                      onClick={() => setShowReport(true)}
                      variant="outline"
                      size="sm"
                      className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Relatório
                    </Button>
                    {!editingOrder && (
                      <Button
                        onClick={() => cancelShippingMutation.mutate(selectedOrder)}
                        variant="outline"
                        size="sm"
                        disabled={cancelShippingMutation.isPending}
                        className="border-red-100 text-red-600 hover:bg-red-50 shadow-sm"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Cancelar Expedição
                      </Button>
                    )}
                  </>
                )}

                {selectedOrder?.status === 'SEPARADO' && (
                  <Button
                    onClick={() => {
                        toast.info('Iniciando expedição do pedido...');
                        shipOrderMutation.mutate(selectedOrder);
                    }}
                    variant="outline"
                    size="sm"
                    className="border-amber-200 text-amber-700 hover:bg-amber-50 shadow-sm"
                  >
                    <Truck className="h-4 w-4 mr-1 text-amber-600" />
                    Expedir Agora
                  </Button>
                )}

                {selectedOrder?.status === 'EXPEDIDO' && !editingOrder && (
                  <Button
                    onClick={() => setEditingOrder(true)}
                    size="sm"
                    className="bg-slate-600 hover:bg-slate-700 text-white shadow-sm"
                  >
                    Editar Dados
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedOrder ? (
                <div className="text-center py-12">
                  <ArrowRight className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">Selecione um pedido na lista</p>
                </div>
              ) : loadingItems ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <Skeleton key={i} className="h-40 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                    {items?.map((item) => (
                      <div key={item.id} className="border rounded-lg p-4 bg-slate-50">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="font-mono text-sm text-indigo-600 font-bold">
                              {item.product_sku}
                            </p>
                            <p className="font-medium text-slate-900">{item.product_name}</p>
                            <div className="flex items-center gap-3 mt-1">
                               <p className="text-sm text-slate-600">Qtd: {item.qty} un</p>
                               {item.separation_location && (
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] flex items-center gap-1">
                                     <MapPin className="h-3 w-3" />
                                     {item.separation_location}
                                  </Badge>
                               )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => setSerialInput(item)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Séries
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setPrintLabel(item)}
                              className="bg-indigo-600 hover:bg-indigo-700"
                            >
                              <Printer className="h-4 w-4 mr-1" />
                              Etiqueta
                            </Button>
                          </div>
                        </div>
                      
                      <Separator className="my-3" />
                      
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">Cliente:</span>
                          <p className="font-medium text-slate-900">{selectedOrder.client_name}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">NF:</span>
                          <p className="font-medium text-slate-900">{selectedOrder.nf_number || '-'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Entrega:</span>
                          <p className="font-medium text-slate-900">
                            {selectedOrder.delivery_date 
                              ? format(new Date(selectedOrder.delivery_date), 'dd/MM/yyyy', { locale: ptBR })
                              : '-'
                            }
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Pedido:</span>
                          <p className="font-medium text-slate-900">
                            {selectedOrder.order_number || selectedOrder.numero_pedido_externo}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Print Label Dialog */}
       {printLabel && (
         <ShippingLabel 
           item={printLabel}
           order={selectedOrder}
           onClose={() => setPrintLabel(null)}
         />
       )}

       {/* Serial Number Input Dialog */}
       {serialInput && (
         <SerialNumberInput
           item={serialInput}
           order={selectedOrder}
           onClose={() => setSerialInput(null)}
           onSuccess={() => queryClient.invalidateQueries({ queryKey: ['order-items-shipping'] })}
         />
       )}
      {showReport && selectedOrder && (
        <ShippingReport 
          order={selectedOrder} 
          items={items}
          onClose={() => setShowReport(false)} 
        />
      )}
    </div>
  );
}