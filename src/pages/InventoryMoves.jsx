import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Search, ArrowRight, ArrowLeft, Package, Filter, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_CONFIG = {
  ENTRADA: { color: 'bg-emerald-100 text-emerald-700', icon: ArrowRight },
  SAIDA: { color: 'bg-rose-100 text-rose-700', icon: ArrowLeft },
  TRANSFERENCIA: { color: 'bg-blue-100 text-blue-700', icon: ArrowRight },
  RESERVA: { color: 'bg-indigo-100 text-indigo-700', icon: Package },
  SEPARACAO: { color: 'bg-amber-100 text-amber-700', icon: Package },
  PRODUCAO_ENTRADA: { color: 'bg-emerald-100 text-emerald-700', icon: ArrowRight },
  PRODUCAO_CONSUMO: { color: 'bg-rose-100 text-rose-700', icon: ArrowLeft },
  AJUSTE: { color: 'bg-purple-100 text-purple-700', icon: Package },
};

export default function InventoryMoves() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const { data: moves, isLoading } = useQuery({
    queryKey: ['inventory-moves', companyId],
    queryFn: () => companyId ? base44.entities.InventoryMove.listAll({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  // Extrai IDs únicos de produtos das movimentações já carregadas
  const productIds = moves ? [...new Set(moves.map(m => m.product_id).filter(Boolean))] : [];

  const { data: products } = useQuery({
    queryKey: ['products-by-ids', companyId, productIds.sort().join(',')],
    queryFn: async () => {
      if (!companyId || productIds.length === 0) return [];
      // Busca em lotes de 100 IDs por vez
      const BATCH = 100;
      let all = [];
      for (let i = 0; i < productIds.length; i += BATCH) {
        const batch = productIds.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(id => base44.entities.Product.filter({ id, company_id: companyId }, 'sku', 1, 0)));
        all = all.concat(results.flat());
      }
      return all;
    },
    enabled: !!companyId && productIds.length > 0,
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

  const productMap = products?.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}) || {};
  const warehouseMap = warehouses?.reduce((acc, w) => ({ ...acc, [w.id]: w }), {}) || {};
  const locationMap = locations?.reduce((acc, l) => ({ ...acc, [l.id]: l }), {}) || {};

  const filtered = moves?.filter(m => {
    const product = productMap[m.product_id];
    const matchesSearch = product?.name?.toLowerCase().includes(search.toLowerCase()) ||
      product?.sku?.toLowerCase().includes(search.toLowerCase()) ||
      m.reason?.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || m.type === filterType;
    return matchesSearch && matchesType;
  });

  const formatLocation = (warehouseId, locationId) => {
    const wh = warehouseMap[warehouseId];
    const loc = locationMap[locationId];
    if (wh && loc) return `${wh.code} / ${loc.barcode}`;
    if (wh) return wh.code;
    return '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Movimentações de Estoque</h1>
          <p className="text-slate-500">Histórico de todas as movimentações</p>
        </div>
        <Link to={createPageUrl('CreateInventoryMove')}>
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            Nova Movimentação
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por produto ou motivo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.keys(TYPE_CONFIG).map(type => (
                  <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
              <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhuma movimentação encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((move) => {
                    const product = productMap[move.product_id];
                    const typeConfig = TYPE_CONFIG[move.type] || { color: 'bg-slate-100 text-slate-700' };
                    
                    return (
                      <TableRow key={move.id}>
                        <TableCell className="text-slate-500 whitespace-nowrap">
                          {move.created_date ? format(new Date(move.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={typeConfig.color}>
                            {move.type?.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-mono text-indigo-600 text-sm">{product?.sku}</span>
                            <p className="font-medium text-sm">{product?.name || 'Produto não encontrado'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={move.type?.includes('SAIDA') || move.type?.includes('CONSUMO') ? 'text-rose-600' : 'text-emerald-600'}>
                            {move.type?.includes('SAIDA') || move.type?.includes('CONSUMO') ? '-' : '+'}
                            {move.qty}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {formatLocation(move.from_warehouse_id, move.from_location_id)}
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {formatLocation(move.to_warehouse_id, move.to_location_id)}
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm max-w-xs truncate">
                          {move.reason || '-'}
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