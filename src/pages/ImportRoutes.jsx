import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportRoutes() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ active: true }),
  });

  const { data: resources } = useQuery({
    queryKey: ['resources'],
    queryFn: () => base44.entities.Resource.filter({ active: true }),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      return await base44.integrations.Core.UploadFile({ file });
    },
  });

  const extractMutation = useMutation({
    mutationFn: async (fileUrl) => {
      return await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: {
          type: "object",
          properties: {
            routes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product_sku: { type: "string" },
                  route_code: { type: "string" },
                  route_name: { type: "string" },
                  step_sequence: { type: "number" },
                  step_name: { type: "string" },
                  step_description: { type: "string" },
                  resource_type: { type: "string" },
                  resource_code: { type: "string" },
                  estimated_time: { type: "number" }
                }
              }
            }
          }
        }
      });
    },
  });

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/)) {
      toast.error('Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV');
      return;
    }

    setFile(selectedFile);
    setPreviewData(null);
    setImportResult(null);

    try {
      toast.loading('Fazendo upload do arquivo...');
      const { file_url } = await uploadMutation.mutateAsync(selectedFile);
      
      toast.loading('Extraindo dados...');
      const result = await extractMutation.mutateAsync(file_url);
      
      toast.dismiss();
      
      if (result.status === 'success' && result.output?.routes) {
        setPreviewData(result.output.routes);
        toast.success(`${result.output.routes.length} linhas extraídas`);
      } else {
        toast.error(result.details || 'Erro ao extrair dados');
      }
    } catch (error) {
      toast.dismiss();
      toast.error('Erro ao processar arquivo');
      console.error(error);
    }
  };

  const handleImport = async () => {
    if (!previewData || !products || !resources) return;

    const productMap = products.reduce((acc, p) => ({ ...acc, [p.sku]: p }), {});
    const resourceMap = resources.reduce((acc, r) => ({ ...acc, [r.code]: r }), {});

    const routesMap = new Map();
    const errors = [];
    const warnings = [];

    // Agrupar por roteiro
    previewData.forEach((row, idx) => {
      const product = productMap[row.product_sku];
      if (!product) {
        errors.push(`Linha ${idx + 1}: Produto ${row.product_sku} não encontrado`);
        return;
      }

      const key = `${product.id}_${row.route_code}`;
      if (!routesMap.has(key)) {
        routesMap.set(key, {
          product_id: product.id,
          code: row.route_code,
          name: row.route_name,
          active: true,
          steps: []
        });
      }

      const resource = row.resource_code ? resourceMap[row.resource_code] : null;
      if (row.resource_code && !resource) {
        warnings.push(`Linha ${idx + 1}: Recurso ${row.resource_code} não encontrado`);
      }

      routesMap.get(key).steps.push({
        sequence: row.step_sequence || 0,
        name: row.step_name,
        description: row.step_description || '',
        resource_type: row.resource_type || '',
        resource_id: resource?.id || '',
        estimated_time: row.estimated_time || 0
      });
    });

    if (errors.length > 0) {
      setImportResult({ success: false, errors, warnings });
      return;
    }

    try {
      let created = 0;
      let updated = 0;

      for (const [key, routeData] of routesMap) {
        // Verificar se roteiro já existe
        const existingRoutes = await base44.entities.ProductionRoute.filter({
          product_id: routeData.product_id,
          code: routeData.code
        });

        let routeId;
        if (existingRoutes.length > 0) {
          // Atualizar roteiro existente
          await base44.entities.ProductionRoute.update(existingRoutes[0].id, {
            name: routeData.name,
            active: routeData.active
          });
          routeId = existingRoutes[0].id;
          
          // Deletar etapas antigas
          const oldSteps = await base44.entities.ProductionRouteStep.filter({ route_id: routeId });
          await Promise.all(oldSteps.map(s => base44.entities.ProductionRouteStep.delete(s.id)));
          updated++;
        } else {
          // Criar novo roteiro
          const newRoute = await base44.entities.ProductionRoute.create({
            product_id: routeData.product_id,
            code: routeData.code,
            name: routeData.name,
            active: routeData.active
          });
          routeId = newRoute.id;
          created++;
        }

        // Criar etapas
        await Promise.all(
          routeData.steps.map(step =>
            base44.entities.ProductionRouteStep.create({
              ...step,
              route_id: routeId
            })
          )
        );
      }

      queryClient.invalidateQueries({ queryKey: ['production-routes'] });
      setImportResult({
        success: true,
        created,
        updated,
        warnings,
        totalRoutes: routesMap.size
      });
      toast.success('Importação concluída com sucesso!');
    } catch (error) {
      toast.error('Erro durante a importação');
      setImportResult({ success: false, errors: [error.message], warnings });
    }
  };

  const downloadTemplate = () => {
    const csv = `product_sku,route_code,route_name,step_sequence,step_name,step_description,resource_type,resource_code,estimated_time
PROD-001,ROT-001,Montagem Padrão,1,Corte,Cortar materiais conforme especificação,MAQUINA,MAQ-01,30
PROD-001,ROT-001,Montagem Padrão,2,Montagem,Montagem dos componentes,OPERADOR,OP-01,45
PROD-001,ROT-001,Montagem Padrão,3,Acabamento,Acabamento final,OPERADOR,OP-02,20`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_roteiros.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Template baixado');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Importar Roteiros de Produção</h1>
        <p className="text-slate-500">Importe roteiros e etapas via planilha Excel ou CSV</p>
      </div>

      {/* Template */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Modelo de Planilha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-blue-700">
            Baixe o modelo de planilha com as colunas necessárias para importação:
          </p>
          <div className="bg-white p-3 rounded-lg border border-blue-200">
            <p className="text-xs font-mono text-slate-600 mb-2">Colunas necessárias:</p>
            <ul className="text-xs text-slate-600 space-y-1">
              <li>• <strong>product_sku</strong>: SKU do produto</li>
              <li>• <strong>route_code</strong>: Código do roteiro</li>
              <li>• <strong>route_name</strong>: Nome do roteiro</li>
              <li>• <strong>step_sequence</strong>: Sequência da etapa (numérico)</li>
              <li>• <strong>step_name</strong>: Nome da etapa</li>
              <li>• <strong>step_description</strong>: Descrição da etapa (opcional)</li>
              <li>• <strong>resource_type</strong>: MAQUINA, OPERADOR ou CENTRO_TRABALHO (opcional)</li>
              <li>• <strong>resource_code</strong>: Código do recurso (opcional)</li>
              <li>• <strong>estimated_time</strong>: Tempo estimado em minutos (opcional)</li>
            </ul>
          </div>
          <Button onClick={downloadTemplate} variant="outline" className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Baixar Template
          </Button>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Arquivo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>Selecionar Arquivo</span>
              </Button>
            </label>
            {file && (
              <p className="text-sm text-slate-600 mt-3">
                Arquivo selecionado: <strong>{file.name}</strong>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {previewData && previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Pré-visualização ({previewData.length} linhas)</span>
              <Button onClick={handleImport} disabled={!previewData}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Importação
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Produto SKU</th>
                    <th className="text-left p-2">Roteiro</th>
                    <th className="text-left p-2">Seq</th>
                    <th className="text-left p-2">Etapa</th>
                    <th className="text-left p-2">Recurso</th>
                    <th className="text-left p-2">Tempo (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2 font-mono">{row.product_sku}</td>
                      <td className="p-2">{row.route_code} - {row.route_name}</td>
                      <td className="p-2">{row.step_sequence}</td>
                      <td className="p-2">{row.step_name}</td>
                      <td className="p-2">{row.resource_code || '-'}</td>
                      <td className="p-2">{row.estimated_time || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 10 && (
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Mostrando 10 de {previewData.length} linhas
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {importResult && (
        <Alert className={importResult.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}>
          <AlertDescription>
            {importResult.success ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle className="h-5 w-5" />
                  <p className="font-semibold">Importação concluída!</p>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-emerald-600">Roteiros Criados</p>
                    <p className="text-2xl font-bold text-emerald-700">{importResult.created}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600">Roteiros Atualizados</p>
                    <p className="text-2xl font-bold text-emerald-700">{importResult.updated}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600">Total</p>
                    <p className="text-2xl font-bold text-emerald-700">{importResult.totalRoutes}</p>
                  </div>
                </div>
                {importResult.warnings?.length > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs font-semibold text-amber-700 mb-2">Avisos:</p>
                    {importResult.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-600">{w}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-5 w-5" />
                  <p className="font-semibold">Erro na importação</p>
                </div>
                {importResult.errors?.map((e, i) => (
                  <p key={i} className="text-sm text-red-600">{e}</p>
                ))}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}