import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductionOrdersExport({ companyId }) {
  const { data: productionOrders, isLoading } = useQuery({
    queryKey: ['production-export', companyId],
    queryFn: () => companyId ? base44.entities.ProductionOrder.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const exportCSV = () => {
    if (!productionOrders || productionOrders.length === 0) {
      toast.error('Nenhuma OP para exportar');
      return;
    }

    const headers = ['OP Interna', 'OP Externa', 'Produto', 'Qt. Planejada', 'Qt. Produzida', 'Status', 'Prioridade', 'Data Início', 'Data Conclusão'];
    const rows = productionOrders.map(op => [
      op.op_number || '',
      op.numero_op_externo || '',
      op.product_name || '',
      op.qty_planned || 0,
      op.qty_produced || 0,
      op.status || '',
      op.priority || '',
      op.start_date || '',
      op.due_date || ''
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ordens_producao_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    toast.success('Ordens de Produção exportadas com sucesso');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Relatório de Ordens de Produção</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600">
          <p className="font-medium mb-2">Total de OPs: <span className="text-lg font-bold">{productionOrders?.length || 0}</span></p>
          <p className="text-xs text-slate-500">Clique abaixo para exportar todas as ordens de produção em formato CSV</p>
        </div>
        <Button 
          onClick={exportCSV} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Exportar OPs (CSV)
        </Button>
      </CardContent>
    </Card>
  );
}