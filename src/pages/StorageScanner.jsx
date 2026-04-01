import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  ArrowLeft, Package, MapPin, CheckCircle, AlertCircle, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import QRScanner from '../components/scanner/QRScanner';

export default function StorageScanner() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const batchId = urlParams.get('batch');

  const [scannedProduct, setScannedProduct] = useState(null);
  const [scannedLocation, setScannedLocation] = useState(null);
  const [manualSku, setManualSku] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  
  const isSecureContext = window.isSecureContext;

  const { data: batch } = useQuery({
    queryKey: ['receiving-batch', batchId],
    queryFn: () => base44.entities.ReceivingBatch.filter({ id: batchId }),
    select: (data) => data?.[0],
    enabled: !!batchId,
  });

  const { data: pendingItems } = useQuery({
    queryKey: ['receiving-items', batchId],
    queryFn: () => base44.entities.ReceivingItem.filter({ 
      batch_id: batchId,
      status: 'CONFERIDO' 
    }),
    enabled: !!batchId,
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ active: true }),
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.filter({ active: true }),
  });

  const storeMutation = useMutation({
    mutationFn: async ({ item, locationId }) => {
      // Create inventory move
      await base44.entities.InventoryMove.create({
        type: 'ENTRADA',
        product_id: item.product_id,
        qty: item.qty,
        to_warehouse_id: item.warehouse_id,
        to_location_id: locationId,
        related_type: 'COMPRA',
        related_id: batchId,
        reason: `Armazenagem - Lote ${batch?.batch_number}`,
        unit_cost: item.unit_cost
      });

      // Update stock balance
      const existingBalance = await base44.entities.StockBalance.filter({
        product_id: item.product_id,
        warehouse_id: item.warehouse_id,
        location_id: locationId
      });

      if (existingBalance.length > 0) {
        const balance = existingBalance[0];
        const newQty = (balance.qty_available || 0) + item.qty;
        const newAvgCost = ((balance.qty_available || 0) * (balance.avg_cost || 0) + item.qty * item.unit_cost) / newQty;
        await base44.entities.StockBalance.update(balance.id, {
          qty_available: newQty,
          avg_cost: newAvgCost
        });
      } else {
        await base44.entities.StockBalance.create({
          product_id: item.product_id,
          warehouse_id: item.warehouse_id,
          location_id: locationId,
          qty_available: item.qty,
          qty_reserved: 0,
          qty_separated: 0,
          avg_cost: item.unit_cost
        });
      }

      // Mark item as stored
      await base44.entities.ReceivingItem.update(item.id, { 
        status: 'ARMAZENADO',
        location_id: locationId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receiving-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
      setScannedProduct(null);
      setScannedLocation(null);
      toast.success('Item armazenado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao armazenar: ' + error.message);
    }
  });

  const handleProductScan = (code) => {
    const cleanCode = code?.trim()?.toUpperCase() || '';
    const product = products?.find(p => p.sku?.toUpperCase() === cleanCode);
    const item = pendingItems?.find(i => i.product_sku?.toUpperCase() === cleanCode);

    if (!item) {
      toast.error(`Produto "${code}" não encontrado neste recebimento`);
      return;
    }

    setScannedProduct({ product, item });
    toast.success(`Produto identificado: ${item.product_name}`);
  };

  const handleLocationScan = (code) => {
    const cleanCode = code?.trim()?.toUpperCase() || '';
    const location = locations?.find(l => l.barcode?.toUpperCase() === cleanCode);
    
    if (!location) {
      toast.error(`Localização "${code}" não encontrada`);
      return;
    }

    setScannedLocation(location);
    toast.success(`Localização: ${location.barcode}`);
  };

  const handleManualProductSubmit = () => {
    if (!manualSku) return;
    handleProductScan(manualSku.toUpperCase());
    setManualSku('');
  };

  const handleManualLocationSubmit = () => {
    if (!manualLocation) return;
    handleLocationScan(manualLocation.toUpperCase());
    setManualLocation('');
  };

  const handleStore = () => {
    if (!scannedProduct || !scannedLocation) {
      toast.error('Escaneie produto e localização');
      return;
    }

    storeMutation.mutate({
      item: scannedProduct.item,
      locationId: scannedLocation.id
    });
  };

  const completedCount = pendingItems?.filter(i => i.status === 'ARMAZENADO').length || 0;
  const totalCount = pendingItems?.length || 0;
  const allStored = completedCount === totalCount && totalCount > 0;

  return (
    <div className="space-y-6">
      {!isSecureContext && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 mb-1">Scanner de Câmera Indisponível</p>
                <p className="text-sm text-red-700 mb-2">
                  A câmera só funciona em apps publicados com HTTPS ativado por questões de segurança do navegador.
                </p>
                <p className="text-sm text-red-600 font-medium">
                  Solução: Vá em Configurações → Custom Domain e ative HTTPS, ou use entrada manual abaixo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl(`ReceivingConference?batch=${batchId}`)}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Armazenagem com Scanner</h1>
            <p className="text-slate-500">Lote: {batch?.batch_number}</p>
          </div>
        </div>
        <Badge className={allStored ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}>
          {completedCount} / {totalCount} armazenados
        </Badge>
      </div>

      {allStored && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-900">Armazenagem Concluída!</p>
              <p className="text-sm text-emerald-700">Todos os itens foram armazenados.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Scanner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              1. Escanear Produto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <QRScanner 
              onScan={handleProductScan}
              placeholder="Escaneie o QR code do produto"
              active={!scannedProduct}
            />
            
            <div className="space-y-2">
              <Label>Ou digite o SKU manualmente</Label>
              <div className="flex gap-2">
                <Input
                  value={manualSku}
                  onChange={(e) => setManualSku(e.target.value.toUpperCase())}
                  placeholder="SKU do produto"
                  onKeyPress={(e) => e.key === 'Enter' && handleManualProductSubmit()}
                />
                <Button onClick={handleManualProductSubmit}>OK</Button>
              </div>
            </div>

            {scannedProduct && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-lg font-bold text-emerald-700">
                      {scannedProduct.item.product_sku}
                    </p>
                    <p className="font-medium text-slate-900">{scannedProduct.item.product_name}</p>
                    <p className="text-sm text-slate-500 mt-1">Qtd: {scannedProduct.item.qty}</p>
                  </div>
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location Scanner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              2. Escanear Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <QRScanner 
              onScan={handleLocationScan}
              placeholder="Escaneie o QR code da localização"
              active={!!scannedProduct && !scannedLocation}
            />

            <div className="space-y-2">
              <Label>Ou digite o código manualmente</Label>
              <div className="flex gap-2">
                <Input
                  value={manualLocation}
                  onChange={(e) => setManualLocation(e.target.value.toUpperCase())}
                  placeholder="Código da localização"
                  onKeyPress={(e) => e.key === 'Enter' && handleManualLocationSubmit()}
                  disabled={!scannedProduct}
                />
                <Button onClick={handleManualLocationSubmit} disabled={!scannedProduct}>OK</Button>
              </div>
            </div>

            {scannedLocation && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-lg font-bold text-emerald-700">
                      {scannedLocation.barcode}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {scannedLocation.rua && `Rua: ${scannedLocation.rua}`}
                      {scannedLocation.modulo && ` / Módulo: ${scannedLocation.modulo}`}
                    </p>
                  </div>
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm Button */}
      {scannedProduct && scannedLocation && (
        <Card className="bg-indigo-50 border-indigo-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 mb-1">Pronto para armazenar</p>
                <p className="text-sm text-slate-600">
                  {scannedProduct.item.product_name} → {scannedLocation.barcode}
                </p>
              </div>
              <Button
                onClick={handleStore}
                disabled={storeMutation.isPending}
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {storeMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Armazenando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Confirmar Armazenagem
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items List */}
      <Card>
        <CardHeader>
          <CardTitle>Itens Pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {pendingItems?.map((item) => (
              <div 
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  item.status === 'ARMAZENADO' 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : 'bg-white border-slate-200'
                }`}
              >
                <div>
                  <p className="font-mono text-sm text-indigo-600">{item.product_sku}</p>
                  <p className="font-medium text-sm">{item.product_name}</p>
                </div>
                {item.status === 'ARMAZENADO' ? (
                  <Badge className="bg-emerald-100 text-emerald-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Armazenado
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700">
                    Pendente
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}