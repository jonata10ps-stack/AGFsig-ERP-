import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { FileText, Download, Calendar, TrendingUp, Wrench, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

export default function ServiceReports() {
  const { companyId } = useCompanyId();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: serviceOrders } = useQuery({
    queryKey: ['service-orders-all', companyId],
    queryFn: () => companyId ? base44.entities.ServiceOrder.filter({ company_id: companyId }, '-completed_at') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: serviceRequests } = useQuery({
    queryKey: ['service-requests-all', companyId],
    queryFn: () => companyId ? base44.entities.ServiceRequest.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const completedOrders = serviceOrders?.filter(o => o.status === 'CONCLUIDA') || [];
  
  const filteredOrders = completedOrders.filter(order => {
    if (!startDate && !endDate) return true;
    const orderDate = new Date(order.completed_at);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    if (start && orderDate < start) return false;
    if (end && orderDate > end) return false;
    return true;
  });

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total_cost || 0), 0);
  const totalHours = filteredOrders.reduce((sum, o) => sum + (o.labor_hours || 0), 0);
  const avgSatisfaction = filteredOrders.filter(o => o.satisfaction_rating).length > 0
    ? filteredOrders.reduce((sum, o) => sum + (o.satisfaction_rating || 0), 0) / 
      filteredOrders.filter(o => o.satisfaction_rating).length
    : 0;

  const ordersByType = filteredOrders.reduce((acc, order) => {
    acc[order.type] = (acc[order.type] || 0) + 1;
    return acc;
  }, {});

  const exportToCSV = () => {
    const headers = ['OS', 'Cliente', 'Tipo', 'Técnico', 'Horas', 'Custo Total', 'Data Conclusão'];
    const rows = filteredOrders.map(o => [
      o.os_number,
      o.client_name,
      o.type,
      o.technician_name || '-',
      o.labor_hours || 0,
      o.total_cost || 0,
      o.completed_at ? format(new Date(o.completed_at), 'dd/MM/yyyy') : '-'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-servicos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Relatórios de Serviços</h1>
        <p className="text-slate-500">Análise de serviços realizados e indicadores</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2 flex-1">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2 flex-1">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total de Serviços</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold text-slate-900">{filteredOrders.length}</p>
              <Wrench className="h-8 w-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Receita Total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold text-emerald-600">
                R$ {totalRevenue.toFixed(2)}
              </p>
              <TrendingUp className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Horas Trabalhadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold text-blue-600">{totalHours.toFixed(1)}h</p>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Satisfação Média</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold text-amber-600">
                {avgSatisfaction > 0 ? avgSatisfaction.toFixed(1) : '-'}/5
              </p>
              <Users className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Serviços por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(ordersByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{type}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600"
                        style={{ width: `${(count / filteredOrders.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-900 w-8">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimos Serviços Concluídos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredOrders.slice(0, 8).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-2 rounded hover:bg-slate-50">
                  <div>
                    <p className="font-mono text-sm font-medium">{order.os_number}</p>
                    <p className="text-xs text-slate-500">{order.client_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-emerald-600">
                      R$ {(order.total_cost || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {order.completed_at ? format(new Date(order.completed_at), 'dd/MM') : '-'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento de Serviços</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OS</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead>Concluído</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">{order.os_number}</TableCell>
                  <TableCell>{order.client_name}</TableCell>
                  <TableCell className="text-sm">{order.type}</TableCell>
                  <TableCell className="text-sm">{order.technician_name || '-'}</TableCell>
                  <TableCell className="text-right">{order.labor_hours || 0}h</TableCell>
                  <TableCell className="text-right font-medium">
                    R$ {(order.total_cost || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {order.completed_at ? format(new Date(order.completed_at), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}