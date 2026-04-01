import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Package, TrendingUp, TrendingDown, Calendar, FileText, Printer } from 'lucide-react';
import { useCompanyId } from '@/components/useCompanyId';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MOVEMENT_TYPES = {
  ENTRADA: { label: 'Entrada', color: 'bg-emerald-100 text-emerald-700', icon: TrendingUp },
  SAIDA: { label: 'Saída', color: 'bg-red-100 text-red-700', icon: TrendingDown },
  TRANSFERENCIA: { label: 'Transferência', color: 'bg-blue-100 text-blue-700', icon: TrendingUp },
  RESERVA: { label: 'Reserva', color: 'bg-amber-100 text-amber-700', icon: TrendingDown },
  SEPARACAO: { label: 'Separação', color: 'bg-purple-100 text-purple-700', icon: TrendingDown },
  PRODUCAO_ENTRADA: { label: 'Produção (Entrada)', color: 'bg-emerald-100 text-emerald-700', icon: TrendingUp },
  PRODUCAO_CONSUMO: { label: 'Produção (Consumo)', color: 'bg-red-100 text-red-700', icon: TrendingDown },
  AJUSTE: { label: 'Ajuste', color: 'bg-slate-100 text-slate-700', icon: FileText },
  BAIXA: { label: 'Baixa', color: 'bg-red-100 text-red-700', icon: TrendingDown },
};

export default function Kardex() {
  const { companyId } = useCompanyId();
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ['product', selectedProductId],
    queryFn: () => selectedProductId ? base44.entities.Product.filter({ id: selectedProductId }).then(r => r[0]) : null,
    enabled: !!selectedProductId,
  });

  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: ['inventory-moves', selectedProductId, startDate, endDate, companyId],
    queryFn: async () => {
      if (!selectedProductId || !companyId) return [];
      
      const filter = { product_id: selectedProductId, company_id: companyId };
      const moves = await base44.entities.InventoryMove.filter(filter, '-created_date', 1000);
      
      let filtered = moves;
      if (startDate) {
        filtered = filtered.filter(m => new Date(m.created_date) >= new Date(startDate));
      }
      if (endDate) {
        filtered = filtered.filter(m => new Date(m.created_date) <= new Date(endDate + 'T23:59:59'));
      }
      
      return filtered;
    },
    enabled: !!selectedProductId && !!companyId,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => base44.entities.Warehouse.list(),
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
  });

  const warehouseMap = warehouses?.reduce((acc, wh) => ({ ...acc, [wh.id]: wh }), {}) || {};
  const locationMap = locations?.reduce((acc, loc) => ({ ...acc, [loc.id]: loc }), {}) || {};

  // Calcular saldo acumulado - ordenar do mais antigo para o mais novo
  const movementsWithBalance = React.useMemo(() => {
    if (!movements || movements.length === 0) return [];

    const sorted = [...movements].sort((a, b) => 
      new Date(a.created_date) - new Date(b.created_date)
    );

    let balance = 0;
    return sorted.map(move => {
      const isEntry = ['ENTRADA', 'PRODUCAO_ENTRADA'].includes(move.type);
      const isTransfer = move.type === 'TRANSFERENCIA';
      const isAjuste = move.type === 'AJUSTE';
      const qty = move.qty || 0;

      if (isEntry) {
        balance += qty;
      } else if (isAjuste) {
        if (move.from_warehouse_id) {
          balance -= qty;
        } else {
          balance += qty;
        }
      } else if (!isTransfer) {
        balance -= qty;
      }

      return {
        ...move,
        balance
      };
    }).reverse(); // Retornar em ordem decrescente (mais novo primeiro)
  }, [movements]);

  const handlePrint = () => {
    window.print();
  };

  const totalEntries = movements?.reduce((sum, m) => 
    ['ENTRADA', 'PRODUCAO_ENTRADA'].includes(m.type) ? sum + (m.qty || 0) : sum, 0
  ) || 0;

  const totalExits = movements?.reduce((sum, m) => 
    !['ENTRADA', 'PRODUCAO_ENTRADA', 'TRANSFERENCIA'].includes(m.type) ? sum + (m.qty || 0) : sum, 0
  ) || 0;

  const finalBalance = movementsWithBalance.length > 0 ? movementsWithBalance[0].balance : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kardex</h1>
          <p className="text-slate-500">Histórico de movimentações por produto</p>
        </div>
        {selectedProductId && (
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Produto</label>
              <ProductSearchSelect 
                value={selectedProductId} 
                onSelect={setSelectedProductId} 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                <Calendar className="h-4 w-4 inline mr-1" />
                De
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                <Calendar className="h-4 w-4 inline mr-1" />
                Até
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedProductId && (
        <>
          {loadingProduct ? (
            <Skeleton className="h-32" />
          ) : product && (
            <Card className="bg-gradient-to-r from-indigo-50 to-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{product.name}</p>
                    <p className="text-slate-600">SKU: {product.sku}</p>
                    <p className="text-sm text-slate-500 mt-2">Categoria: {product.category}</p>
                  </div>
                  <Package className="h-8 w-8 text-indigo-600" />
                </div>
              </CardContent>
            </Card>
          )}

          {loadingMovements ? (
            <div className="space-y-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Total Entradas</p>
                      <p className="text-2xl font-bold text-emerald-600">{totalEntries}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Total Saídas</p>
                      <p className="text-2xl font-bold text-red-600">{totalExits}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Saldo Final</p>
                      <p className={`text-2xl font-bold ${finalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {finalBalance}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Movimentações</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Documento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movementsWithBalance.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan="8" className="text-center py-8 text-slate-500">
                              Nenhuma movimentação encontrada
                            </TableCell>
                          </TableRow>
                        ) : (
                          movementsWithBalance.map((move) => {
                            const moveType = MOVEMENT_TYPES[move.type] || MOVEMENT_TYPES.AJUSTE;
                            const Icon = moveType.icon;

                            return (
                              <TableRow key={move.id} className="hover:bg-slate-50">
                                <TableCell className="text-sm">
                                  {move.created_date ? format(new Date(move.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                                </TableCell>
                                <TableCell>
                                  <Badge className={moveType.color}>
                                    <Icon className="h-3 w-3 mr-1" />
                                    {moveType.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {move.from_warehouse_id ? `${warehouseMap[move.from_warehouse_id]?.name}` : '-'}
                                  {move.from_location_id && ` / ${locationMap[move.from_location_id]?.barcode}`}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {move.to_warehouse_id ? `${warehouseMap[move.to_warehouse_id]?.name}` : '-'}
                                  {move.to_location_id && ` / ${locationMap[move.to_location_id]?.barcode}`}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {['ENTRADA', 'PRODUCAO_ENTRADA'].includes(move.type) || 
                                   (move.type === 'AJUSTE' && !move.from_warehouse_id) ? (
                                    <span className="text-emerald-600">+{move.qty}</span>
                                  ) : (
                                    <span className="text-red-600">-{move.qty}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-bold">
                                  {move.balance}
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">
                                  {move.reason || '-'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {move.related_type && `${move.related_type}`}
                                  {move.related_id && ` #${move.related_id.substring(0, 8)}`}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}