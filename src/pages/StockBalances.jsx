import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Search, Package, Boxes, AlertTriangle, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

export default function StockBalances() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: balances, isLoading } = useQuery({
    queryKey: ['stock-balances', companyId],
    queryFn: () => companyId ? base44.entities.StockBalance.listAll({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.listAll({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => companyId ? base44.entities.Warehouse.listAll({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => companyId ? base44.entities.Location.listAll({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const productMap = products?.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}) || {};
  const warehouseMap = warehouses?.reduce((acc, w) => ({ ...acc, [w.id]: w }), {}) || {};
  const locationMap = locations?.reduce((acc, l) => ({ ...acc, [l.id]: l }), {}) || {};

  const getStockStatus = (balance, product) => {
    const total = (balance.qty_available || 0) + (balance.qty_reserved || 0);
    if (total <= 0) return { status: 'critical', label: 'Zerado', color: 'bg-rose-100 text-rose-700' };
    if (product?.min_stock && total <= product.min_stock) return { status: 'low', label: 'Baixo', color: 'bg-amber-100 text-amber-700' };
    if (product?.max_stock && total >= product.max_stock) return { status: 'high', label: 'Excesso', color: 'bg-blue-100 text-blue-700' };
    return { status: 'normal', label: 'Normal', color: 'bg-emerald-100 text-emerald-700' };
  };

  const filtered = balances?.filter(b => {
    const product = productMap[b.product_id];
    const matchesSearch = product?.name?.toLowerCase().includes(search.toLowerCase()) ||
      product?.sku?.toLowerCase().includes(search.toLowerCase());
    const matchesWarehouse = filterWarehouse === 'all' || b.warehouse_id === filterWarehouse;
    
    if (filterStatus === 'all') return matchesSearch && matchesWarehouse;
    const stockStatus = getStockStatus(b, product);
    return matchesSearch && matchesWarehouse && stockStatus.status === filterStatus;
  });

  // Summary stats
  const totalItems = balances?.length || 0;
  const criticalItems = balances?.filter(b => getStockStatus(b, productMap[b.product_id]).status === 'critical').length || 0;
  const lowItems = balances?.filter(b => getStockStatus(b, productMap[b.product_id]).status === 'low').length || 0;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Saldos de Estoque</h1>
        <p className="text-slate-500">Visualize os saldos por produto e localização</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100">
                <Boxes className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total de Itens</p>
                <p className="text-2xl font-bold">{totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-100">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Estoque Zerado</p>
                <p className="text-2xl font-bold text-rose-600">{criticalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Estoque Baixo</p>
                <p className="text-2xl font-bold text-amber-600">{lowItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Armazém" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os armazéns</SelectItem>
                {warehouses?.map(wh => (
                  <SelectItem key={wh.id} value={wh.id}>{wh.code} - {wh.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="critical">Zerado</SelectItem>
                <SelectItem value="low">Baixo</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Excesso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <Boxes className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum saldo encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Armazém</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead className="text-right">Disponível</TableHead>
                    <TableHead className="text-right">Reservado</TableHead>
                    <TableHead className="text-right">Separado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Custo Médio</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((balance) => {
                    const product = productMap[balance.product_id];
                    const warehouse = warehouseMap[balance.warehouse_id];
                    const location = locationMap[balance.location_id];
                    const stockStatus = getStockStatus(balance, product);
                    const total = (balance.qty_available || 0) + (balance.qty_reserved || 0) + (balance.qty_separated || 0);
                    
                    return (
                      <TableRow key={balance.id}>
                        <TableCell>
                          <div>
                            <span className="font-mono text-indigo-600 text-sm">{product?.sku}</span>
                            <p className="font-medium">{product?.name || 'Produto não encontrado'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{warehouse?.name || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{location?.barcode || '-'}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          {balance.qty_available || 0}
                        </TableCell>
                        <TableCell className="text-right text-indigo-600">
                          {balance.qty_reserved || 0}
                        </TableCell>
                        <TableCell className="text-right text-amber-600">
                          {balance.qty_separated || 0}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {total}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(balance.avg_cost)}
                        </TableCell>
                        <TableCell>
                          <Badge className={stockStatus.color}>
                            {stockStatus.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}