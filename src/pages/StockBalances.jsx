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
  const [tablePage, setTablePage] = useState(0);
  const TABLE_PAGE_SIZE = 50;

  const { data: result, isLoading } = useQuery({
    queryKey: ['stock-balances', companyId, tablePage, search, filterWarehouse, filterStatus],
    queryFn: async () => {
      if (!companyId) return { data: [], count: 0 };
      
      const conditions = { company_id: companyId };
      if (filterWarehouse !== 'all') {
        conditions.warehouse_id = filterWarehouse;
      }

      if (search.trim()) {
        const matchedProducts = await base44.entities.Product.queryPaginated(
          { company_id: companyId },
          'sku',
          200, 
          0,
          ['sku', 'name'],
          search
        );
        const matchingIds = matchedProducts.data.map(p => p.id);
        if (matchingIds.length > 0) {
          conditions.product_id = matchingIds;
        } else {
          return { data: [], count: 0 };
        }
      }

      // Filter status logic is harder on server without denormalization
      // For now, we'll fetch paginated and the status will be shown per record
      return base44.entities.StockBalance.queryPaginated(
        conditions, 
        'id', 
        TABLE_PAGE_SIZE, 
        tablePage * TABLE_PAGE_SIZE
      );
    },
    enabled: !!companyId,
  });

  const balances = result?.data || [];
  const totalCount = result?.count || 0;

  const productIds = Array.from(new Set(balances.map(b => b.product_id).filter(Boolean)));
  const warehouseIds = Array.from(new Set(balances.map(b => b.warehouse_id).filter(Boolean)));
  const locationIds = Array.from(new Set(balances.map(b => b.location_id).filter(Boolean)));

  const { data: products } = useQuery({
    queryKey: ['products-by-ids', companyId, productIds.sort().join(',')],
    queryFn: async () => {
      if (!companyId || productIds.length === 0) return [];
      const results = await Promise.all(productIds.map(id => base44.entities.Product.filter({ id, company_id: companyId }).then(r => r[0])));
      return results.filter(Boolean);
    },
    enabled: !!companyId && productIds.length > 0,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-by-ids', companyId, warehouseIds.sort().join(',')],
    queryFn: async () => {
      if (!companyId || warehouseIds.length === 0) return [];
      const results = await Promise.all(warehouseIds.map(id => base44.entities.Warehouse.filter({ id, company_id: companyId }).then(r => r[0])));
      return results.filter(Boolean);
    },
    enabled: !!companyId && warehouseIds.length > 0,
  });

  // Fetch ALL warehouses for the filter dropdown
  const { data: allWarehouses } = useQuery({
    queryKey: ['warehouses-all', companyId],
    queryFn: () => companyId ? base44.entities.Warehouse.listAll({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations-by-ids', companyId, locationIds.sort().join(',')],
    queryFn: async () => {
      if (!companyId || locationIds.length === 0) return [];
      const results = await Promise.all(locationIds.map(id => base44.entities.Location.filter({ id, company_id: companyId }).then(r => r[0])));
      return results.filter(Boolean);
    },
    enabled: !!companyId && locationIds.length > 0,
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

  const totalTablePages = Math.ceil(totalCount / TABLE_PAGE_SIZE);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setTablePage(0);
  };

  const handleWarehouseChange = (val) => {
    setFilterWarehouse(val);
    setTablePage(0);
  };

  const handleStatusChange = (val) => {
    setFilterStatus(val);
    setTablePage(0);
  };

  // Summary stats (now limited to the visible set or approximated)
  const totalItems = totalCount;
  // NOTE: critical/low items are now approximated based on the visible page for UI responsiveness
  // In a production environment with server support, these would be separate aggregate queries.
  const criticalItems = balances.filter(b => getStockStatus(b, productMap[b.product_id]).status === 'critical').length;
  const lowItems = balances.filter(b => getStockStatus(b, productMap[b.product_id]).status === 'low').length;

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
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
            <Select value={filterWarehouse} onValueChange={handleWarehouseChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Armazém" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os armazéns</SelectItem>
                {allWarehouses?.map(wh => (
                  <SelectItem key={wh.id} value={wh.id}>{wh.code} - {wh.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={handleStatusChange}>
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
          ) : totalCount === 0 ? (
            <div className="text-center py-12">
              <Boxes className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum saldo encontrado</p>
            </div>
          ) : (
            <>
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
                    {balances.map((balance) => {
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
              {totalTablePages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
                  <div className="text-sm text-slate-500">
                    Exibindo <span className="font-medium">{Math.min(totalCount, tablePage * TABLE_PAGE_SIZE + 1)}-{Math.min(totalCount, (tablePage + 1) * TABLE_PAGE_SIZE)}</span> de <span className="font-medium">{totalCount}</span> saldos 
                    {totalCount > 0 && ` · Pág. ${tablePage + 1}/${totalTablePages}`}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setTablePage(p => Math.max(0, p - 1))} disabled={tablePage === 0}>
                      ← Anterior
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setTablePage(p => Math.min(totalTablePages - 1, p + 1))} disabled={tablePage >= totalTablePages - 1}>
                      Próxima →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}