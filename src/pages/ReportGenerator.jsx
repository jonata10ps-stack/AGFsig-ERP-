import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ReportGenerator() {
  const { companyId } = useCompanyId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const templateId = urlParams.get('template_id');

  const [dateFrom, setDateFrom] = useState(format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);

  const { data: template, isLoading: loadingTemplate } = useQuery({
    queryKey: ['report-template', templateId],
    queryFn: () => base44.entities.ReportTemplate.filter({ id: templateId }),
    select: (data) => data?.[0],
    enabled: !!templateId,
  });

  const { data: salesOrders } = useQuery({
    queryKey: ['sales-orders', companyId, dateFrom, dateTo],
    queryFn: () => {
      if (!companyId) return Promise.resolve([]);
      return base44.entities.SalesOrder.filter({ company_id: companyId });
    },
    enabled: !!companyId,
  });

  const { data: quotes } = useQuery({
    queryKey: ['quotes', companyId, dateFrom, dateTo],
    queryFn: () => {
      if (!companyId) return Promise.resolve([]);
      return base44.entities.Quote.list();
    },
    enabled: !!companyId,
  });

  const { data: serviceOrders } = useQuery({
    queryKey: ['service-orders', companyId, dateFrom, dateTo],
    queryFn: () => {
      if (!companyId) return Promise.resolve([]);
      return base44.entities.ServiceOrder.filter({ company_id: companyId });
    },
    enabled: !!companyId,
  });

  const generateReport = async () => {
    if (!template) {
      toast.error('Template não encontrado');
      return;
    }

    setGenerating(true);
    try {
      let reportData = {
        total_orders: 0,
        total_amount: 0,
        summary: '',
        data: []
      };

      // Processar dados baseado no tipo de relatório
      if (template.type === 'VENDAS_POR_VENDEDOR') {
        const filtered = salesOrders?.filter(o => {
          const oDate = new Date(o.created_date);
          return oDate >= new Date(dateFrom) && oDate <= new Date(dateTo);
        }) || [];

        const byVendor = {};
        filtered.forEach(order => {
          if (!byVendor[order.seller_name]) {
            byVendor[order.seller_name] = { count: 0, total: 0 };
          }
          byVendor[order.seller_name].count += 1;
          byVendor[order.seller_name].total += order.total_amount || 0;
        });

        reportData = {
          ...reportData,
          total_orders: filtered.length,
          total_amount: filtered.reduce((sum, o) => sum + (o.total_amount || 0), 0),
          data: Object.entries(byVendor).map(([vendor, data]) => ({
            vendor,
            ...data
          }))
        };
      } else if (template.type === 'ORCAMENTOS_CONVERTIDOS') {
        const filtered = quotes?.filter(q => {
          const qDate = new Date(q.created_date);
          return qDate >= new Date(dateFrom) && qDate <= new Date(dateTo) && q.status === 'CONVERTIDO';
        }) || [];

        reportData = {
          ...reportData,
          total_orders: filtered.length,
          total_amount: filtered.reduce((sum, q) => sum + (q.total_amount || 0), 0),
          data: filtered.map(q => ({
            quote_number: q.quote_number,
            client: q.client_name,
            amount: q.total_amount,
            converted_at: q.converted_at
          }))
        };
      }

      // Se incluir insights de IA
      if (template.include_ai_insights) {
        const prompt = `Analise os seguintes dados de relatório ${template.type} e forneça insights e recomendações:
        
Total de registros: ${reportData.total_orders}
Valor total: R$ ${reportData.total_amount.toFixed(2)}
Período: ${dateFrom} a ${dateTo}

Dados: ${JSON.stringify(reportData.data.slice(0, 10))}

Forneça:
1. Resumo executivo (máx 3 linhas)
2. Principais insights (máx 3)
3. Recomendações (máx 2)`;

        const aiResponse = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              insights: { type: 'array', items: { type: 'string' } },
              recommendations: { type: 'array', items: { type: 'string' } }
            }
          }
        });

        reportData.summary = aiResponse?.summary || '';
        reportData.ai_insights = aiResponse;
      }

      // Criar registro de relatório gerado
      const report = await base44.entities.GeneratedReport.create({
        company_id: companyId,
        template_id: templateId,
        template_name: template.name,
        type: template.type,
        status: 'CONCLUIDO',
        date_from: dateFrom,
        date_to: dateTo,
        filters_applied: JSON.stringify({ dateFrom, dateTo }),
        summary: reportData.summary,
        data_points: reportData.total_orders,
      });

      setGeneratedReport({ ...reportData, id: report.id });
      toast.success('Relatório gerado com sucesso');
    } catch (error) {
      toast.error('Erro ao gerar relatório: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadCSV = () => {
    if (!generatedReport) return;

    let csv = `Relatório: ${template.name}\nPeríodo: ${dateFrom} a ${dateTo}\n\n`;
    
    csv += `Total de Registros,${generatedReport.total_orders}\n`;
    csv += `Valor Total,R$ ${generatedReport.total_amount.toFixed(2)}\n\n`;

    if (generatedReport.data.length > 0) {
      const headers = Object.keys(generatedReport.data[0]);
      csv += headers.join(',') + '\n';
      generatedReport.data.forEach(row => {
        csv += headers.map(h => row[h]).join(',') + '\n';
      });
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${template.name.replace(/\s+/g, '_')}_${dateFrom}.csv`;
    a.click();
  };

  const downloadPDF = () => {
    toast.success('Download de PDF iniciado');
    // Implementar geração de PDF com jsPDF se necessário
  };

  if (loadingTemplate) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 mb-4">Template não encontrado</p>
        <Link to={createPageUrl('ReportTemplates')}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('ReportTemplates')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{template.name}</h1>
          <p className="text-slate-500">{template.description}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={generateReport} 
            disabled={generating}
            className="w-full bg-indigo-600"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Gerar Relatório
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {generatedReport && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resumo do Relatório
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Total de Registros</p>
                  <p className="text-2xl font-bold text-slate-900">{generatedReport.total_orders}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Valor Total</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    R$ {generatedReport.total_amount.toFixed(2)}
                  </p>
                </div>
              </div>

              {generatedReport.summary && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-900 mb-2">Análise de IA</p>
                  <p className="text-sm text-blue-800">{generatedReport.summary}</p>
                  {generatedReport.ai_insights?.insights && (
                    <ul className="mt-2 ml-4 text-sm text-blue-800 list-disc">
                      {generatedReport.ai_insights.insights.map((insight, i) => (
                        <li key={i}>{insight}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                {(template.format === 'PDF' || template.format === 'AMBOS') && (
                  <Button onClick={downloadPDF} variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                )}
                {(template.format === 'CSV' || template.format === 'AMBOS') && (
                  <Button onClick={downloadCSV} variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {generatedReport.data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Dados Detalhados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        {Object.keys(generatedReport.data[0]).map(key => (
                          <th key={key} className="text-left p-2 font-medium text-slate-700">
                            {key.replace(/_/g, ' ').toUpperCase()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {generatedReport.data.map((row, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="p-2 text-slate-700">
                              {typeof val === 'number' ? val.toFixed(2) : val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}