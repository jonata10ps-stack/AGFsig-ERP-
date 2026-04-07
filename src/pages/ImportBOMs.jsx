import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Progress } from '@/components/ui/progress';
import * as XLSX from 'xlsx';
import { useCompanyId } from '@/components/useCompanyId';

export default function ImportBOMs() {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();

  const handleDownloadTemplate = () => {
    const rows = [
      { 
        product_sku: 'PROD-001', 
        component_sku: 'COMP-001', 
        quantity: 2, 
        sequence: 1,
        step_sequence: 1,
        step_name: 'Corte',
        step_description: 'Cortar barras de aço',
        resource_code: 'MAQ-01',
        estimated_time: 15
      },
      { 
        product_sku: 'PROD-001', 
        component_sku: 'COMP-002', 
        quantity: 1, 
        sequence: 2,
        step_sequence: 2,
        step_name: 'Soldagem',
        step_description: 'Soldar estrutura principal',
        resource_code: 'SOL-02',
        estimated_time: 30
      },
      { 
        product_sku: 'PROD-001', 
        component_sku: '', 
        quantity: 0, 
        sequence: 0,
        step_sequence: 3,
        step_name: 'Montagem Final',
        step_description: 'Montagem dos acessórios',
        resource_code: 'LAB-01',
        estimated_time: 45
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, 
      { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 12 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOM_e_Roteiros');
    XLSX.writeFile(wb, 'modelo_importacao_bom_roteiros.xlsx');
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResults(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setProgress(10);

    try {
      // Ler o arquivo Excel diretamente no browser
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      setProgress(25);

      // Normalizar colunas (case-insensitive, trim)
      const bomData = rawRows.map(row => {
        const normalized = {};
        for (const [key, val] of Object.entries(row)) {
          normalized[key.trim().toLowerCase()] = val;
        }
        return {
          product_sku: String(normalized['product_sku'] || '').trim(),
          component_sku: String(normalized['component_sku'] || String(normalized['item_sku'] || '')).trim(),
          quantity: parseFloat(normalized['quantity']) || 0,
          sequence: parseInt(normalized['sequence']) || 0,
          // Routing columns
          step_sequence: parseInt(normalized['step_sequence']) || 0,
          step_name: String(normalized['step_name'] || '').trim(),
          step_description: String(normalized['step_description'] || '').trim(),
          resource_code: String(normalized['resource_code'] || '').trim(),
          estimated_time: parseFloat(normalized['estimated_time']) || 0,
        };
      }).filter(r => r.product_sku); // Permitir linhas sem component se tiver step_name

      if (bomData.length === 0) {
        setResults({ success: false, error: 'Nenhuma linha válida encontrada no arquivo. Verifique se as colunas estão corretas: product_sku, component_sku, quantity, sequence.' });
        setImporting(false);
        return;
      }

      setProgress(40);

      if (!companyId) {
        setResults({ success: false, error: 'Empresa não identificada. Selecione uma empresa antes de importar.' });
        setImporting(false);
        return;
      }
      
      // Buscar todos os produtos da empresa com paginação completa
      const PAGE = 5000;
      let allProducts = [];
      let skip = 0;
      while (true) {
        const page = await base44.entities.Product.filter({ company_id: companyId }, 'sku', PAGE, skip);
        if (!page || page.length === 0) break;
        allProducts = allProducts.concat(page);
        if (page.length < PAGE) break;
        skip += PAGE;
      }
      const productMap = {};
      // Mapear por SKU normalizado (uppercase, sem espaços) para tolerância a diferenças de caixa
      allProducts.forEach(p => { productMap[p.sku.trim().toUpperCase()] = p; });

      // Buscar recursos para o roteiro
      const resources = await base44.entities.Resource.filter({ company_id: companyId, active: true });
      const resourceMap = {};
      resources.forEach(r => { resourceMap[r.code?.trim().toUpperCase()] = r; });

      setProgress(55);

      // Agrupar por produto
      const groupedByProduct = {};
      bomData.forEach(item => {
        if (!groupedByProduct[item.product_sku]) {
          groupedByProduct[item.product_sku] = [];
        }
        groupedByProduct[item.product_sku].push(item);
      });

      const imported = [];
      const errors = [];
      let progressStep = 30 / Object.keys(groupedByProduct).length;

      // Processar cada BOM
      for (const [productSku, items] of Object.entries(groupedByProduct)) {
        try {
          const product = productMap[productSku.toUpperCase()];
          if (!product) {
            errors.push(`Produto ${productSku} não encontrado`);
            continue;
          }

          // Verificar se BOM já existe
          const existingBOMs = await base44.entities.BOM.filter({ product_id: product.id });
          let bom;

          if (existingBOMs.length > 0) {
            bom = existingBOMs[0];
            // Inativar BOMs anteriores
            for (const oldBom of existingBOMs) {
              if (oldBom.id !== bom.id) {
                await base44.entities.BOM.update(oldBom.id, { active: false });
              }
            }
            // Ativar BOM atual
            await base44.entities.BOM.update(bom.id, { active: true });
          } else {
            // Criar novo BOM
            bom = await base44.entities.BOM.create({
              company_id: companyId,
              product_id: product.id,
              product_sku: product.sku,
              product_name: product.name,
              active: true
            });
          }

          // Criar nova versão
          const versions = await base44.entities.BOMVersion.filter({ bom_id: bom.id });
          const newVersionNumber = (versions[0]?.version_number || 0) + 1;
          
          const newVersion = await base44.entities.BOMVersion.create({
            company_id: companyId,
            bom_id: bom.id,
            version_number: newVersionNumber,
            is_active: true,
            effective_date: new Date().toISOString().split('T')[0]
          });

          // Desativar versões antigas
          for (const v of versions) {
            await base44.entities.BOMVersion.update(v.id, { is_active: false });
          }

          // Atualizar BOM
          await base44.entities.BOM.update(bom.id, {
            current_version_id: newVersion.id,
            current_version_number: newVersionNumber
          });

          // Processar Itens de BOM e Roteiros
          const bomItemsToCreate = [];
          const routeStepsToCreate = [];

          items.forEach(item => {
            // Se tem componente, adiciona à BOM
            if (item.component_sku) {
              const component = productMap[item.component_sku.toUpperCase()];
              if (component) {
                bomItemsToCreate.push({
                  company_id: companyId,
                  bom_id: bom.id,
                  bom_version_id: newVersion.id,
                  component_id: component.id,
                  component_sku: component.sku,
                  component_name: component.name,
                  quantity: item.quantity || 1,
                  sequence: item.sequence || bomItemsToCreate.length + 1,
                  unit: component.unit || 'UN'
                });
              } else {
                errors.push(`Componente ${item.component_sku} não encontrado para ${productSku}`);
              }
            }

            // Se tem etapa, adiciona ao Roteiro
            if (item.step_name) {
              const resource = item.resource_code ? resourceMap[item.resource_code.toUpperCase()] : null;
              routeStepsToCreate.push({
                sequence: item.step_sequence || routeStepsToCreate.length + 1,
                name: item.step_name,
                description: item.step_description || '',
                resource_id: resource?.id || '',
                estimated_time: item.estimated_time || 0
              });
            }
          });

          // Criar itens da BOM
          for (const bomItem of bomItemsToCreate) {
            await base44.entities.BOMItem.create(bomItem);
          }

          // Criar roteiro na ProductionRoute (Entidade global de roteiros)
          if (routeStepsToCreate.length > 0) {
            // Verificar se roteiro já existe
            const existingRoutes = await base44.entities.ProductionRoute.filter({ product_id: product.id });
            let routeId;

            if (existingRoutes.length > 0) {
              routeId = existingRoutes[0].id;
              // Deletar etapas antigas
              const oldSteps = await base44.entities.ProductionRouteStep.filter({ route_id: routeId });
              for (const s of oldSteps) await base44.entities.ProductionRouteStep.delete(s.id);
            } else {
              const newRoute = await base44.entities.ProductionRoute.create({
                company_id: companyId,
                product_id: product.id,
                code: 'PADRAO',
                name: 'Roteiro de Produção Padrão',
                active: true
              });
              routeId = newRoute.id;
            }

            // Criar novas etapas e salvar no JSON do BOMVersion para redundância/consistência
            const stepsWithIds = [];
            for (const stepData of routeStepsToCreate) {
              const createdStep = await base44.entities.ProductionRouteStep.create({
                ...stepData,
                route_id: routeId,
                company_id: companyId
              });
              stepsWithIds.push({
                ...stepData,
                id: createdStep.id
              });
            }

            // Atualizar JSON de roteiros na Versão da BOM
            await base44.entities.BOMVersion.update(newVersion.id, {
              routes: JSON.stringify(stepsWithIds)
            });
          }

          imported.push(productSku);
        } catch (error) {
          errors.push(`Erro ao processar ${productSku}: ${error.message}`);
        }

        setProgress(prev => Math.min(prev + progressStep, 95));
      }

      setProgress(100);
      setResults({
        success: true,
        imported: imported.length,
        errors
      });

      queryClient.invalidateQueries(['boms']);
    } catch (error) {
      setResults({
        success: false,
        error: error.message
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('BOMs')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Importar BOMs</h1>
          <p className="text-slate-500 mt-1">Importar estruturas de produtos via Excel</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Instruções</CardTitle>
            <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Baixar Modelo Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            O arquivo Excel deve conter as seguintes colunas:
          </p>
          <div className="overflow-x-auto">
            <table className="text-sm w-full border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left px-3 py-2 border border-slate-200 font-semibold">Coluna</th>
                  <th className="text-left px-3 py-2 border border-slate-200 font-semibold">Descrição</th>
                  <th className="text-left px-3 py-2 border border-slate-200 font-semibold">Obrigatório</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 border border-slate-200 font-mono text-indigo-600">product_sku</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">SKU do produto principal (pai)</td>
                  <td className="px-3 py-2 border border-slate-200 text-green-600 font-medium">Sim</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="px-3 py-2 border border-slate-200 font-mono text-indigo-600">component_sku</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">SKU do componente/material</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-400">Não*</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-slate-200 font-mono text-indigo-600">quantity</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">Quantidade do componente</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-400">Não*</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="px-3 py-2 border border-slate-200 font-mono text-slate-400">sequence</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">Sequência do componente na BOM</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-400">Não</td>
                </tr>
                <tr className="bg-indigo-50/50">
                  <td className="px-3 py-2 border border-slate-200 font-mono text-indigo-900 font-semibold">step_name</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600 font-medium">Nome da etapa (Roteiro)</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-400">Não*</td>
                </tr>
                <tr className="bg-indigo-50/50">
                  <td className="px-3 py-2 border border-slate-200 font-mono text-indigo-700">resource_code</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">Código do Recurso (Máquina/Posto)</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-400">Não</td>
                </tr>
                <tr className="bg-indigo-50/50">
                  <td className="px-3 py-2 border border-slate-200 font-mono text-indigo-700">step_sequence</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">Sequência da etapa no roteiro</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-400">Não</td>
                </tr>
                <tr className="bg-indigo-50/50">
                  <td className="px-3 py-2 border border-slate-200 font-mono text-indigo-700">estimated_time</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">Tempo estimado (minutos)</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-400">Não</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2 italic">
            * Cada linha deve ter ao menos um <b>component_sku</b> (para BOM) ou um <b>step_name</b> (para Roteiro), ou ambos se o componente for montado naquela etapa específica.
          </p>

          <p className="text-sm text-slate-500">
            Todos os produtos e componentes devem estar previamente cadastrados no sistema. Repita o <strong>product_sku</strong> em cada linha para cada componente do mesmo produto.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload do Arquivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Selecionar Arquivo
                </span>
              </Button>
            </label>
            {file && (
              <p className="text-sm text-slate-600 mt-3">
                Arquivo selecionado: {file.name}
              </p>
            )}
          </div>

          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importando...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {results && (
            <div className={`p-4 rounded-lg ${results.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-start gap-3">
                {results.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  {results.success ? (
                    <>
                      <p className="font-medium text-green-900">
                        Importação concluída com sucesso!
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        {results.imported} BOM(s) importado(s)
                      </p>
                      {results.errors.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-orange-900">
                            Avisos ({results.errors.length}):
                          </p>
                          <ul className="text-sm text-orange-700 mt-1 space-y-1">
                            {results.errors.slice(0, 5).map((err, idx) => (
                              <li key={idx}>• {err}</li>
                            ))}
                            {results.errors.length > 5 && (
                              <li>• ... e mais {results.errors.length - 5} avisos</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-red-900">Erro na importação</p>
                      <p className="text-sm text-red-700 mt-1">{results.error}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Link to={createPageUrl('BOMs')}>
              <Button variant="outline">Cancelar</Button>
            </Link>
            <Button
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing ? 'Importando...' : 'Importar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}