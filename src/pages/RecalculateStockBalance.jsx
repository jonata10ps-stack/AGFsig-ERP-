import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { useCompanyId } from '@/components/useCompanyId';

export default function RecalculateStockBalance() {
  const queryClient = useQueryClient();
  const [confirmRecalc, setConfirmRecalc] = useState(false);
  const { companyId } = useCompanyId();

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('recalculateStockBalances', { company_id: companyId });
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro desconhecido');
      return response.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
      setConfirmRecalc(false);
      toast.success(`Saldos recalculados: ${result.balances_deleted} deletados, ${result.balances_created} criados de ${result.moves_processed} movimentações`);
    },
    onError: (error) => {
      toast.error('Erro ao recalcular: ' + error.message);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('DataManagement')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recalcular Saldos</h1>
          <p className="text-slate-500">Refazer saldos baseado em todas as movimentações de estoque</p>
        </div>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-blue-900">O que será feito</p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc ml-4">
              <li>Todos os saldos atuais serão deletados</li>
              <li>Recalculados do zero a partir de todas as movimentações históricas</li>
              <li>Processa: Entradas, Saídas, Transferências, Baixas, Produção, Ajustes</li>
            </ul>
            <p className="text-sm font-medium text-red-700 mt-3">⚠️ Esta operação não pode ser desfeita!</p>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => setConfirmRecalc(true)}
        className="bg-indigo-600 hover:bg-indigo-700"
        disabled={recalculateMutation.isPending}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
        {recalculateMutation.isPending ? 'Recalculando...' : 'Recalcular Agora'}
      </Button>

      <Dialog open={confirmRecalc} onOpenChange={setConfirmRecalc}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Recálculo de Saldos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Todos os saldos atuais serão deletados e recriados com base no histórico de movimentações.
            Isso corrige inconsistências entre Saldos, Localizador e Kardex.
          </p>
          <p className="text-sm font-medium text-red-600 mt-2">⚠️ Esta operação não pode ser desfeita!</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRecalc(false)}>Cancelar</Button>
            <Button
              onClick={() => recalculateMutation.mutate()}
              disabled={recalculateMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {recalculateMutation.isPending ? 'Recalculando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}