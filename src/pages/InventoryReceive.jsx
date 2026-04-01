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
  
  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState({
    product_id: '',
    warehouse_id: '',
    location_id: '',
    qty: 1,
    unit_cost: 0
  });
  const [reason, setReason] = useState('');

  const { data: materialRequest } = useQuery({
    queryKey: ['material-request', requestId],
    queryFn: () => base44.entities.MaterialRequest.filter({ id: requestId }).then(r => r?.[0]),
    enabled: !!requestId,
  });

  const { data: requestItems } = useQuery({
    queryKey: ['material-request-items', requestId],
    queryFn: () => base44.entities.MaterialRequestItem.filter({ request_id: requestId }),
    enabled: !!requestId,
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
      if (requestId && requestItems) {
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
        const allItems = await base44.entities.MaterialRequestItem.filter({ request_id: requestId });

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

        await base44.entities.MaterialRequest.update(requestId, {
          status: newStatus
        });
      }

      return batch.id;
    },
    onSuccess: (batchId) => {
      queryClient.invalidateQueries({ queryKey: ['receiving-batches', 'receiving-items-pending'] });
      setItems([]);
      setReason('');
      toast.success('Recebimento registrado com sucesso! Agora faça a alocação no armazém.');
      window.location.href = createPageUrl('StorageAllocation');
    },
    onError: (error) => {
      toast.error('Erro ao processar recebimento: ' + error.message);
    }
  });

  const handleAddItem = () => {
    if (!currentItem.product_id || !currentItem.warehouse_id || currentItem.qty <= 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Se há solicitação vinculada, verificar se o produto está na solicitação
    if (requestId && requestItems) {
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

  // Pré-carregar itens da solicitação
  React.useEffect(() => {
    if (requestItems && items.length === 0) {
      const pendingItems = requestItems.filter(ri => (ri.qty_pending || 0) > 0);
      if (pendingItems.length > 0) {
        toast.info(`${pendingItems.length} item(ns) pendente(s) da solicitação`);
      }
    }
  }, [requestItems]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const totalValue = items.reduce((sum, item) => sum + (item.qty * item.unit_cost), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recebimento de Mercadoria</h1>
          <p className="text-slate-500">
            {materialRequest 
              ? `Vinculado à Solicitação: ${materialRequest.request_number}` 
              : 'Registre a entrada de produtos no estoque'}
          </p>
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
                placeholder={requestId ? "Buscar produto da solicitação..." : "Buscar por código ou descrição..."}
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
                    <TableHead>Produto</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <span className="font-mono text-indigo-600 text-sm">{item.product_sku}</span>
                          <p className="font-medium text-sm">{item.product_name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {item.warehouse_name}
                        {item.location_barcode && ` / ${item.location_barcode}`}
                      </TableCell>
                      <TableCell className="text-right font-medium">{item.qty}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.qty * item.unit_cost)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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