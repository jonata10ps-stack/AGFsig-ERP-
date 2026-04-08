import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Package, TrendingUp, TrendingDown, Calendar, FileText, Printer, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
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
  ENTRADA:          { label: 'Entrada',            color: 'bg-emerald-100 text-emerald-700', icon: TrendingUp,   isLogical: false },
  SAIDA:            { label: 'Saída',              color: 'bg-red-100 text-red-700',      icon: TrendingDown, isLogical: false },
  TRANSFERENCIA:    { label: 'Transferência',      color: 'bg-blue-100 text-blue-700',     icon: TrendingUp,   isLogical: false },
  RESERVA:          { label: 'Reserva (Lógico)',   color: 'bg-amber-100 text-amber-700',   icon: Clock,        isLogical: true },
  SEPARACAO:        { label: 'Separação (Lógico)', color: 'bg-purple-100 text-purple-700', icon: Package,      isLogical: true },
  ALOCACAO:         { label: 'Alocação (Lógico)',  color: 'bg-indigo-100 text-indigo-700', icon: Package,      isLogical: true },
  ESTORNO_ALOCACAO: { label: 'Estorno Alocação',   color: 'bg-orange-100 text-orange-700', icon: FileText,     isLogical: true },
  PRODUCAO_ENTRADA: { label: 'Entrada Produção',   color: 'bg-emerald-100 text-emerald-700', icon: TrendingUp,   isLogical: false },
  PRODUCAO_CONSUMO: { label: 'Consumo Produção',   color: 'bg-red-100 text-red-700',      icon: TrendingDown, isLogical: false },
  PRODUCAO_REVERSO: { label: 'Estorno Produção',   color: 'bg-emerald-100 text-emerald-700', icon: TrendingUp,   isLogical: false },
  AJUSTE:           { label: 'Ajuste',             color: 'bg-slate-100 text-slate-700',   icon: FileText,     isLogical: false },
  BAIXA:            { label: 'Baixa',              color: 'bg-red-100 text-red-700',      icon: TrendingDown, isLogical: false },
  SALDO_INICIAL:    { label: 'Saldo Inicial (Fix)', color: 'bg-slate-200 text-slate-700',   icon: Package,      isLogical: false },
};

export default function Kardex() {
  const { companyId } = useCompanyId();
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeFilters, setActiveFilters] = useState({
    productId: null,
    startDate: '',
    endDate: ''
  });

  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ['product', activeFilters.productId],
    queryFn: () => activeFilters.productId ? base44.entities.Product.get(activeFilters.productId) : null,
    enabled: !!activeFilters.productId,
  });

  const [tablePage, setTablePage] = useState(0);
  const TABLE_PAGE_SIZE = 50;

  const { data: result, isLoading: loadingMovements } = useQuery({
    queryKey: ['inventory-moves', activeFilters.productId, activeFilters.startDate, activeFilters.endDate, companyId, tablePage],
    queryFn: async () => {
      if (!activeFilters.productId || !companyId) return { data: [], count: 0 };
      
      const filter = { 
        product_id: activeFilters.productId, 
        company_id: companyId 
      };

      if (activeFilters.startDate) {
        filter.created_at = { ...filter.created_at, gte: `${activeFilters.startDate}T00:00:00.000Z` };
      }
      if (activeFilters.endDate) {
        filter.created_at = { ...filter.created_at, lte: `${activeFilters.endDate}T23:59:59.999Z` };
      }
      
      return await base44.entities.InventoryMove.queryPaginated(
        filter, 
        '-created_at', 
        TABLE_PAGE_SIZE, 
        tablePage * TABLE_PAGE_SIZE
      );
    },
    enabled: !!activeFilters.productId && !!companyId,
  });

  // Carregar TODOS os movimentos do período (sem paginação) APENAS para calcular os totais corretos
  const { data: allMovesInPeriod = [] } = useQuery({
    queryKey: ['inventory-moves-all', activeFilters.productId, activeFilters.startDate, activeFilters.endDate, companyId],
    queryFn: async () => {
      if (!activeFilters.productId || !companyId) return [];
      const filter = { product_id: activeFilters.productId, company_id: companyId };
      if (activeFilters.startDate) filter.created_at = { ...filter.created_at, gte: `${activeFilters.startDate}T00:00:00.000Z` };
      if (activeFilters.endDate) filter.created_at = { ...filter.created_at, lte: `${activeFilters.endDate}T23:59:59.999Z` };
      return await base44.entities.InventoryMove.listAll(filter, '-created_at');
    },
    enabled: !!activeFilters.productId && !!companyId,
  });

  const movements = result?.data || [];
  const totalCount = result?.count || 0;

  const { data: currentBalances } = useQuery({
    queryKey: ['stock-balances', activeFilters.productId, companyId],
    queryFn: () => activeFilters.productId ? base44.entities.StockBalance.filter({ product_id: activeFilters.productId, company_id: companyId }) : [],
    enabled: !!activeFilters.productId && !!companyId,
  });

  const currentPhysicalTotal = currentBalances?.reduce((sum, b) => sum + (parseFloat(b.qty_available) || 0), 0) || 0;


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

  const totalTablePages = Math.ceil(totalCount / TABLE_PAGE_SIZE);

  // Calcular saldo acumulado - Versão paginada via cálculo 'reverso' a partir do saldo atual para a página
  const movementsWithBalance = React.useMemo(() => {
    if (!movements || movements.length === 0 || !currentPhysicalTotal) return [];

    let currentBalanceForPage = currentPhysicalTotal;
    
    // Simplificação: O saldo do Kardex deve ser acumulativo. 
    // Para um Kardex de período, o ideal é mostrar o saldo que o produto tinha naquele exato momento.
    return movements.map((m, i) => {
      const typeCfg = MOVEMENT_TYPES[m.type] || { isLogical: false };
      let impact = 0;
      const qty = parseFloat(m.qty) || 0;

      if (!typeCfg.isLogical) {
        if (m.to_warehouse_id && !m.from_warehouse_id) impact = qty;
        else if (m.from_warehouse_id && !m.to_warehouse_id) impact = -qty;
        else if (['ENTRADA', 'PRODUCAO_ENTRADA', 'PRODUCAO_REVERSO'].includes(m.type)) impact = qty;
        else if (['SAIDA', 'PRODUCAO_CONSUMO', 'BAIXA'].includes(m.type)) impact = -qty;
      }

      const bal = currentBalanceForPage;
      currentBalanceForPage -= impact;
      return { ...m, impact, balance: bal, prevBalance: bal - impact };
    });
  }, [movements, currentPhysicalTotal]);

  const handleSearch = () => {
    if (!selectedProductId) {
      return;
    }
    setTablePage(0);
    setActiveFilters({
      productId: selectedProductId,
      startDate,
      endDate
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const reconcileMutation = () => {
    if (!activeFilters.productId || !isDiscrepant) return;
    
    const diff = currentPhysicalTotal - calculatedBalance;
    const absDiff = Math.abs(diff);

    // Criar movimento de ajuste histórico SEM tocar no StockBalance (pois o DB já está correto)
    const moveData = {
      company_id: companyId,
      product_id: activeFilters.productId,
      type: 'SALDO_INICIAL',
      qty: String(absDiff),
      from_warehouse_id: diff < 0 ? (movements[0]?.from_warehouse_id || movements[0]?.to_warehouse_id) : null,
      to_warehouse_id: diff > 0 ? (movements[0]?.to_warehouse_id || movements[0]?.from_warehouse_id) : null,
      reason: 'Reconciliação Manual de Histórico (Ajuste de Auditoria)',
      notes: `Ajuste automático para igualar Kardex (${calculatedBalance}) ao Saldo Real (${currentPhysicalTotal}).`,
      created_date: new Date().toISOString()
    };

    base44.entities.InventoryMove.create(moveData)
      .then(() => {
        window.location.reload(); // Recarregar para ver o novo saldo
      });
  };


  const totalEntries = allMovesInPeriod?.reduce((sum, m) => 
    (['ENTRADA', 'PRODUCAO_ENTRADA', 'PRODUCAO_REVERSO', 'ESTORNO'].includes(m.type) || (m.type === 'AJUSTE' && !m.from_warehouse_id)) ? sum + (parseFloat(m.qty) || 0) : sum, 0
  ) || 0;

  const totalExits = allMovesInPeriod?.reduce((sum, m) => 
    (['SAIDA', 'PRODUCAO_CONSUMO', 'BAIXA'].includes(m.type) || (m.type === 'AJUSTE' && !m.to_warehouse_id)) ? sum + (parseFloat(m.qty) || 0) : sum, 0
  ) || 0;

  const calculatedBalance = movementsWithBalance.length > 0 ? movementsWithBalance[0].balance : 0;
  const isDiscrepant = activeFilters.productId ? Math.abs(calculatedBalance - currentPhysicalTotal) > 0.001 : false;

  return (
    <div className="space-y-6">
      {/* Alerta de Discrepância */}
      {activeFilters.productId && isDiscrepant && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-amber-100 p-2 rounded-full">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Divergência detectada no saldo total</p>
              <p className="text-xs text-amber-700">
                Saldo Calculado (Kardex): <strong>{calculatedBalance}</strong> | 
                Saldo em Banco (Atual): <strong>{currentPhysicalTotal}</strong>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-[10px] bg-amber-100 border-amber-300 hover:bg-amber-200 text-amber-900"
                  onClick={reconcileMutation}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Conciliar Saldos (Corrigir Histórico)
                </Button>
                <p className="text-[10px] text-amber-600">
                  *Isso criará um registro de "Saldo Inicial" para igualar as contas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
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
            <div className="flex items-end">
              <Button 
                onClick={handleSearch} 
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={!selectedProductId}
              >
                <Search className="h-4 w-4 mr-2" />
                Pesquisar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {activeFilters.productId && (
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
              <Card className={isDiscrepant ? "border-amber-200 bg-amber-50/30" : "border-emerald-100 bg-emerald-50/20"}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total Entradas</p>
                      <p className="text-2xl font-bold text-emerald-600">{totalEntries}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total Saídas</p>
                      <p className="text-2xl font-bold text-red-600">{totalExits}</p>
                    </div>
                    <div className="text-center border-x border-slate-100 px-4">
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Saldo Kardex</p>
                      <p className={`text-2xl font-black ${calculatedBalance >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                        {calculatedBalance}
                      </p>
                      <p className="text-[10px] text-slate-400">Calculado p/ Histórico</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Saldo em Banco</p>
                      <p className={`text-2xl font-black ${isDiscrepant ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {currentPhysicalTotal}
                      </p>
                      <p className="text-[10px] text-slate-400">Total Atual DB</p>
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
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-[120px]">Data e Hora</TableHead>
                          <TableHead>Operação</TableHead>
                          <TableHead className="text-right">Saldo Anterior</TableHead>
                          <TableHead className="text-center font-bold text-slate-900 italic">Movimento</TableHead>
                          <TableHead className="text-right bg-indigo-50/80 text-indigo-900 font-black border-x border-indigo-100">Saldo Atual</TableHead>
                          <TableHead>Origem / Destino</TableHead>
                          <TableHead>Referência</TableHead>
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
                              <TableRow key={move.id} className={`hover:bg-slate-50 transition-colors ${move.isLogical ? 'bg-amber-50/10' : ''}`}>
                                <TableCell className="whitespace-nowrap py-4">
                                  <div className="flex flex-col">
                                    <span className="font-black text-slate-800 text-sm">
                                      {(() => {
                                        const d = move.created_at || move.created_date || new Date();
                                        const dateObj = new Date(d);
                                        const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
                                        return format(validDate, 'dd/MM/yyyy', { locale: ptBR });
                                      })()}
                                    </span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Clock className="h-3 w-3 text-slate-400" />
                                      <span className="text-[11px] font-medium text-slate-500">
                                        {(() => {
                                          const d = move.created_at || move.created_date || new Date();
                                          const dateObj = new Date(d);
                                          const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
                                          return format(validDate, 'HH:mm:ss');
                                        })()}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <Badge className={`${moveType.color} border-none font-bold h-5 px-2 text-[10px]`}>
                                      <Icon className="h-3 w-3 mr-1" />
                                      {moveType.label}
                                    </Badge>
                                    {move.isLogical && (
                                      <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" title="Reserva (Lógico)" />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-medium text-slate-400 text-[11px]">
                                  {move.isLogical ? '-' : move.prevBalance}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex flex-col items-center">
                                    <span className={`text-base font-black px-2 py-1 rounded-md ${
                                      move.isLogical ? 'text-amber-500 bg-amber-50' :
                                      (['ENTRADA', 'PRODUCAO_ENTRADA', 'PRODUCAO_REVERSO', 'ESTORNO'].includes(move.type) || (move.type === 'AJUSTE' && !move.from_warehouse_id)) ? 'text-emerald-700 bg-emerald-50' : 
                                      move.type === 'TRANSFERENCIA' ? 'text-blue-700 bg-blue-50' : 'text-red-700 bg-red-50'
                                    }`}>
                                      {(['ENTRADA', 'PRODUCAO_ENTRADA', 'PRODUCAO_REVERSO', 'ESTORNO'].includes(move.type) || (move.type === 'AJUSTE' && !move.from_warehouse_id)) && !move.isLogical ? '+' : 
                                       (move.type === 'TRANSFERENCIA' || move.isLogical ? '' : '-')}
                                      {move.qty}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right bg-indigo-50/40 border-x border-indigo-100 px-4">
                                  <div className="flex flex-col items-end">
                                    <span className={`text-xl font-black ${move.isLogical ? 'text-slate-300' : 'text-indigo-950'}`}>
                                      {move.balance}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                      <div className="flex flex-col">
                                        <span className="font-bold text-slate-900 leading-none">
                                          {move.from_warehouse_id ? warehouseMap[move.from_warehouse_id]?.name : <span className="text-slate-300 font-normal italic">Sem Origem</span>}
                                        </span>
                                        {move.from_location_id && locationMap[move.from_location_id] && (
                                          <span className="text-[10px] text-indigo-600 font-mono mt-0.5">
                                            [{locationMap[move.from_location_id].barcode}]
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <TrendingDown className="h-3 w-3 text-slate-400" />
                                      <div className="flex flex-col">
                                        <span className="font-bold text-slate-900 leading-none">
                                          {move.to_warehouse_id ? warehouseMap[move.to_warehouse_id]?.name : <span className="text-slate-300 font-normal italic">Sem Destino</span>}
                                        </span>
                                        {move.to_location_id && locationMap[move.to_location_id] && (
                                          <span className="text-[10px] text-emerald-600 font-mono mt-0.5">
                                            [{locationMap[move.to_location_id].barcode}]
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs">
                                  <div className="flex flex-col">
                                    <span className="text-slate-900 font-bold uppercase text-[9px] tracking-tight">{move.related_type || 'OUTROS'}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {move.related_id ? `#${move.related_id.substring(0, 8)}` : '-'}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {totalTablePages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
                      <div className="text-sm text-slate-500">
                        Exibindo <span className="font-medium">{Math.min(totalCount, tablePage * TABLE_PAGE_SIZE + 1)}-{Math.min(totalCount, (tablePage + 1) * TABLE_PAGE_SIZE)}</span> de <span className="font-medium">{totalCount}</span> movimentações 
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
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}