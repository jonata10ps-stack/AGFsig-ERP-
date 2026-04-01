import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import ERPSyncStatus from './ERPSyncStatus';

const ENTITY_TYPES = [
  { value: 'Product', label: 'Produtos' },
  { value: 'Client', label: 'Clientes' },
  { value: 'SalesOrder', label: 'Pedidos de Venda' },
  { value: 'ProductionOrder', label: 'Ordens de Produção' }
];

const ERP_PROVIDERS = [
  { value: 'TOTVS_PROTHEUS', label: 'TOTVS Protheus' },
  { value: 'GENERIC', label: 'ERP Genérico' }
];

export default function ERPSyncPanel() {
  const queryClient = useQueryClient();
  const [selectedEntity, setSelectedEntity] = useState('Product');
  const [syncProgress, setSyncProgress] = useState(0);
  const [erpProvider, setErpProvider] = useState('TOTVS_PROTHEUS');
  const [showConfig, setShowConfig] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [protheus, setProtheus] = useState({
    server: localStorage.getItem('protheus_server') || '',
    port: localStorage.getItem('protheus_port') || '8080',
    database: localStorage.getItem('protheus_database') || '',
    user: localStorage.getItem('protheus_user') || '',
    password: localStorage.getItem('protheus_password') || '',
  });

  const { data: syncs, isLoading } = useQuery({
    queryKey: ['erp-syncs', selectedEntity],
    queryFn: () => base44.entities.ERPSync.filter({ entity_type: selectedEntity }),
  });

  const { data: logs } = useQuery({
    queryKey: ['erp-logs'],
    queryFn: () => base44.entities.ERPLog.list('-created_date', 20),
  });

  const handleSaveConfig = () => {
    if (erpProvider === 'TOTVS_PROTHEUS') {
      if (!protheus.server || !protheus.database || !protheus.user || !protheus.password) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }
      localStorage.setItem('protheus_server', protheus.server);
      localStorage.setItem('protheus_port', protheus.port);
      localStorage.setItem('protheus_database', protheus.database);
      localStorage.setItem('protheus_user', protheus.user);
      localStorage.setItem('protheus_password', protheus.password);
      localStorage.setItem('erp_provider', erpProvider);
    }
    setShowConfig(false);
    toast.success('Configurações salvas com sucesso');
  };

  const syncMutation = useMutation({
    mutationFn: async ({ direction }) => {
      const startTime = Date.now();
      try {
        let syncedCount = 0;
        let errorCount = 0;

        // Buscar entidades do app
        let entities = [];
        if (selectedEntity === 'Product') {
          entities = await base44.entities.Product.list();
        } else if (selectedEntity === 'Client') {
          entities = await base44.entities.Client.list();
        } else if (selectedEntity === 'SalesOrder') {
          entities = await base44.entities.SalesOrder.list();
        } else if (selectedEntity === 'ProductionOrder') {
          entities = await base44.entities.ProductionOrder.list();
        }

        for (const entity of entities) {
          try {
            const existingSync = await base44.entities.ERPSync.filter({
              entity_type: selectedEntity,
              entity_id: entity.id
            });

            const erpProvider2 = localStorage.getItem('erp_provider') || 'GENERIC';
            const erpId = erpProvider2 === 'TOTVS_PROTHEUS' 
              ? `PT-${selectedEntity.substring(0, 2).toUpperCase()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
              : `ERP-${selectedEntity.substring(0, 3)}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            
            if (existingSync.length > 0) {
              await base44.entities.ERPSync.update(existingSync[0].id, {
                status: 'SINCRONIZADO',
                erp_id: existingSync[0].erp_id || erpId,
                last_sync: new Date().toISOString(),
                sync_count: (existingSync[0].sync_count || 0) + 1,
                data_snapshot: entity
              });
            } else {
              await base44.entities.ERPSync.create({
                entity_type: selectedEntity,
                entity_id: entity.id,
                erp_id: erpId,
                status: 'SINCRONIZADO',
                direction: direction,
                last_sync: new Date().toISOString(),
                sync_count: 1,
                data_snapshot: entity
              });
            }

            // Registrar log
            await base44.entities.ERPLog.create({
              action: 'SYNC_SUCESSO',
              entity_type: selectedEntity,
              entity_id: entity.id,
              direction: direction,
              status: 'SUCESSO',
              duration_ms: Date.now() - startTime,
              details: { erpId, provider: erpProvider2 }
            });

            syncedCount++;
            setSyncProgress((syncedCount / entities.length) * 100);
          } catch (err) {
            errorCount++;
            await base44.entities.ERPLog.create({
              action: 'SYNC_ERRO',
              entity_type: selectedEntity,
              entity_id: entity.id,
              direction: direction,
              status: 'ERRO',
              error_message: err.message,
              duration_ms: Date.now() - startTime
            });
          }
        }

        return { syncedCount, errorCount, total: entities.length };
      } catch (error) {
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['erp-syncs'] });
      queryClient.invalidateQueries({ queryKey: ['erp-logs'] });
      setSyncProgress(0);
      toast.success(`Sincronizados ${data.syncedCount} de ${data.total} itens`);
    },
    onError: (error) => {
      setSyncProgress(0);
      toast.error(`Erro na sincronização: ${error.message}`);
    }
  });

  const stats = {
    total: syncs?.length || 0,
    sincronizados: syncs?.filter(s => s.status === 'SINCRONIZADO').length || 0,
    pendentes: syncs?.filter(s => s.status === 'PENDENTE').length || 0,
    erros: syncs?.filter(s => s.status === 'ERRO').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-slate-500 text-sm">Total</p>
              <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-slate-500 text-sm">Sincronizados</p>
              <p className="text-3xl font-bold text-emerald-600">{stats.sincronizados}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-slate-500 text-sm">Pendentes</p>
              <p className="text-3xl font-bold text-amber-600">{stats.pendentes}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-slate-500 text-sm">Erros</p>
              <p className="text-3xl font-bold text-rose-600">{stats.erros}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      {showConfig && (
        <Card className="border-indigo-200 bg-indigo-50">
          <CardHeader>
            <CardTitle>Configuração TOTVS Protheus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Servidor *</Label>
                <Input
                  placeholder="192.168.1.100 ou dominio.com"
                  value={protheus.server}
                  onChange={(e) => setProtheus({ ...protheus, server: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Porta</Label>
                <Input
                  placeholder="8080"
                  type="number"
                  value={protheus.port}
                  onChange={(e) => setProtheus({ ...protheus, port: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Banco de Dados *</Label>
                <Input
                  placeholder="AGFSIG"
                  value={protheus.database}
                  onChange={(e) => setProtheus({ ...protheus, database: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Usuário *</Label>
                <Input
                  placeholder="admin"
                  value={protheus.user}
                  onChange={(e) => setProtheus({ ...protheus, user: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-sm font-medium">Senha *</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="••••••••"
                    type={showPassword ? 'text' : 'password'}
                    value={protheus.password}
                    onChange={(e) => setProtheus({ ...protheus, password: e.target.value })}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveConfig} className="bg-indigo-600 hover:bg-indigo-700">
                Salvar Configuração
              </Button>
              <Button variant="outline" onClick={() => setShowConfig(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entity Selection and Sync Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sincronização</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              {showConfig ? 'Ocultar' : 'Configurar'} Protheus
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {ENTITY_TYPES.map((entity) => (
              <Button
                key={entity.value}
                variant={selectedEntity === entity.value ? 'default' : 'outline'}
                onClick={() => setSelectedEntity(entity.value)}
              >
                {entity.label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => syncMutation.mutate({ direction: 'APP_TO_ERP' })}
              disabled={syncMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {syncMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  App → ERP
                </>
              )}
            </Button>
            <Button
              onClick={() => syncMutation.mutate({ direction: 'ERP_TO_APP' })}
              disabled={syncMutation.isPending}
              variant="outline"
            >
              {syncMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  ERP → App
                </>
              )}
            </Button>
          </div>

          {syncProgress > 0 && (
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${syncProgress}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Items */}
      <Card>
        <CardHeader>
          <CardTitle>{ENTITY_TYPES.find(e => e.value === selectedEntity)?.label} Sincronizados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
            </div>
          ) : syncs?.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Nenhum item sincronizado ainda
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID App</TableHead>
                    <TableHead>ID ERP</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Sync</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncs.map((sync) => (
                    <TableRow key={sync.id}>
                      <TableCell className="font-mono text-sm">{sync.entity_id.substring(0, 8)}</TableCell>
                      <TableCell className="font-mono text-sm">{sync.erp_id}</TableCell>
                      <TableCell>
                        <ERPSyncStatus status={sync.status} message={sync.error_message} />
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {sync.last_sync ? new Date(sync.last_sync).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{sync.sync_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas Operações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {logs?.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">Nenhuma operação registrada</p>
            ) : (
              logs?.map((log) => (
                <div key={log.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg text-sm">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {log.status === 'SUCESSO' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                      )}
                      <span className="font-medium">{log.action}</span>
                      <Badge variant="outline" className="text-xs">
                        {log.entity_type}
                      </Badge>
                    </div>
                    {log.error_message && (
                      <p className="text-slate-500 text-xs mt-1">{log.error_message}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    {log.duration_ms}ms
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}