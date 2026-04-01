import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, AlertTriangle, Clock, TrendingUp, ArrowRight, Activity,
  GitBranch, Zap
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ProductionSimulation() {
  const { companyId } = useCompanyId();
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [simulationResult, setSimulationResult] = useState(null);

  const { data: routes } = useQuery({
    queryKey: ['production-routes', companyId],
    queryFn: () => companyId ? base44.entities.ProductionRoute.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: steps } = useQuery({
    queryKey: ['route-steps', selectedRouteId, companyId],
    queryFn: () => companyId && selectedRouteId ? base44.entities.ProductionRouteStep.filter({ company_id: companyId, route_id: selectedRouteId }) : Promise.resolve([]),
    enabled: !!selectedRouteId && !!companyId,
  });

  const { data: resources } = useQuery({
    queryKey: ['resources', companyId],
    queryFn: () => companyId ? base44.entities.Resource.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const selectedRoute = routes?.find(r => r.id === selectedRouteId);
  const selectedProduct = products?.find(p => p.id === selectedRoute?.product_id);

  // Simulação de produção
  const runSimulation = () => {
    if (!steps || steps.length === 0) return;

    const sortedSteps = [...steps].sort((a, b) => a.sequence - b.sequence);
    const resourceMap = resources?.reduce((acc, r) => ({ ...acc, [r.id]: r }), {}) || {};

    // Calcular tempo total e identificar gargalos
    let totalTime = 0;
    let bottlenecks = [];
    let stepResults = [];
    let parallelGroups = [];

    // Agrupar etapas que podem ser executadas em paralelo
    const groupsByDependencies = new Map();
    
    sortedSteps.forEach(step => {
      const deps = step.depends_on_step_ids || [];
      const key = deps.sort().join(',') || 'root';
      
      if (!groupsByDependencies.has(key)) {
        groupsByDependencies.set(key, []);
      }
      groupsByDependencies.get(key).push(step);
    });

    // Calcular caminho crítico
    const stepTimes = new Map();
    const calculateStepEndTime = (step) => {
      if (stepTimes.has(step.id)) return stepTimes.get(step.id);

      const stepTime = (step.estimated_time || 0) * quantity;
      let maxDepTime = 0;

      (step.depends_on_step_ids || []).forEach(depId => {
        const depStep = sortedSteps.find(s => s.id === depId);
        if (depStep) {
          maxDepTime = Math.max(maxDepTime, calculateStepEndTime(depStep));
        }
      });

      const endTime = maxDepTime + stepTime;
      stepTimes.set(step.id, endTime);
      return endTime;
    };

    sortedSteps.forEach(step => calculateStepEndTime(step));

    // Identificar caminho crítico e gargalos
    const maxTime = Math.max(...Array.from(stepTimes.values()));
    totalTime = maxTime;

    sortedSteps.forEach(step => {
      const stepTime = (step.estimated_time || 0) * quantity;
      const resource = resourceMap[step.resource_id];
      const hasAlternatives = (step.alternative_resource_ids?.length || 0) > 0;
      const endTime = stepTimes.get(step.id);
      const isBottleneck = endTime === maxTime && stepTime > 0;

      stepResults.push({
        step,
        time: stepTime,
        resource: resource?.name || 'Não especificado',
        hasAlternatives,
        alternativeCount: step.alternative_resource_ids?.length || 0,
        isBottleneck,
        dependencies: step.depends_on_step_ids?.length || 0,
        endTime
      });

      if (isBottleneck) {
        bottlenecks.push({
          stepName: step.name,
          time: stepTime,
          sequence: step.sequence,
          suggestions: []
        });

        // Sugestões de otimização
        if (!hasAlternatives && resource) {
          bottlenecks[bottlenecks.length - 1].suggestions.push(
            'Adicionar recursos alternativos para aumentar capacidade'
          );
        }
        if (stepTime > 60 * quantity) {
          bottlenecks[bottlenecks.length - 1].suggestions.push(
            'Considerar dividir esta etapa em sub-etapas menores'
          );
        }
      }
    });

    // Detectar etapas paralelas
    groupsByDependencies.forEach((group, key) => {
      if (group.length > 1) {
        parallelGroups.push({
          steps: group.map(s => s.name),
          canRunParallel: true,
          timeSaved: Math.max(...group.map(s => (s.estimated_time || 0) * quantity))
        });
      }
    });

    setSimulationResult({
      totalTime,
      stepResults,
      bottlenecks,
      parallelGroups,
      efficiency: bottlenecks.length === 0 ? 100 : Math.max(20, 100 - (bottlenecks.length * 15))
    });
  };

  const chartData = useMemo(() => {
    if (!simulationResult) return [];
    return simulationResult.stepResults.map(sr => ({
      name: `${sr.step.sequence}. ${sr.step.name.substring(0, 15)}`,
      tempo: Math.round(sr.time),
      gargalo: sr.isBottleneck ? sr.time : 0
    }));
  }, [simulationResult]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Simulação de Produção</h1>
        <p className="text-slate-500">Analise tempos, gargalos e otimize seus roteiros</p>
      </div>

      {/* Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Configurar Simulação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Roteiro de Produção</Label>
              <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um roteiro..." />
                </SelectTrigger>
                <SelectContent>
                  {routes?.map(r => {
                    const product = products?.find(p => p.id === r.product_id);
                    return (
                      <SelectItem key={r.id} value={r.id}>
                        {r.code} - {product?.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantidade a Produzir</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="flex items-end">
              <Button 
                onClick={runSimulation} 
                disabled={!selectedRouteId || !steps || steps.length === 0}
                className="w-full"
              >
                <Activity className="h-4 w-4 mr-2" />
                Simular Produção
              </Button>
            </div>
          </div>

          {selectedProduct && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">
                Produto: <strong>{selectedProduct.sku} - {selectedProduct.name}</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      {simulationResult && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Tempo Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{Math.round(simulationResult.totalTime)}</p>
                    <p className="text-xs text-slate-500">minutos</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Gargalos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{simulationResult.bottlenecks.length}</p>
                    <p className="text-xs text-slate-500">identificados</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Etapas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{simulationResult.stepResults.length}</p>
                    <p className="text-xs text-slate-500">no roteiro</p>
                  </div>
                  <GitBranch className="h-8 w-8 text-indigo-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Eficiência</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{simulationResult.efficiency}%</p>
                    <p className="text-xs text-slate-500">estimada</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Tempos */}
          <Card>
            <CardHeader>
              <CardTitle>Tempo por Etapa</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tempo" fill="#6366f1" name="Tempo (min)" />
                  <Bar dataKey="gargalo" fill="#f59e0b" name="Gargalo" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gargalos Identificados */}
          {simulationResult.bottlenecks.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <AlertTriangle className="h-5 w-5" />
                  Gargalos Identificados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {simulationResult.bottlenecks.map((bottleneck, idx) => (
                  <Alert key={idx} className="bg-white">
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-900">
                            Seq {bottleneck.sequence}: {bottleneck.stepName}
                          </p>
                          <Badge className="bg-amber-100 text-amber-700">
                            {Math.round(bottleneck.time)} min
                          </Badge>
                        </div>
                        {bottleneck.suggestions.length > 0 && (
                          <div className="ml-4 space-y-1">
                            <p className="text-xs font-medium text-slate-600">Sugestões:</p>
                            {bottleneck.suggestions.map((suggestion, i) => (
                              <p key={i} className="text-xs text-slate-600 flex items-center gap-2">
                                <Zap className="h-3 w-3 text-amber-500" />
                                {suggestion}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Etapas Paralelas */}
          {simulationResult.parallelGroups.length > 0 && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-900">
                  <TrendingUp className="h-5 w-5" />
                  Oportunidades de Paralelização
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {simulationResult.parallelGroups.map((group, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-emerald-200">
                    <p className="text-sm font-medium text-emerald-900 mb-2">
                      Estas etapas podem ser executadas simultaneamente:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.steps.map((stepName, i) => (
                        <React.Fragment key={i}>
                          <Badge className="bg-emerald-100 text-emerald-700">{stepName}</Badge>
                          {i < group.steps.length - 1 && <ArrowRight className="h-4 w-4 text-emerald-400" />}
                        </React.Fragment>
                      ))}
                    </div>
                    <p className="text-xs text-emerald-600 mt-2">
                      ⚡ Economia potencial: ~{Math.round(group.timeSaved)} minutos
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Detalhamento das Etapas */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhamento das Etapas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {simulationResult.stepResults.map((sr, idx) => (
                  <div 
                    key={idx} 
                    className={`p-4 rounded-lg border ${sr.isBottleneck ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-indigo-100 text-indigo-700">Seq {sr.step.sequence}</Badge>
                          <p className="font-semibold text-slate-900">{sr.step.name}</p>
                          {sr.isBottleneck && (
                            <Badge className="bg-amber-100 text-amber-700">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Gargalo
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-slate-500">Tempo</p>
                            <p className="font-medium">{Math.round(sr.time)} min</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Recurso</p>
                            <p className="font-medium">{sr.resource}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Alternativos</p>
                            <p className="font-medium">
                              {sr.hasAlternatives ? `${sr.alternativeCount} disponível(is)` : 'Nenhum'}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Dependências</p>
                            <p className="font-medium">{sr.dependencies || 'Nenhuma'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}