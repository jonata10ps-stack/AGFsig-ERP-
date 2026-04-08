import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StockByAllocationExport({ companyId }) {
  const { data: stockBalances, isLoading: loadingStock } = useQuery({
    queryKey: ['stock-alloc-export', companyId],
    queryFn: () => companyId ? base44.entities.StockBalance.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.listAll({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
    staleTime: 300000,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => companyId ? base44.entities.Warehouse.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => companyId ? base44.entities.Location.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const exportCSV = () => {
    if (!stockBalances || stockBalances.length === 0) {
      toast.error('Nenhum item alocado para exportar');
      return;
    }

    const headers = ['Produto', 'SKU', 'Armazém', 'Localização', 'Disponível', 'Reservado', 'Separado'];
    const rows = stockBalances.map(sb => {
      const product = products.find(p => p.id === sb.product_id);
      const warehouse = warehouses.find(w => w.id === sb.warehouse_id);
      const location = locations.find(l => l.id === sb.location_id);
      
      return [
        product?.name || 'Produto desconhecido',
        product?.sku || '',
        warehouse?.name || 'Sem Armazém',
        location?.barcode || location ? `${location.rua}/${location.modulo}/${location.nivel}` : 'Sem Localização',
        sb.qty_available || 0,
        sb.qty_reserved || 0,
        sb.qty_separated || 0
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `estoque_alocacao_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    toast.success('Estoque por alocação exportado com sucesso');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Relatório de Estoque por Alocação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600">
          <p className="font-medium mb-2">Total de alocações: <span className="text-lg font-bold">{stockBalances?.length || 0}</span></p>
          <p className="text-xs text-slate-500">Clique abaixo para exportar estoque por armazém/localização em formato CSV</p>
        </div>
        <Button 
          onClick={exportCSV} 
          disabled={loadingStock}
          className="w-full"
        >
          {loadingStock ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Exportar Alocações (CSV)
        </Button>
      </CardContent>
    </Card>
  );
}