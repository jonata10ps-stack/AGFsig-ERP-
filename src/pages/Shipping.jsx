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

export default function Shipping() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [printLabel, setPrintLabel] = useState(null);

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
    signed_nf_photo: '',
    load_photos: []
  });

  const handleImageCapture = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB. Ajuste a resolução da câmera.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      if (field === 'signed_nf_photo') {
        setShippingData(prev => ({ ...prev, signed_nf_photo: base64String }));
      } else if (field === 'load_photos') {
        setShippingData(prev => ({ 
          ...prev, 
          load_photos: [...(prev.load_photos || []), base64String] 
        }));
      }
    };
    reader.readAsDataURL(file);
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
      // Buscar últimos pedidos e mostrar apenas o que está pronto para ser expedido (já separado fisicamente)
      const all = await base44.entities.SalesOrder.filter({ company_id: companyId }, '-created_date', 200);
      return (all || []).filter(o => o.status === 'SEPARADO');
    },
    enabled: !!companyId,
  });

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['order-items-shipping', selectedOrder?.id, companyId],
    queryFn: async () => {
      if (!selectedOrder || !companyId) return [];
      
      const [orderItems, separationMoves, locations] = await Promise.all([
        base44.entities.SalesOrderItem.filter({ order_id: selectedOrder.id }),
        base44.entities.InventoryMove.filter({ related_id: selectedOrder.id, type: 'SEPARACAO' }),
        base44.entities.Location.filter({ company_id: companyId })
      ]);

      // Mapear localizações de separação para exibição na UI
      return orderItems.map(item => {
        const moves = separationMoves.filter(m => m.product_id === item.product_id);
        const locIds = [...new Set(moves.map(m => m.from_location_id).filter(Boolean))];
        const locNames = locIds.map(id => locations.find(l => l.id === id)?.barcode).filter(Boolean).sort();
        
        return {
          ...item,
          separation_location: locNames.join(', ') || null
        };
      });
    },
    enabled: !!selectedOrder && !!companyId,
  });

  const shipOrderMutation = useMutation({
    mutationFn: async (order) => {
      // 1. Buscar itens do pedido
      const orderItems = await base44.entities.SalesOrderItem.filter({ order_id: order.id });

      // 2. Buscar movimentações de SEPARACAO (Picking)
      const separationMoves = await base44.entities.InventoryMove.filter({ related_id: order.id, type: 'SEPARACAO' });

      // 3. Buscar e concluir reservas (se existirem)
      const reservations = await base44.entities.Reservation.filter({ related_id: order.id });
      for (const res of reservations) {
        if (res.status === 'CANCELADA' || res.status === 'CONCLUIDA') continue;
        // Atualizar status da reserva para CONCLUIDA (pois foi expedida)
        await base44.entities.Reservation.update(res.id, { status: 'CONCLUIDA' });
      }

      // 4. Efetuar a baixa real do estoque disponível (SAIDA) usando histórico de separação
      for (const item of orderItems) {
        const itemQty = parseFloat(item.qty) || 0;
        if (!item.product_id || itemQty <= 0) continue;

        // Limpar status de item do pedido no banco
        await base44.entities.SalesOrderItem.update(item.id, {
          qty_separated: itemQty // Marcar como totalmente separado para consistência se necessário
        });

        // Filtrar as movimentações de SEPARACAO Deste item
        const itemSeparations = separationMoves.filter(m => m.product_id === item.product_id);
        
        let remainingToShip = itemQty;

        // 4. Efetuar a baixa real do estoque disponível (SAIDA) usando histórico de separação
        for (const sep of itemSeparations) {
           if (remainingToShip <= 0) break;
           const qtyToDeduct = Math.min(parseFloat(sep.qty), remainingToShip);
           
           if (qtyToDeduct > 0) {
             // Utiliza função central com bloqueio atômico de saldo negativo!
             await executeInventoryTransaction({
               type: 'SAIDA',
               product_id: item.product_id,
               qty: qtyToDeduct,
               from_warehouse_id: sep.to_warehouse_id,
               from_location_id: sep.to_location_id,
               related_type: 'PEDIDO',
               related_id: order.id,
               reason: `Expedição rastreada (Picking) do pedido ${order.order_number || order.id}`,
             }, order.company_id);
             
             remainingToShip -= qtyToDeduct;
           }
        }

        // Se após varrer o Picking faltar algo (pedido sem picking ou incompleto)
        if (remainingToShip > 0) {
           throw new Error(`O item ${item.product_name || item.product_sku} não possui separação (picking) suficiente. Realize a Separação/Bipagem antes de expedir para garantir o endereçamento correto.`);
        }
      }

      // 3. Atualizar status do pedido
      await base44.entities.SalesOrder.update(order.id, { 
        status: 'EXPEDIDO',
        nf_number: shippingData.nf_number || order.nf_number,
        carrier: shippingData.carrier || order.carrier,
        weight: shippingData.weight || order.weight,
        volume: shippingData.volume || order.volume,
        driver_name: shippingData.driver_name || order.driver_name,
        driver_cpf: shippingData.driver_cpf || order.driver_cpf,
        shipping_notes: shippingData.shipping_notes || order.shipping_notes,
        signed_nf_photo: shippingData.signed_nf_photo || order.signed_nf_photo,
        load_photos: shippingData.load_photos?.length > 0 ? shippingData.load_photos : order.load_photos
      });
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['orders-for-shipping', companyId] });
       setEditingOrder(null);
       setSelectedOrder(prev => {
         if (!prev) return null;
         return {
           ...prev,
           status: 'EXPEDIDO',
           nf_number: shippingData.nf_number || prev.nf_number,
           carrier: shippingData.carrier || prev.carrier,
           weight: shippingData.weight || prev.weight,
           volume: shippingData.volume || prev.volume,
           driver_name: shippingData.driver_name || prev.driver_name,
           driver_cpf: shippingData.driver_cpf || prev.driver_cpf,
           shipping_notes: shippingData.shipping_notes || prev.shipping_notes,
           signed_nf_photo: shippingData.signed_nf_photo || prev.signed_nf_photo,
           load_photos: shippingData.load_photos?.length > 0 ? shippingData.load_photos : prev.load_photos
         };
       });
       toast.success('Pedido expedido e estoque baixado com sucesso');
     },
  });

  const updateShippingInfoMutation = useMutation({
    mutationFn: async (order) => {
      await base44.entities.SalesOrder.update(order.id, {
        nf_number: shippingData.nf_number || order.nf_number,
        carrier: shippingData.carrier || order.carrier,
        weight: shippingData.weight || order.weight,
        volume: shippingData.volume || order.volume,
        driver_name: shippingData.driver_name || order.driver_name,
        driver_cpf: shippingData.driver_cpf || order.driver_cpf,
        shipping_notes: shippingData.shipping_notes || order.shipping_notes,
        signed_nf_photo: shippingData.signed_nf_photo || order.signed_nf_photo,
        load_photos: shippingData.load_photos?.length > 0 ? shippingData.load_photos : order.load_photos
      });
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
           signed_nf_photo: shippingData.signed_nf_photo || prev.signed_nf_photo,
           load_photos: shippingData.load_photos?.length > 0 ? shippingData.load_photos : prev.load_photos
         };
       });
       toast.success('Dados de expedição atualizados');
     },
  });

  const cancelShippingMutation = useMutation({
    mutationFn: async (order) => {
      // 1. Buscar os itens do pedido
      const orderItems = await base44.entities.SalesOrderItem.filter({ order_id: order.id });
      
      // 2. Buscar as "SAÍDAS" da expedição original para estornar as quantidades correspondentes
      const saidas = await base44.entities.InventoryMove.filter({ related_id: order.id, type: 'SAIDA' });
      
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
      
      // 4. Estornar as saídas jogando os itens para essa Doca como estoque Disponível a ser trabalhado (Pendentes de Alocação)
      for (const move of saidas) {
        if (!move.product_id || parseFloat(move.qty) <= 0) continue;
        
        await executeInventoryTransaction({
           type: 'ESTORNO',
           product_id: move.product_id,
           qty: move.qty,
           to_warehouse_id: expWarehouse.id, // Cai na doca temporária exigindo realocação!
           to_location_id: null,
           related_type: 'PEDIDO',
           related_id: order.id,
           reason: `Retorno de cancelamento de expedição do pedido ${order.order_number || order.id}`
        }, order.company_id);
      }
      
      // 5. Restabelecer Itens e Pedido para a Situação em que precisam ser Separados Novamente
      for (const item of orderItems) {
        await base44.entities.SalesOrderItem.update(item.id, {
           qty_separated: 0
        });
      }

      await base44.entities.SalesOrder.update(order.id, { status: 'CONFIRMADO' });
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['orders-for-shipping', companyId] });
       setSelectedOrder(null);
       toast.success('Expedição cancelada');
     },
    onError: (error) => {
      toast.error('Erro ao cancelar expedição: ' + error.message);
    }
  });

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setShippingData({
      nf_number: order.nf_number || '',
      carrier: order.carrier || '',
      weight: order.weight || '',
      volume: order.volume || '',
      driver_name: order.driver_name || '',
      driver_cpf: order.driver_cpf || '',
      shipping_notes: order.shipping_notes || '',
      signed_nf_photo: order.signed_nf_photo || '',
      load_photos: Array.isArray(order.load_photos) ? order.load_photos : []
    });
  };

  const filteredOrders = orders?.filter(o =>
    o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.nf_number?.toLowerCase().includes(search.toLowerCase())
  );

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
            <CardHeader>
              <CardTitle>Pedidos Prontos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <QRScanner
                onScan={(code) => {
                  const order = orders?.find(
                    o => o.order_number === code || o.numero_pedido_externo === code
                  );
                  if (order) {
                    setSelectedOrder(order);
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
                  className="pl-10"
                />
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : filteredOrders?.length === 0 ? (
                <div className="text-center py-8">
                  <Truck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">Nenhum pedido pronto</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredOrders?.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => handleSelectOrder(order)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedOrder?.id === order.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <p className="font-mono text-sm text-indigo-600 font-medium">
                        {order.order_number || `#${order.id.slice(0, 8)}`}
                      </p>
                      <p className="text-sm text-slate-600">{order.client_name}</p>
                      {order.nf_number && (
                        <p className="text-xs text-slate-500">NF: {order.nf_number}</p>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <Badge className={`text-xs ${
                          order.status === 'EXPEDIDO' ? 'bg-emerald-100 text-emerald-700' :
                          order.status === 'FATURADO' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'SEPARADO' ? 'bg-purple-100 text-purple-700' :
                          order.status === 'SEPARANDO' ? 'bg-yellow-100 text-yellow-700' :
                          order.status === 'RESERVADO' ? 'bg-orange-100 text-orange-700' :
                          order.status === 'CONFIRMADO' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {order.status}
                        </Badge>
                        {order.delivery_date && (
                          <span className="text-xs text-slate-500">
                            {format(new Date(order.delivery_date), 'dd/MM', { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Items & Labels */}
        <div className="lg:col-span-2 space-y-4">
          {selectedOrder && (editingOrder || selectedOrder.status !== 'EXPEDIDO') && (
            <Card>
              <CardHeader>
                <CardTitle>Dados de Expedição</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">NF</label>
                    <Input
                      placeholder="Número da nota fiscal"
                      value={shippingData.nf_number}
                      onChange={(e) => setShippingData({...shippingData, nf_number: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Transportadora</label>
                    <Input
                      placeholder="Nome da transportadora"
                      value={shippingData.carrier}
                      onChange={(e) => setShippingData({...shippingData, carrier: e.target.value})}
                      className="mt-1"
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
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">CPF do Motorista</label>
                    <Input
                      placeholder="000.000.000-00"
                      value={shippingData.driver_cpf}
                      onChange={(e) => setShippingData({...shippingData, driver_cpf: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-slate-700">Observações de Expedição</label>
                    <textarea
                      placeholder="Alguma avaria ou instrução extra?"
                      value={shippingData.shipping_notes}
                      onChange={(e) => setShippingData({...shippingData, shipping_notes: e.target.value})}
                      className="w-full mt-1 min-h-20 text-sm p-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Foto NF Assinada */}
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                     <p className="text-sm font-bold text-slate-800 mb-2">Canhoto / NF Assinada</p>
                     {shippingData.signed_nf_photo ? (
                       <div className="relative aspect-video bg-black/5 rounded-md overflow-hidden mb-3 group">
                         <img src={shippingData.signed_nf_photo} className="w-full h-full object-cover" alt="NF Assinada" />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button size="icon" variant="destructive" onClick={() => setShippingData({...shippingData, signed_nf_photo: ''})}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                         </div>
                       </div>
                     ) : (
                       <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Camera className="w-8 h-8 text-slate-400 mb-2" />
                              <p className="text-sm text-slate-500 font-medium">Tirar foto</p>
                          </div>
                          <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => handleImageCapture(e, 'signed_nf_photo')} />
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

                     <label className="flex items-center justify-center w-full h-10 border border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors text-slate-600 font-medium text-sm gap-2">
                        <Upload className="w-4 h-4" />
                        Adicionar Foto
                        <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => handleImageCapture(e, 'load_photos')} />
                     </label>
                  </div>
                </div>
                <div className="flex gap-2">
                   <Button
                     onClick={() => updateShippingInfoMutation.mutate(selectedOrder)}
                     disabled={updateShippingInfoMutation.isPending}
                     className="bg-indigo-600 hover:bg-indigo-700"
                   >
                     Atualizar Dados
                   </Button>
                   {selectedOrder.status !== 'EXPEDIDO' && (
                       <Button
                         onClick={() => shipOrderMutation.mutate(selectedOrder)}
                         disabled={shipOrderMutation.isPending}
                         className="bg-emerald-600 hover:bg-emerald-700"
                       >
                         <Truck className="h-4 w-4 mr-2" />
                         Expedir Agora
                       </Button>
                   )}
                   {selectedOrder.status === 'EXPEDIDO' && (
                       <Button
                         onClick={() => cancelShippingMutation.mutate(selectedOrder)}
                         disabled={cancelShippingMutation.isPending}
                         variant="destructive"
                       >
                         <RotateCcw className="h-4 w-4 mr-2" />
                         Cancelar Expedição e Retornar Estoque
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
              </CardTitle>
              {selectedOrder?.status === 'EXPEDIDO' && !editingOrder && (
                <Button
                  onClick={() => setEditingOrder(true)}
                  className="bg-slate-600 hover:bg-slate-700"
                >
                  Editar Dados
                </Button>
              )}
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
      </div>
      );
      }