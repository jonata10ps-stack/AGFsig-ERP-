import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { AlertTriangle, Loader2, CheckCircle2, Trash2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function DeduplicateProducts() {
  const { companyId } = useCompanyId();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState('');

  const run = async () => {
    setRunning(true);
    setResult(null);
    setProgress('Executando deduplicação no servidor... (pode levar alguns minutos)');

    const response = await base44.functions.invoke('deduplicateSkuProducts', { company_id: companyId });
    const data = response.data;

    setProgress('');
    setRunning(false);

    if (data.success) {
      setResult(data);
      toast.success(data.message);
    } else {
      toast.error(data.error || 'Erro desconhecido');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Remover Produtos Duplicados</h1>
        <p className="text-slate-500 mt-1">
          Remove SKUs duplicados preservando o produto com mais movimentações de estoque.
        </p>
      </div>

      <Alert className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>Regra:</strong> Para cada SKU duplicado, mantém o produto com mais movimentações de estoque. 
          Produtos sem movimentação são excluídos. A operação é <strong>irreversível</strong>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Button
            onClick={run}
            disabled={running || !companyId}
            className="bg-red-600 hover:bg-red-700"
            size="lg"
          >
            {running ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
            ) : (
              <><Trash2 className="h-4 w-4 mr-2" /> Executar Deduplicação</>
            )}
          </Button>

          {progress && (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              {progress}
            </p>
          )}

          {result && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                Concluído com sucesso!
              </div>
              <p className="text-sm text-slate-700">SKUs duplicados processados: <strong>{result.totalDuplicateSkus}</strong></p>
              <p className="text-sm text-slate-700">Produtos excluídos: <strong>{result.totalProductsDeleted}</strong></p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}