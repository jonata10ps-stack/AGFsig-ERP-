import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StockExport({ companyId }) {
  const { data: stockBalances, isLoading: loadingStock } = useQuery({
    queryKey: ['stock-export', companyId],
    queryFn: () => companyId ? base44.entities.StockBalance.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const exportCSV = () => {
    if (!stockBalances || stockBalances.length === 0) {
      toast.error('Nenhum item em estoque para exportar');
      return;
    }

    const headers = ['Produto', 'SKU', 'Disponível', 'Reservado', 'Separado', 'Custo Médio', 'Valor Total'];
    const rows = stockBalances.map(sb => {
      const product = products.find(p => p.id === sb.product_id);
      const totalValue = (sb.qty_available || 0) * (sb.avg_cost || 0);
      return [
        product?.name || 'Produto desconhecido',
        product?.sku || '',
        sb.qty_available || 0,
        sb.qty_reserved || 0,
        sb.qty_separated || 0,
        sb.avg_cost || 0,
        totalValue
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `estoque_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    toast.success('Estoque exportado com sucesso');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Relatório de Estoque</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600">
          <p className="font-medium mb-2">Total de itens: <span className="text-lg font-bold">{stockBalances?.length || 0}</span></p>
          <p className="text-xs text-slate-500">Clique abaixo para exportar saldo de estoque em formato CSV</p>
        </div>
        <Button 
          onClick={exportCSV} 
          disabled={loadingStock}
          className="w-full"
        >
          {loadingStock ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Exportar Estoque (CSV)
        </Button>
      </CardContent>
    </Card>
  );
}