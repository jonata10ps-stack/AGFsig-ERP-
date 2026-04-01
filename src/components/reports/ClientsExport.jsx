import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientsExport({ companyId }) {
  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients-export', companyId],
    queryFn: () => companyId ? base44.entities.Client.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const exportCSV = () => {
    if (!clients || clients.length === 0) {
      toast.error('Nenhum cliente para exportar');
      return;
    }

    const headers = ['Código', 'Nome', 'Documento', 'Email', 'Telefone', 'Cidade', 'Estado', 'Limite de Crédito', 'Ativo'];
    const rows = clients.map(c => [
      c.code || '',
      c.name || '',
      c.document || '',
      c.email || '',
      c.phone || '',
      c.city || '',
      c.state || '',
      c.credit_limit || 0,
      c.active ? 'Sim' : 'Não'
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `clientes_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    toast.success('Clientes exportados com sucesso');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Relatório de Clientes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600">
          <p className="font-medium mb-2">Total de clientes: <span className="text-lg font-bold">{clients?.length || 0}</span></p>
          <p className="text-xs text-slate-500">Clique abaixo para exportar todos os clientes em formato CSV</p>
        </div>
        <Button 
          onClick={exportCSV} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Exportar Clientes (CSV)
        </Button>
      </CardContent>
    </Card>
  );
}