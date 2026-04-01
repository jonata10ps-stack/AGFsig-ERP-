import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { AlertTriangle, Trash2, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function ReverseInventoryMoves() {
  const { companyId } = useCompanyId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Fetch inventory moves from today
  const { data: movesToday = [], isLoading } = useQuery({
    queryKey: ['inventory-moves-today', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const allMoves = await base44.entities.InventoryMove.filter({
        company_id: companyId
      });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      return allMoves.filter(move => {
        const moveDate = new Date(move.created_date);
        return moveDate >= today && moveDate < tomorrow;
      });
    },
    enabled: !!companyId
  });

  const reverseMovesMutation = useMutation({
    mutationFn: async () => {
      console.log('=== INICIANDO REVERSÃO DE MOVIMENTAÇÕES ===');
      console.log('Total de movimentações:', movesToday.length);

      for (const move of movesToday) {
        console.log(`\nReversando movimento: ${move.id}`);
        
        // Reverter saldo de estoque
        if (move.type === 'ENTRADA') {
          // Entrada: reduzir qty_available
          if (move.to_location_id) {
            const balance = await base44.entities.StockBalance.filter({
              company_id: companyId,
              product_id: move.product_id,
              location_id: move.to_location_id
            });
            
            if (balance && balance[0]) {
              const newQty = Math.max(0, balance[0].qty_available - move.qty);
              await base44.entities.StockBalance.update(balance[0].id, {
                qty_available: newQty
              });
              console.log(`Saldo reduzido: ${balance[0].qty_available} - ${move.qty} = ${newQty}`);
            }
          }
        } else if (move.type === 'SAIDA') {
          // Saída: aumentar qty_available
          if (move.from_location_id) {
            const balance = await base44.entities.StockBalance.filter({
              company_id: companyId,
              product_id: move.product_id,
              location_id: move.from_location_id
            });
            
            if (balance && balance[0]) {
              const newQty = balance[0].qty_available + move.qty;
              await base44.entities.StockBalance.update(balance[0].id, {
                qty_available: newQty
              });
              console.log(`Saldo aumentado: ${balance[0].qty_available} + ${move.qty} = ${newQty}`);
            }
          }
        } else if (move.type === 'TRANSFERENCIA') {
          // Transferência: devolver origem e tirar destino
          if (move.from_location_id) {
            const fromBalance = await base44.entities.StockBalance.filter({
              company_id: companyId,
              product_id: move.product_id,
              location_id: move.from_location_id
            });
            
            if (fromBalance && fromBalance[0]) {
              const newQty = fromBalance[0].qty_available + move.qty;
              await base44.entities.StockBalance.update(fromBalance[0].id, {
                qty_available: newQty
              });
            }
          }
          
          if (move.to_location_id) {
            const toBalance = await base44.entities.StockBalance.filter({
              company_id: companyId,
              product_id: move.product_id,
              location_id: move.to_location_id
            });
            
            if (toBalance && toBalance[0]) {
              const newQty = Math.max(0, toBalance[0].qty_available - move.qty);
              await base44.entities.StockBalance.update(toBalance[0].id, {
                qty_available: newQty
              });
            }
          }
        } else if (move.type === 'AJUSTE') {
          // Ajuste: reverter a divergência
          if (move.qty_divergence !== undefined) {
            const balanceLocation = move.from_location_id || move.to_location_id;
            if (balanceLocation) {
              const balance = await base44.entities.StockBalance.filter({
                company_id: companyId,
                product_id: move.product_id,
                location_id: balanceLocation
              });
              
              if (balance && balance[0]) {
                const newQty = balance[0].qty_available - move.qty;
                await base44.entities.StockBalance.update(balance[0].id, {
                  qty_available: newQty
                });
              }
            }
          }
        }

        // Deletar movimento
        await base44.entities.InventoryMove.delete(move.id);
        console.log(`Movimento ${move.id} deletado`);
      }

      console.log('=== REVERSÃO CONCLUÍDA ===');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-moves-today', companyId] });
      queryClient.invalidateQueries({ queryKey: ['stock-balances', companyId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-moves'] });
      setShowConfirmDialog(false);
      toast.success('Todas as movimentações de hoje foram revertidas!');
      setTimeout(() => navigate(-1), 1000);
    },
    onError: (error) => {
      toast.error('Erro ao reverter: ' + error.message);
    }
  });

  if (isLoading) {
    return <Skeleton className="w-full h-96" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold text-slate-900">Reverter Movimentações</h1>
      </div>

      {movesToday.length === 0 ? (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="pt-6">
            <p className="text-center text-emerald-700">Nenhuma movimentação de inventário encontrada para hoje.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900">Atenção!</AlertTitle>
            <AlertDescription className="text-amber-800">
              Você está prestes a deletar {movesToday.length} movimentação(ões) e reverter os saldos de estoque para os armazéns.
              Esta ação é irreversível.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Movimentações de Hoje ({movesToday.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Horário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movesToday.map((move) => (
                      <TableRow key={move.id}>
                        <TableCell>
                          <Badge variant="outline">{move.type}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{move.product_id}</TableCell>
                        <TableCell>{move.qty}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {move.from_location_id || move.from_warehouse_id || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {move.to_location_id || move.to_warehouse_id || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 max-w-xs truncate">
                          {move.reason || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {format(new Date(move.created_date), 'HH:mm:ss', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={() => setShowConfirmDialog(true)}
            className="w-full bg-red-600 hover:bg-red-700"
            disabled={reverseMovesMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Reverter Todas as Movimentações
          </Button>
        </>
      )}

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Confirmar Reversão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja deletar {movesToday.length} movimentação(ões) e reverter os saldos?
              <br />
              <span className="font-bold text-red-600 mt-2 block">Esta ação NÃO pode ser desfeita.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => reverseMovesMutation.mutate()}
              disabled={reverseMovesMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {reverseMovesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Revertendo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Confirmar Deleção
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}