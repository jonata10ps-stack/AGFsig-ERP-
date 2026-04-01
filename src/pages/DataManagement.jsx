import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const ENTITIES_TO_DELETE = [
  'Product', 'Client', 'Seller', 'SalesOrder', 'SalesOrderItem',
  'ProductionOrder', 'ProductionRequest', 'ProductionStep',
  'SerialNumber', 'ServiceRequest', 'ServiceOrder',
  'MaterialRequest', 'MaterialRequestItem',
  'InventoryMove', 'InventoryCount', 'InventoryCountItem',
  'Warehouse', 'Location', 'Resource',
  'ProductionRoute', 'ProductionRouteStep', 'BOMItem',
  'Reservation', 'ReceivingBatch', 'ReceivingItem',
  'StockBalance', 'MaterialConsumption', 'CostCenter',
  'AuditLog'
];

export default function DataManagement() {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState(0);

  const clearDataMutation = useMutation({
    mutationFn: async () => {
      for (const entity of ENTITIES_TO_DELETE) {
        try {
          const records = await base44.entities[entity].list('', 1000);
          for (const record of records) {
            await base44.entities[entity].delete(record.id);
          }
        } catch (error) {
          console.log(`Entidade ${entity} não encontrada ou já vazia`);
        }
      }
      return true;
    },
    onSuccess: () => {
      toast.success('Todos os dados de negócio foram deletados com sucesso');
      setShowConfirmDialog(false);
      setConfirmText('');
      setStep(0);
    },
    onError: (error) => {
      toast.error('Erro ao limpar dados: ' + error.message);
    },
  });

  const handleStartClear = () => {
    setShowConfirmDialog(true);
    setStep(1);
  };

  const handleConfirmStep1 = () => {
    setStep(2);
  };

  const handleConfirmStep2 = () => {
    if (confirmText !== 'LIMPAR TODOS OS DADOS') {
      toast.error('Digite exatamente "LIMPAR TODOS OS DADOS" para confirmar');
      return;
    }
    clearDataMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gerenciamento de Dados</h1>
        <p className="text-slate-500 mt-1">Ferramentas avançadas para gestão de dados do sistema</p>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-5 w-5" />
            Limpar Todos os Dados de Negócio
          </CardTitle>
          <CardDescription className="text-amber-800">
            Esta ação é irreversível
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-white border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900">O que será deletado:</AlertTitle>
            <AlertDescription className="text-amber-800 mt-2 space-y-1">
              <p>✗ Todos os produtos e SKUs</p>
              <p>✗ Todos os clientes e contatos</p>
              <p>✗ Todos os pedidos de venda</p>
              <p>✗ Todas as ordens de produção</p>
              <p>✗ Todos os números de série</p>
              <p>✗ Solicitações de serviço e ordens de serviço</p>
              <p>✗ Movimentações e saldos de estoque</p>
              <p>✗ Contagens de inventário</p>
              <p>✗ Recebimentos</p>
              <p>✗ Todos os outros dados de negócio</p>
            </AlertDescription>
          </Alert>

          <Alert className="bg-blue-50 border-blue-200">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-900">O que será preservado:</AlertTitle>
            <AlertDescription className="text-blue-800 mt-2 space-y-1">
              <p>✓ Configurações do sistema</p>
              <p>✓ Dashboard customizado</p>
              <p>✓ Usuários do sistema</p>
              <p>✓ Permissões e papéis</p>
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleStartClear}
            variant="destructive"
            size="lg"
            className="w-full"
            disabled={clearDataMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Todos os Dados
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmação de Exclusão
            </DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  Você tem certeza de que deseja deletar TODOS os dados de negócio do sistema?
                </p>
                <p className="text-sm font-medium text-red-600">
                  Produtos, clientes, pedidos, estoque e todas as outras informações de negócio serão permanentemente removidos.
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-700 font-medium">
                  Digite <span className="font-mono bg-slate-100 px-2 py-1 rounded">LIMPAR TODOS OS DADOS</span> para confirmar:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Digite a confirmação"
                  className="font-mono"
                  autoFocus
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false);
                setConfirmText('');
                setStep(0);
              }}
              disabled={clearDataMutation.isPending}
            >
              Cancelar
            </Button>

            {step === 1 && (
              <Button
                onClick={handleConfirmStep1}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Entendi, Continuar
              </Button>
            )}

            {step === 2 && (
              <Button
                onClick={handleConfirmStep2}
                disabled={clearDataMutation.isPending || confirmText !== 'LIMPAR TODOS OS DADOS'}
                variant="destructive"
              >
                {clearDataMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deletando...
                  </>
                ) : (
                  'Deletar Permanentemente'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}