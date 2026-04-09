import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Search, MapPin, Package, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function StockLocator() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [transferDialog, setTransferDialog] = useState(false);
  const [transferForm, setTransferForm] = useState({
    from_balance_id: '',
    to_warehouse_id: '',
    to_location_id: '',
    qty: 0
  });

  const { data: searchResult, isLoading: isSearching } = useQuery({
    queryKey: ['products-search', companyId, searchTerm],
    queryFn: async () => {
      if (!companyId || searchTerm.length < 2) return { data: [], count: 0 };
      
      return base44.entities.Product.queryPaginated(
        { company_id: companyId, active: true },
        'sku',
        10,
        0,
        ['sku', 'name'],
        searchTerm
      );
    },
    enabled: !!companyId && searchTerm.length >= 2,
  });

  const searchedProducts = searchResult?.data || [];


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

  const { data: balances } = useQuery({
    queryKey: ['stock-balances', selectedProduct?.id, companyId],
    queryFn: async () => {
      if (!companyId || !selectedProduct) return [];
      
      console.log(`🔍 Buscando saldos - empresa: ${companyId}, produto: ${selectedProduct.sku}`);
      
      const allBalances = await base44.entities.StockBalance.filter({ 
        company_id: companyId,
        product_id: selectedProduct.id 
      });
      
      console.log(`📊 Encontrados ${allBalances.length} saldos:`, allBalances.map(b => ({
        id: b.id,
        company_id: b.company_id,
        qty: b.qty_available,
        warehouse: b.warehouse_id,
        location: b.location_id
      })));
      
      return allBalances;
    },
    enabled: !!selectedProduct && !!companyId,
  });

  const transferMutation = useMutation({
    mutationFn: async (data) => {
      const fromBalance = balances.find(b => b.id === data.from_balance_id);
      
      // Validar estoque
      if ((fromBalance.qty_available || 0) < data.qty) {
        throw new Error('Estoque insuficiente na localização de origem');
      }

      // Criar movimento de transferência
       await base44.entities.InventoryMove.create({
         company_id: companyId,
         type: 'TRANSFERENCIA',
         product_id: selectedProduct.id,
         qty: data.qty,
         from_warehouse_id: fromBalance.warehouse_id,
         from_location_id: fromBalance.location_id,
         to_warehouse_id: data.to_warehouse_id,
         to_location_id: data.to_location_id,
         reason: 'Transferência entre localizações via localizador'
       });

      // Atualizar saldo origem
      await base44.entities.StockBalance.update(fromBalance.id, {
        qty_available: fromBalance.qty_available - data.qty
      });

      // Atualizar ou criar saldo destino
      const toBalances = await base44.entities.StockBalance.filter({
        product_id: selectedProduct.id,
        warehouse_id: data.to_warehouse_id,
        location_id: data.to_location_id
      });

      if (toBalances.length > 0) {
        await base44.entities.StockBalance.update(toBalances[0].id, {
          qty_available: toBalances[0].qty_available + data.qty
        });
      } else {
         await base44.entities.StockBalance.create({
           company_id: companyId,
           product_id: selectedProduct.id,
           warehouse_id: data.to_warehouse_id,
           location_id: data.to_location_id,
           qty_available: data.qty,
           qty_reserved: 0,
           qty_separated: 0,
           avg_cost: fromBalance.avg_cost || 0
         });
       }

      // Auditoria
       const user = await base44.auth.me();
       await base44.entities.AuditLog.create({
         company_id: companyId,
         action: 'TRANSFERENCIA_LOCALIZACAO',
         entity_type: 'StockBalance',
         entity_id: fromBalance.id,
         new_data: JSON.stringify({
           product: selectedProduct.sku,
           qty: data.qty,
           from: `${warehouseMap[fromBalance.warehouse_id]?.code}/${locationMap[fromBalance.location_id]?.barcode}`,
           to: `${warehouseMap[data.to_warehouse_id]?.code}/${locationMap[data.to_location_id]?.barcode}`
         }),
         user_email: user.email
       });
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['stock-balances', selectedProduct?.id, companyId] });
       setTransferDialog(false);
       setTransferForm({ from_balance_id: '', to_warehouse_id: '', to_location_id: '', qty: 0 });
       toast.success('Transferência realizada com sucesso');
     },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const warehouseMap = warehouses?.reduce((acc, w) => ({ ...acc, [w.id]: w }), {}) || {};
  const locationMap = locations?.reduce((acc, l) => ({ ...acc, [l.id]: l }), {}) || {};

  const productsToShow = searchTerm.length >= 2 ? searchedProducts : [];


  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setSearchTerm('');
  };

  const handleTransferClick = (balance) => {
    setTransferForm({
      from_balance_id: balance.id,
      to_warehouse_id: '',
      to_location_id: '',
      qty: 0
    });
    setTransferDialog(true);
  };

  const handleTransferSubmit = (e) => {
    e.preventDefault();
    if (!transferForm.to_warehouse_id || !transferForm.to_location_id || transferForm.qty <= 0) {
      toast.error('Preencha todos os campos');
      return;
    }
    transferMutation.mutate(transferForm);
  };

  const selectedBalance = balances?.find(b => b.id === transferForm.from_balance_id);
  const toLocations = locations?.filter(l => l.warehouse_id === transferForm.to_warehouse_id);

  const totalQty = balances?.reduce((sum, b) => sum + (b.qty_available || 0), 0) || 0;
  const locationsCount = balances?.filter(b => b.qty_available > 0).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Localizador de Estoque</h1>
        <p className="text-slate-500">Consulte onde os produtos estão alocados e transfira entre localizações</p>
      </div>

      {/* Search Product */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar Produto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Digite o SKU ou nome do produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {isSearching && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          )}

          {searchTerm.length >= 2 && productsToShow.length > 0 && (
            <div className="border border-slate-200 rounded-lg divide-y">
              {productsToShow.map(product => (
                <button
                  key={product.id}
                  onClick={() => handleProductSelect(product)}
                  className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div>
                    <p className="font-mono text-sm text-indigo-600">{product.sku}</p>
                    <p className="font-medium text-slate-900">{product.name}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}

          {searchTerm.length >= 2 && !isSearching && productsToShow.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">Nenhum produto encontrado para "{searchTerm}"</p>
          )}

        </CardContent>
      </Card>

      {/* Selected Product Info */}
      {selectedProduct && (
        <>
          <Card className="bg-indigo-50 border-indigo-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-indigo-600 mb-1">Produto Selecionado</p>
                  <p className="font-mono text-lg font-bold text-indigo-900">{selectedProduct.sku}</p>
                  <p className="text-xl font-semibold text-slate-900">{selectedProduct.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600">Estoque Total</p>
                  <p className="text-3xl font-bold text-indigo-600">{totalQty}</p>
                  <p className="text-sm text-slate-500">{locationsCount} localização(ões)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stock Locations */}
          <Card>
            <CardHeader>
              <CardTitle>Alocações do Produto</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!balances || balances.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">Produto sem estoque</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Armazém</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead className="text-right">Reservado</TableHead>
                      <TableHead className="text-right">Separado</TableHead>
                      <TableHead className="text-right">Custo Médio</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balances.map((balance) => {
                      const warehouse = warehouseMap[balance.warehouse_id];
                      const location = locationMap[balance.location_id];
                      
                      return (
                        <TableRow key={balance.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{warehouse?.code}</p>
                              <p className="text-sm text-slate-500">{warehouse?.name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              <span className="font-mono text-sm">{location?.barcode || 'Sem localização'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={balance.qty_available > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                              {balance.qty_available || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-slate-500">
                            {balance.qty_reserved || 0}
                          </TableCell>
                          <TableCell className="text-right text-slate-500">
                            {balance.qty_separated || 0}
                          </TableCell>
                          <TableCell className="text-right text-slate-600">
                            R$ {(balance.avg_cost || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {balance.qty_available > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleTransferClick(balance)}
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Transfer Dialog */}
      <Dialog open={transferDialog} onOpenChange={setTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Entre Localizações</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            {selectedBalance && (
              <Alert>
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  <strong>Origem:</strong> {warehouseMap[selectedBalance.warehouse_id]?.code} / {locationMap[selectedBalance.location_id]?.barcode}
                  <br />
                  <strong>Disponível:</strong> {selectedBalance.qty_available}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                step="0.01"
                value={transferForm.qty}
                onChange={(e) => setTransferForm({ ...transferForm, qty: parseFloat(e.target.value) || 0 })}
                max={selectedBalance?.qty_available || 0}
              />
              {selectedBalance && transferForm.qty > selectedBalance.qty_available && (
                <p className="text-sm text-red-600">Quantidade excede o disponível</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Armazém de Destino *</Label>
              <Select value={transferForm.to_warehouse_id} onValueChange={(v) => setTransferForm({ ...transferForm, to_warehouse_id: v, to_location_id: '' })}>
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
              <Label>Localização de Destino *</Label>
              <Select value={transferForm.to_location_id} onValueChange={(v) => setTransferForm({ ...transferForm, to_location_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {toLocations?.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.barcode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferDialog(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={transferMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {transferMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Transferindo...
                  </>
                ) : (
                  'Confirmar Transferência'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}