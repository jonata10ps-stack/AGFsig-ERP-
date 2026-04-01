import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function ProductionSyncFix() {
  const queryClient = useQueryClient();
  const [fixConfirm, setFixConfirm] = useState(null);

  const { data: ops, isLoading } = useQuery({
    queryKey: ['production-orders-all'],
    queryFn: () => base44.entities.ProductionOrder.list('-created_date'),
  });

  const { data: stockBalances } = useQuery({
    queryKey: ['stock-balances'],
    queryFn: () => base44.entities.StockBalance.list(),
  });

  const { data: inventoryMoves } = useQuery({
    queryKey: ['inventory-moves'],
    queryFn: () => base44.entities.InventoryMove.list('-created_date'),
  });

  // Identificar OPs que tiveram produção mas saldo não foi alimentado
  const discrepancies = ops?.filter(op => {
    if (!op.qty_produced || op.qty_produced === 0) return false;
    
    // Verificar se há InventoryMove de PRODUCAO_ENTRADA
    const hasMove = inventoryMoves?.some(m => 
      m.type === 'PRODUCAO_ENTRADA' && m.related_id === op.id
    );

    if (!hasMove) return false;

    // Verificar se o StockBalance foi atualizado
    const totalProducedQty = inventoryMoves
      ?.filter(m => m.type === 'PRODUCAO_ENTRADA' && m.related_id === op.id)
      ?.reduce((sum, m) => sum + (m.qty || 0), 0) || 0;

    const balance = stockBalances?.find(b => b.product_id === op.product_id);
    const balanceQty = (balance?.qty_available || 0);

    // Se a quantidade no saldo é menor que a quantidade produzida, há discrepância
    return balanceQty < totalProducedQty;
  }) || [];

  const fixMutation = useMutation({
   mutationFn: async (op) => {
     // Calcular total produzido
     const totalProduced = inventoryMoves
       ?.filter(m => m.type === 'PRODUCAO_ENTRADA' && m.related_id === op.id)
       ?.reduce((sum, m) => sum + (m.qty || 0), 0) || 0;

     // Buscar armazém de produção
     const warehouses = await base44.entities.Warehouse.filter({ type: 'PRODUCAO' });
     const productionWarehouse = warehouses?.[0];

     if (!productionWarehouse) {
       throw new Error('Armazém de produção não configurado');
     }

     // Buscar ou criar StockBalance
     const existingBalances = await base44.entities.StockBalance.filter({ 
       product_id: op.product_id,
       warehouse_id: productionWarehouse.id
     });

     if (existingBalances && existingBalances.length > 0) {
       const balance = existingBalances[0];
       const newQty = totalProduced;

       await base44.entities.StockBalance.update(balance.id, {
         qty_available: newQty
       });
     } else {
       await base44.entities.StockBalance.create({
         product_id: op.product_id,
         warehouse_id: productionWarehouse.id,
         qty_available: totalProduced,
         qty_reserved: 0,
         qty_separated: 0
       });
     }
   },
   onSuccess: () => {
     queryClient.invalidateQueries({ queryKey: ['production-orders-all'] });
     queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
     setFixConfirm(null);
     toast.success('Saldo corrigido com sucesso');
   },
   onError: (error) => {
     toast.error('Erro ao corrigir saldo: ' + error.message);
   }
  });

  const fixAllMutation = useMutation({
    mutationFn: async () => {
      // Buscar armazém de produção uma vez
      const warehouses = await base44.entities.Warehouse.filter({ type: 'PRODUCAO' });
      const productionWarehouse = warehouses?.[0];
      
      if (!productionWarehouse) {
        throw new Error('Armazém de produção não configurado');
      }

      for (const op of discrepancies) {
        const totalProduced = inventoryMoves
          ?.filter(m => m.type === 'PRODUCAO_ENTRADA' && m.related_id === op.id)
          ?.reduce((sum, m) => sum + (m.qty || 0), 0) || 0;

        const existingBalances = await base44.entities.StockBalance.filter({ 
          product_id: op.product_id,
          warehouse_id: productionWarehouse.id
        });

        if (existingBalances && existingBalances.length > 0) {
          const balance = existingBalances[0];
          const newQty = totalProduced;
          await base44.entities.StockBalance.update(balance.id, {
            qty_available: newQty
          });
        } else {
          await base44.entities.StockBalance.create({
            product_id: op.product_id,
            warehouse_id: productionWarehouse.id,
            qty_available: totalProduced,
            qty_reserved: 0,
            qty_separated: 0
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-orders-all'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
      toast.success(`${discrepancies.length} saldo(s) corrigido(s)`);
    },
    onError: (error) => {
      toast.error('Erro ao corrigir saldos: ' + error.message);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Dashboard')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sincronização de Saldos</h1>
          <p className="text-slate-500">Corrija OPs com produção mas sem saldo alimentado</p>
        </div>
      </div>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-900">Discrepâncias Encontradas</p>
            <p className="text-sm text-amber-700 mt-1">
              {isLoading ? 'Carregando...' : `${discrepancies.length} OP(s) com saldo não atualizado`}
            </p>
          </div>
        </CardContent>
      </Card>

      {discrepancies.length > 0 && (
        <Button 
          onClick={() => fixAllMutation.mutate()} 
          className="bg-emerald-600 hover:bg-emerald-700"
          disabled={fixAllMutation.isPending}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {fixAllMutation.isPending ? 'Corrigindo...' : 'Corrigir Todos'}
        </Button>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : discrepancies.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-300 mb-4" />
              <p className="text-slate-500">Todos os saldos estão sincronizados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>OP</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd Produzida</TableHead>
                    <TableHead className="text-right">Qtd no Saldo</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discrepancies.map((op) => {
                    const totalProduced = inventoryMoves
                      ?.filter(m => m.type === 'PRODUCAO_ENTRADA' && m.related_id === op.id)
                      ?.reduce((sum, m) => sum + (m.qty || 0), 0) || 0;
                    
                    const balance = stockBalances?.find(b => b.product_id === op.product_id);
                    const balanceQty = balance?.qty_available || 0;
                    const diff = totalProduced - balanceQty;

                    return (
                      <TableRow key={op.id}>
                        <TableCell className="font-mono font-medium">{op.op_number}</TableCell>
                        <TableCell>{op.product_name}</TableCell>
                        <TableCell className="text-right font-medium">{totalProduced}</TableCell>
                        <TableCell className="text-right text-slate-600">{balanceQty}</TableCell>
                        <TableCell className="text-right font-bold text-red-600">+{diff}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => setFixConfirm(op)}
                            disabled={fixMutation.isPending}
                          >
                            Corrigir
                          </Button>
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

      <Dialog open={!!fixConfirm} onOpenChange={() => setFixConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Corrigir Saldo</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja corrigir o saldo para a OP <strong>{fixConfirm?.op_number}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFixConfirm(null)}>Cancelar</Button>
            <Button onClick={() => fixMutation.mutate(fixConfirm)} disabled={fixMutation.isPending}>
              {fixMutation.isPending ? 'Corrigindo...' : 'Corrigir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}