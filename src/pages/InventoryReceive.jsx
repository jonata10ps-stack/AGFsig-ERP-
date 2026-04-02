import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Package, Plus, Trash2, CheckCircle, QrCode, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';
import QRScanner from '@/components/scanner/QRScanner';

export default function InventoryReceive() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const requestId = urlParams.get('request');
  const [selectedRequestId, setSelectedRequestId] = useState(requestId || 'none');
  const lastPopulatedRequestId = React.useRef(null);
  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState({
    product_id: '',
    warehouse_id: '',
    location_id: '',
    qty: 1,
    unit_cost: 0
  });
  const [reason, setReason] = useState('');

  const { data: openRequests } = useQuery({
    queryKey: ['material-requests-open'],
    queryFn: () => base44.entities.MaterialRequest.filter({ status: ['ABERTA', 'PARCIAL'] }, '-created_date'),
  });

  const { data: materialRequest } = useQuery({
    queryKey: ['material-request', selectedRequestId],
    queryFn: () => base44.entities.MaterialRequest.filter({ id: selectedRequestId }).then(r => r?.[0]),
    enabled: !!selectedRequestId && selectedRequestId !== 'none',
  });

  const { data: requestItems } = useQuery({
    queryKey: ['material-request-items', selectedRequestId],
    queryFn: () => base44.entities.MaterialRequestItem.filter({ request_id: selectedRequestId }),
    enabled: !!selectedRequestId && selectedRequestId !== 'none',
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ active: true }),
  });

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', user?.company_id],
    queryFn: () => base44.entities.Warehouse.filter({ company_id: user?.company_id }),
    enabled: !!user?.company_id,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.filter({ active: true }),
  });

  const productMap = products?.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}) || {};
  const warehouseMap = warehouses?.reduce((acc, w) => ({ ...acc, [w.id]: w }), {}) || {};

  const filteredLocations = locations?.filter(l => !currentItem.warehouse_id || l.warehouse_id === currentItem.warehouse_id);

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (items.some(item => !item.warehouse_id || !item.location_id)) {
        throw new Error('Todos os itens devem ter um armazém e local de destino selecionado.');
      }

      const user = await base44.auth.me();
      const batchNumber = `REC-${Date.now().toString().slice(-8)}`;
      const totalValue = items.reduce((sum, item) => sum + (item.qty * item.unit_cost), 0);
      
      // Create receiving batch with status RECEBIDO
      const batch = await base44.entities.ReceivingBatch.create({
        company_id: user.company_id,
        batch_number: batchNumber,
        reason: requestId ? `Solicitação: ${materialRequest?.request_number}` : (reason || 'Recebimento de mercadoria'),
        total_value: totalValue,
        received_date: new Date().toISOString(),
        status: 'RECEBIDO'
      });

      // Create receiving items with status RECEBIDO
      const createdItems = [];
      for (const item of items) {
        const receivingItem = await base44.entities.ReceivingItem.create({
          company_id: user.company_id,
          batch_id: batch.id,
          product_id: item.product_id,
          product_sku: item.product_sku,
          product_name: item.product_name,
          qty: item.qty,
          unit_cost: item.unit_cost,
          warehouse_id: item.warehouse_id,
          warehouse_name: item.warehouse_name,
          location_barcode: item.location_barcode,
          status: 'RECEBIDO'
        });
        createdItems.push(receivingItem);
      }

      // Atualizar solicitação de materiais se vinculada
      const isLinked = selectedRequestId && selectedRequestId !== 'none';
      if (isLinked && requestItems) {
        for (const item of items) {
          const requestItem = requestItems.find(ri => ri.product_id === item.product_id);
          if (requestItem) {
            const newQtyReceived = (requestItem.qty_received || 0) + item.qty;
            const newQtyPending = Math.max(0, requestItem.qty_requested - newQtyReceived);

            await base44.entities.MaterialRequestItem.update(requestItem.id, {
              qty_received: newQtyReceived,
              qty_pending: newQtyPending
            });
          }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        const allItems = await base44.entities.MaterialRequestItem.filter({ request_id: selectedRequestId });

        const totalRequested = allItems.reduce((sum, ri) => sum + (ri.qty_requested || 0), 0);
        const totalReceived = allItems.reduce((sum, ri) => sum + (ri.qty_received || 0), 0);
        const allFulfilled = allItems.every(ri => (ri.qty_received || 0) >= (ri.qty_requested || 0));
        const anyReceived = totalReceived > 0;

        let newStatus = 'ABERTA';
        if (allFulfilled && totalRequested > 0) {
          newStatus = 'ATENDIDA';
        } else if (anyReceived) {
          newStatus = 'PARCIAL';
        }

        await base44.entities.MaterialRequest.update(selectedRequestId, {
          status: newStatus
        });
      }

      return batch.id;
    },
    onSuccess: (batchId) => {
      queryClient.invalidateQueries({ queryKey: ['receiving-batches', 'receiving-items-pending'] });
      setItems([]);
      setReason('');
      toast.success('Recebimento registrado com sucesso! Redirecionando para a conferência.');
      window.location.href = createPageUrl('ReceivingConferenceList');
    },
    onError: (error) => {
      toast.error('Erro ao processar recebimento: ' + error.message);
    }
  });

  const handleAddItem = () => {
    if (!currentItem.product_id || !currentItem.warehouse_id || !currentItem.location_id || currentItem.qty <= 0) {
      toast.error('Preencha os dados e local de destino');
      return;
    }

    // Se há solicitação vinculada, verificar se o produto está na solicitação
    if (selectedRequestId && requestItems) {
      const requestItem = requestItems.find(ri => ri.product_id === currentItem.product_id);
      if (!requestItem || (requestItem.qty_pending || 0) <= 0) {
        toast.error('Este produto não está na solicitação ou já foi totalmente recebido');
        return;
      }
    }

    const product = productMap[currentItem.product_id];
    const warehouse = warehouseMap[currentItem.warehouse_id];
    const location = locations?.find(l => l.id === currentItem.location_id);

    setItems([...items, {
      ...currentItem,
      product_sku: product?.sku,
      product_name: product?.name,
      warehouse_name: warehouse?.name,
      location_barcode: location?.barcode
    }]);

    setCurrentItem({
      product_id: '',
      warehouse_id: currentItem.warehouse_id,
      location_id: '',
      qty: 1,
      unit_cost: 0
    });
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleProductChange = (productId) => {
    const product = productMap[productId];
    const requestItem = requestItems?.find(ri => ri.product_id === productId);
    
    setCurrentItem({
      ...currentItem,
      product_id: productId,
      unit_cost: product?.cost_price || 0,
      qty: requestItem?.qty_pending || 1
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    
    if (field === 'warehouse_id') {
      const warehouse = warehouses?.find(w => w.id === value);
      item.warehouse_name = warehouse?.name || '';
      item.location_id = '';
      item.location_barcode = '';
    }
    
    if (field === 'location_id') {
      const location = locations?.find(l => l.id === value);
      item.location_barcode = location?.barcode || '';
    }
    
    newItems[index] = item;
    setItems(newItems);
  };

  // Pré-carregar itens da solicitação
  React.useEffect(() => {
    const isReady = requestItems && requestItems.length > 0 && selectedRequestId !== 'none';
    const isNewRequest = lastPopulatedRequestId.current !== selectedRequestId;

    if (isReady && isNewRequest) {
      const selectedIds = urlParams.get('items')?.split(',') || [];
      const pendingItems = requestItems.filter(ri => {
        const isPending = (ri.qty_pending ?? ri.qty_requested) > 0;
        if (selectedIds.length > 0 && selectedIds[0] !== '') {
          return isPending && selectedIds.includes(ri.id);
        }
        return isPending;
      });
      
      if (pendingItems.length > 0) {
        setItems(pendingItems.map(ri => ({
          id: ri.id, // ID original do item da solicitação
          product_id: ri.product_id,
          product_sku: ri.product_sku,
          product_name: ri.product_name,
          qty: ri.qty_pending ?? ri.qty_requested,
          pending_reference: ri.qty_pending ?? ri.qty_requested,
          unit_cost: 0, 
          warehouse_id: '', 
          warehouse_name: '',
          location_id: '',
          location_barcode: ''
        })));
        lastPopulatedRequestId.current = selectedRequestId;
      }
    }
  }, [requestItems, warehouses, selectedRequestId, urlParams]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const totalValue = items.reduce((sum, item) => sum + (item.qty * item.unit_cost), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recebimento de Mercadoria</h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-500">
              {materialRequest 
                ? `Vinculado à Solicitação: ${materialRequest.request_number}` 
                : 'Registre a entrada de produtos no estoque'}
            </p>
            {!requestId && (
              <Select value={selectedRequestId} onValueChange={(val) => {
                setSelectedRequestId(val);
                setItems([]); // Clear local items to reload from new request
              }}>
                <SelectTrigger className="w-[300px] h-8 text-xs bg-indigo-50 border-indigo-200">
                  <SelectValue placeholder="Vincular a uma solicitação aberta..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">(Nenhuma solicitação)</SelectItem>
                  {openRequests?.map(req => (
                    <SelectItem key={req.id} value={req.id}>
                      {req.request_number} - {req.description || 'Sem descrição'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <Link to={createPageUrl('ReceivingList')}>
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Ver Recebimentos
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Adicionar Item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <QRScanner
                onScan={(code) => {
                  const cleanCode = code?.trim()?.toUpperCase() || '';
                  const product = products?.find(p => p.sku?.toUpperCase() === cleanCode);
                  if (product) {
                    handleProductChange(product.id);
                    toast.success(`Produto ${product.sku} selecionado`);
                  } else {
                    toast.error(`Produto "${code}" não encontrado`);
                  }
                }}
                placeholder="Escaneie o produto"
              />
              <ProductSearchSelect
                label="Ou busque manualmente"
                value={currentItem.product_id}
                onSelect={handleProductChange}
                placeholder={(selectedRequestId && selectedRequestId !== 'none') ? "Buscar produto da solicitação..." : "Buscar por código ou descrição..."}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Armazém *</Label>
              <Select 
                value={currentItem.warehouse_id} 
                onValueChange={(v) => setCurrentItem({ ...currentItem, warehouse_id: v, location_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {warehouses?.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.code} - {w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Localização</Label>
              <QRScanner
                onScan={(code) => {
                  const cleanCode = code?.trim()?.toUpperCase() || '';
                  const location = filteredLocations?.find(l => l.barcode?.toUpperCase() === cleanCode);
                  if (location) {
                    setCurrentItem({ ...currentItem, location_id: location.id });
                    toast.success(`Localização ${location.barcode} selecionada`);
                  } else {
                    toast.error(`Localização "${code}" não encontrada`);
                  }
                }}
                placeholder="Escaneie a localização"
                active={!!currentItem.warehouse_id}
              />
              <Select 
                value={currentItem.location_id} 
                onValueChange={(v) => setCurrentItem({ ...currentItem, location_id: v })}
                disabled={!currentItem.warehouse_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ou selecione manualmente" />
                </SelectTrigger>
                <SelectContent>
                  {filteredLocations?.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.barcode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={currentItem.qty}
                  onChange={(e) => setCurrentItem({ ...currentItem, qty: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Custo Unit.</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentItem.unit_cost}
                  onChange={(e) => setCurrentItem({ ...currentItem, unit_cost: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <Button onClick={handleAddItem} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar à Lista
            </Button>
          </CardContent>
        </Card>

        {/* Items List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Itens para Recebimento</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">Adicione itens para receber</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto / Ref</TableHead>
                    <TableHead>Armazém</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead className="text-right">Qtd Rec.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const rowLocations = locations?.filter(l => l.warehouse_id === item.warehouse_id);
                    return (
                      <TableRow key={index} className={(!item.warehouse_id || !item.location_id) ? 'bg-amber-50/30' : ''}>
                        <TableCell>
                          <div>
                            <span className="font-mono text-indigo-600 text-xs">{item.product_sku}</span>
                            <p className="font-medium text-xs truncate max-w-[200px]">{item.product_name}</p>
                            {item.pending_reference && (
                              <p className="text-[10px] text-slate-400 mt-0.5">Saldo na Sol.: {item.pending_reference}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="w-[180px]">
                          <Select 
                            value={item.warehouse_id} 
                            onValueChange={(val) => updateItem(index, 'warehouse_id', val)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Armazém..." />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses?.map(w => (
                                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="w-[180px]">
                          <Select 
                            value={item.location_id} 
                            onValueChange={(val) => updateItem(index, 'location_id', val)}
                            disabled={!item.warehouse_id}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder={item.warehouse_id ? "Local..." : "---"} />
                            </SelectTrigger>
                            <SelectContent>
                              {rowLocations?.map(l => (
                                <SelectItem key={l.id} value={l.id}>{l.barcode} ({l.name})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="w-24">
                          <Input
                            type="number"
                            value={item.qty}
                            onChange={(e) => updateItem(index, 'qty', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs text-right font-medium"
                          />
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {formatCurrency(item.unit_cost * item.qty)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(index)}
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {items.length > 0 && (
            <CardFooter className="flex-col space-y-4 border-t pt-4">
              <div className="w-full space-y-2">
                <Label>Motivo/Observação</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Nota Fiscal 12345, Compra fornecedor XYZ"
                  rows={2}
                />
              </div>
              
              <Separator />
              
              <div className="w-full flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total do Recebimento</p>
                  <p className="text-2xl font-bold text-indigo-600">{formatCurrency(totalValue)}</p>
                </div>
                <Button 
                  onClick={() => receiveMutation.mutate()}
                  disabled={receiveMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {receiveMutation.isPending ? (
                    'Processando...'
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirmar Recebimento
                    </>
                  )}
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}