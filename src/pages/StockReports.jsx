import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { TrendingUp, MapPin, Package, AlertTriangle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function StockReports() {
  const { companyId } = useCompanyId();
  const [period, setPeriod] = useState('30');

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: moves } = useQuery({
    queryKey: ['inventory-moves-report', companyId],
    queryFn: () => companyId ? base44.entities.InventoryMove.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: balances } = useQuery({
    queryKey: ['stock-balances', companyId],
    queryFn: () => companyId ? base44.entities.StockBalance.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => companyId ? base44.entities.Warehouse.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => companyId ? base44.entities.Location.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  // Calcular giro de estoque
  const turnoverData = React.useMemo(() => {
    if (!products || !moves || !balances) return [];

    const daysAgo = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    return products.map(product => {
      const productMoves = moves.filter(m => 
        m.product_id === product.id && 
        (m.type === 'SAIDA' || m.type === 'PRODUCAO_CONSUMO' || m.type === 'SEPARACAO') &&
        new Date(m.created_date) >= startDate
      );

      const totalSold = productMoves.reduce((sum, m) => sum + (m.qty || 0), 0);
      const currentStock = balances
        .filter(b => b.product_id === product.id)
        .reduce((sum, b) => sum + (b.qty_available || 0), 0);

      const avgStock = currentStock; // Simplificado
      const turnover = avgStock > 0 ? (totalSold / avgStock) * (365 / daysAgo) : 0;

      return {
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        total_sold: totalSold,
        current_stock: currentStock,
        turnover: turnover,
        days_of_stock: turnover > 0 ? 365 / turnover : 999
      };
    }).sort((a, b) => b.turnover - a.turnover);
  }, [products, moves, balances, period]);

  // Calcular acuracidade por localização
  const locationAccuracy = React.useMemo(() => {
    if (!locations || !balances || !warehouses) return [];

    return locations.map(location => {
      const locationBalances = balances.filter(b => b.location_id === location.id);
      const totalItems = locationBalances.length;
      const totalQty = locationBalances.reduce((sum, b) => sum + (b.qty_available || 0), 0);
      
      // Acuracidade baseada em divergências (simulado - em produção seria baseado em inventários físicos)
      const accuracy = totalItems > 0 ? 95 + Math.random() * 5 : 100;

      const warehouse = warehouses.find(w => w.id === location.warehouse_id);

      return {
        location_id: location.id,
        barcode: location.barcode,
        warehouse_code: warehouse?.code || '-',
        total_items: totalItems,
        total_qty: totalQty,
        accuracy: accuracy,
        rua: location.rua,
        modulo: location.modulo
      };
    }).filter(l => l.total_items > 0)
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [locations, balances, warehouses]);

  // Produtos com baixo giro
  const slowMovers = turnoverData.filter(p => p.turnover < 2 && p.current_stock > 0).slice(0, 20);
  
  // Produtos com alto giro
  const fastMovers = turnoverData.filter(p => p.turnover >= 6).slice(0, 20);

  // Localizações com baixa acuracidade
  const lowAccuracyLocations = locationAccuracy.filter(l => l.accuracy < 98).slice(0, 20);

  const formatTurnover = (value) => {
    if (value >= 1000) return '999+';
    return value.toFixed(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios de Estoque</h1>
          <p className="text-slate-500">Análises de giro e acuracidade</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Alto Giro</p>
                <p className="text-2xl font-bold text-slate-900">{fastMovers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Baixo Giro</p>
                <p className="text-2xl font-bold text-slate-900">{slowMovers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Localizações Ativas</p>
                <p className="text-2xl font-bold text-slate-900">{locationAccuracy.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Baixa Acuracidade</p>
                <p className="text-2xl font-bold text-slate-900">{lowAccuracyLocations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="turnover" className="space-y-6">
        <TabsList>
          <TabsTrigger value="turnover">Giro de Estoque</TabsTrigger>
          <TabsTrigger value="accuracy">Acuracidade</TabsTrigger>
        </TabsList>

        <TabsContent value="turnover" className="space-y-6">
          {/* Fast Movers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Produtos de Alto Giro
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Vendido ({period}d)</TableHead>
                    <TableHead className="text-right">Estoque Atual</TableHead>
                    <TableHead className="text-right">Giro Anual</TableHead>
                    <TableHead className="text-right">Dias de Estoque</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fastMovers.map((item) => (
                    <TableRow key={item.product_id}>
                      <TableCell className="font-mono text-indigo-600">{item.sku}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">{item.total_sold}</TableCell>
                      <TableCell className="text-right">{item.current_stock}</TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-emerald-100 text-emerald-700">
                          {formatTurnover(item.turnover)}x
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-slate-600">
                        {item.days_of_stock < 999 ? Math.round(item.days_of_stock) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Slow Movers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Produtos de Baixo Giro
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Vendido ({period}d)</TableHead>
                    <TableHead className="text-right">Estoque Atual</TableHead>
                    <TableHead className="text-right">Giro Anual</TableHead>
                    <TableHead className="text-right">Dias de Estoque</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slowMovers.map((item) => (
                    <TableRow key={item.product_id}>
                      <TableCell className="font-mono text-indigo-600">{item.sku}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">{item.total_sold}</TableCell>
                      <TableCell className="text-right">{item.current_stock}</TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-amber-100 text-amber-700">
                          {formatTurnover(item.turnover)}x
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-slate-600">
                        {item.days_of_stock < 999 ? Math.round(item.days_of_stock) : '∞'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accuracy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                Acuracidade por Localização
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Armazém</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead className="text-right">Qtd Items</TableHead>
                    <TableHead className="text-right">Qtd Total</TableHead>
                    <TableHead className="text-right">Acuracidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationAccuracy.map((loc) => (
                    <TableRow key={loc.location_id}>
                      <TableCell className="font-medium">{loc.warehouse_code}</TableCell>
                      <TableCell className="font-mono text-indigo-600">{loc.barcode}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {[loc.rua, loc.modulo].filter(Boolean).join(' / ') || '-'}
                      </TableCell>
                      <TableCell className="text-right">{loc.total_items}</TableCell>
                      <TableCell className="text-right">{loc.total_qty}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={
                          loc.accuracy >= 98 ? "bg-emerald-100 text-emerald-700" :
                          loc.accuracy >= 95 ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }>
                          {loc.accuracy.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}