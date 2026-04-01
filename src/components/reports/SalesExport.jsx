import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SalesExport({ companyId }) {
  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ['sales-export', companyId],
    queryFn: () => companyId ? base44.entities.SalesOrder.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: orderItems = [] } = useQuery({
    queryKey: ['sales-items-export', companyId],
    queryFn: () => companyId ? base44.entities.SalesOrderItem.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const exportCSV = () => {
    if (!orderItems || orderItems.length === 0) {
      toast.error('Nenhum item de venda para exportar');
      return;
    }

    const headers = ['Pedido', 'Cliente', 'Produto', 'SKU', 'Quantidade', 'Preço Unitário', 'Total', 'Data Entrega'];
    const rows = orderItems.map(item => {
      const order = orders?.find(o => o.id === item.order_id);
      return [
        order?.numero_pedido_externo || order?.order_number || '',
        order?.client_name || '',
        item.product_name || '',
        item.product_sku || '',
        item.qty || 0,
        item.unit_price || 0,
        item.total_price || 0,
        order?.delivery_date || ''
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vendas_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    toast.success('Vendas exportadas com sucesso');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Relatório de Vendas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600">
          <p className="font-medium mb-2">Total de itens: <span className="text-lg font-bold">{orderItems?.length || 0}</span></p>
          <p className="text-xs text-slate-500">Clique abaixo para exportar todos os itens de vendas em formato CSV</p>
        </div>
        <Button 
          onClick={exportCSV} 
          disabled={loadingOrders}
          className="w-full"
        >
          {loadingOrders ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Exportar Vendas (CSV)
        </Button>
      </CardContent>
    </Card>
  );
}