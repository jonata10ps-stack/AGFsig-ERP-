import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AlertTriangle, CheckCircle, RefreshCw, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export default function StockConsistencyCheck() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const [inconsistencies, setInconsistencies] = useState([]);

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.filter({ company_id: companyId }) : [],
    enabled: !!companyId,
  });

  const { data: stockBalances } = useQuery({
    queryKey: ['stock-balances', companyId],
    queryFn: () => companyId ? base44.entities.StockBalance.filter({ company_id: companyId }) : [],
    enabled: !!companyId,
  });

  const { data: inventoryMoves } = useQuery({
    queryKey: ['inventory-moves', companyId],
    queryFn: () => companyId ? base44.entities.InventoryMove.filter({ company_id: companyId }) : [],
    enabled: !!companyId,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => companyId ? base44.entities.Warehouse.filter({ company_id: companyId }) : [],
    enabled: !!companyId,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => companyId ? base44.entities.Location.filter({ company_id: companyId }) : [],
    enabled: !!companyId,
  });

  const checkConsistency = () => {
    if (!products || !stockBalances || !inventoryMoves) {
      toast.error('Dados não carregados');
      return;
    }

    setChecking(true);
    const found = [];

    // Agrupar saldos por produto (somando todas as localizações)
    const balanceMap = {};
    stockBalances.forEach(sb => {
      const key = sb.product_id;
      if (!balanceMap[key]) {
        balanceMap[key] = {
          product_id: sb.product_id,
          system_qty: sb.qty_available || 0
        };
      } else {
        balanceMap[key].system_qty += (sb.qty_available || 0);
      }
    });

    // Calcular saldo real do Kardex por produto (somando todas as localizações)
    const kardexMap = {};
    inventoryMoves.forEach(move => {
      const key = move.product_id;
      if (!kardexMap[key]) {
        kardexMap[key] = {
          product_id: move.product_id,
          kardex_qty: 0
        };
      }

      // Tipos que AUMENTAM o estoque total
      if (['ENTRADA', 'PRODUCAO_ENTRADA', 'PRODUCAO_REVERSO', 'ESTORNO'].includes(move.type)) {
        kardexMap[key].kardex_qty += move.qty;
      }
      
      // Tipos que DIMINUEM o estoque total
      else if (['SAIDA', 'PRODUCAO_CONSUMO', 'BAIXA'].includes(move.type)) {
        kardexMap[key].kardex_qty -= move.qty;
      }

      // AJUSTE: verifica se é entrada (to) ou saída (from)
      if (move.type === 'AJUSTE') {
        if (move.to_warehouse_id && !move.from_warehouse_id) {
          // Ajuste de entrada
          kardexMap[key].kardex_qty += move.qty;
        } else if (move.from_warehouse_id && !move.to_warehouse_id) {
          // Ajuste de saída
          kardexMap[key].kardex_qty -= move.qty;
        }
      }

      // TRANSFERÊNCIA: não altera o total do produto (só move entre locais)
      // RESERVA e SEPARAÇÃO não alteram qty_available (só mudam reserved/separated)
    });

    // Comparar balanceMap com kardexMap
    const allKeys = new Set([...Object.keys(balanceMap), ...Object.keys(kardexMap)]);
    
    allKeys.forEach(key => {
      const balance = balanceMap[key];
      const kardex = kardexMap[key];

      const systemQty = balance?.system_qty || 0;
      const kardexQty = kardex?.kardex_qty || 0;
      const difference = systemQty - kardexQty;

      if (Math.abs(difference) > 0.001) { // Tolerância para erros de arredondamento
        const product = products.find(p => p.id === key);

        found.push({
          key,
          product,
          system_qty: systemQty,
          kardex_qty: kardexQty,
          difference: difference
        });
      }
    });

    setInconsistencies(found);
    setChecking(false);
    
    if (found.length === 0) {
      toast.success('Nenhuma inconsistência encontrada!');
    } else {
      toast.warning(`${found.length} inconsistência(s) encontrada(s)`);
    }
  };



  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Verificação de Consistência</h1>
          <p className="text-slate-500 mt-1">Saldos de Estoque vs Kardex</p>
        </div>
        <Button
          onClick={checkConsistency}
          disabled={checking || !products || !stockBalances || !inventoryMoves}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {checking ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar Consistência
            </>
          )}
        </Button>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Esta ferramenta compara os saldos registrados no sistema (StockBalance) com o saldo calculado 
          a partir do Kardex (InventoryMove). Divergências indicam inconsistências que devem ser corrigidas.
        </AlertDescription>
      </Alert>

      {inconsistencies.length === 0 && !checking ? (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
            <p className="text-lg font-semibold text-emerald-900">
              Clique em "Verificar Consistência" para analisar os dados
            </p>
            <p className="text-sm text-emerald-700 mt-1">
              O sistema comparará os saldos com o Kardex
            </p>
          </CardContent>
        </Card>
      ) : null}

      {checking && (
        <Card>
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {!checking && inconsistencies.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {inconsistencies.length} Inconsistência(s) Encontrada(s)
                </h2>
                <p className="text-sm text-slate-500">Divergências entre Saldo e Kardex</p>
              </div>
            </div>

          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalhes das Inconsistências</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Saldo Total Sistema</TableHead>
                    <TableHead className="text-right">Saldo Total Kardex</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inconsistencies.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div>
                          <p className="font-mono text-xs text-indigo-600">{item.product?.sku}</p>
                          <p className="font-medium text-sm">{item.product?.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-mono">
                          {item.system_qty.toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-blue-100 text-blue-700 font-mono">
                          {item.kardex_qty.toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.difference > 0 ? (
                            <TrendingUp className="h-4 w-4 text-red-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-orange-500" />
                          )}
                          <Badge className={item.difference > 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}>
                            {item.difference > 0 ? '+' : ''}{item.difference.toFixed(2)}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {!checking && inconsistencies.length === 0 && checking === false && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
            <p className="text-lg font-semibold text-emerald-900">
              Tudo certo! Nenhuma inconsistência encontrada
            </p>
            <p className="text-sm text-emerald-700 mt-1">
              Os saldos estão alinhados com o Kardex
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}