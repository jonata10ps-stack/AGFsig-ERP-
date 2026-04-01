import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OrdersExport({ companyId }) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders-export', companyId],
    queryFn: () => companyId ? base44.entities.SalesOrder.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const exportCSV = () => {
    if (!orders || orders.length === 0) {
      toast.error('Nenhum pedido para exportar');
      return;
    }

    const headers = ['Nº Pedido', 'Cliente', 'Vendedor', 'Data Entrega', 'Status', 'Valor Total', 'Condição Pagto'];
    const rows = orders.map(o => [
      o.numero_pedido_externo || o.order_number || '',
      o.client_name || '',
      o.seller_name || '',
      o.delivery_date || '',
      o.status || '',
      o.total_amount || 0,
      o.payment_condition_name || ''
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pedidos_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    toast.success('Pedidos exportados com sucesso');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Relatório de Pedidos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600">
          <p className="font-medium mb-2">Total de pedidos: <span className="text-lg font-bold">{orders?.length || 0}</span></p>
          <p className="text-xs text-slate-500">Clique abaixo para exportar todos os pedidos em formato CSV</p>
        </div>
        <Button 
          onClick={exportCSV} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Exportar Pedidos (CSV)
        </Button>
      </CardContent>
    </Card>
  );
}