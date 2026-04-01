import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { RotateCcw, LogOut } from 'lucide-react';
import { toast } from 'sonner';

const changeTypeIcons = {
  manual: '✏️ Manual',
  automated_by_test: '🤖 Automático',
  rollback: '↩️ Reversão'
};

const changeTypeColors = {
  manual: 'bg-blue-100 text-blue-800',
  automated_by_test: 'bg-green-100 text-green-800',
  rollback: 'bg-orange-100 text-orange-800'
};

export default function ConfigurationHistory() {
  const [filterConfig, setFilterConfig] = useState('all');
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['config-history'],
    queryFn: () => base44.entities.ConfigurationHistory.list('-created_date', 500),
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['system-configs'],
    queryFn: () => base44.entities.SystemConfiguration.list('-created_date', 1000),
  });

  const rollbackMutation = useMutation({
    mutationFn: async (historyRecord) => {
      const config = configs.find(c => c.id === historyRecord.config_id);
      if (!config) throw new Error('Configuração não encontrada');

      // Revert config to old value
      await base44.entities.SystemConfiguration.update(config.id, {
        value: historyRecord.old_value
      });

      // Register rollback
      await base44.entities.ConfigurationHistory.create({
        config_id: config.id,
        config_key: historyRecord.config_key,
        old_value: historyRecord.new_value,
        new_value: historyRecord.old_value,
        change_type: 'rollback',
        reason: `Reversão do histórico de ${new Date(historyRecord.created_date).toLocaleString('pt-BR')}`,
        version: (historyRecord.version || 0) + 1
      });

      // Mark original as rolled back
      await base44.entities.ConfigurationHistory.update(historyRecord.id, {
        status: 'rolled_back'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-history'] });
      queryClient.invalidateQueries({ queryKey: ['system-configs'] });
      toast.success('Configuração revertida com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao reverter: ' + error.message);
    }
  });

  const uniqueConfigs = [...new Set(history.map(h => h.config_key))];
  
  const filteredHistory = filterConfig === 'all'
    ? history
    : history.filter(h => h.config_key === filterConfig);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold">Histórico de Configurações</h1>
        <p className="text-gray-500 mt-2">Revise todas as mudanças e reverta quando necessário</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button 
          variant={filterConfig === 'all' ? 'default' : 'outline'}
          onClick={() => setFilterConfig('all')}
          size="sm"
        >
          Todas as Configs
        </Button>
        {uniqueConfigs.map(key => (
          <Button
            key={key}
            variant={filterConfig === key ? 'default' : 'outline'}
            onClick={() => setFilterConfig(key)}
            size="sm"
            className="text-xs"
          >
            {key}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Carregando histórico...</div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Nenhum histórico encontrado</div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((record) => (
            <Card key={record.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{record.config_key}</span>
                      <Badge className={changeTypeColors[record.change_type]}>
                        {changeTypeIcons[record.change_type]}
                      </Badge>
                      <Badge variant={record.status === 'rolled_back' ? 'destructive' : 'outline'}>
                        {record.status === 'applied' ? 'Aplicado' : 'Revertido'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Valor Anterior:</span>
                        <div className="bg-red-50 rounded p-2 font-mono text-xs mt-1 break-all">
                          {record.old_value}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Novo Valor:</span>
                        <div className="bg-green-50 rounded p-2 font-mono text-xs mt-1 break-all">
                          {record.new_value}
                        </div>
                      </div>
                    </div>

                    {record.reason && (
                      <div className="text-sm text-gray-600">
                        <span className="text-gray-500">Motivo: </span>
                        {record.reason}
                      </div>
                    )}

                    {record.changed_by && (
                      <div className="text-xs text-gray-500">
                        Alterado por: {record.changed_by} em {new Date(record.created_date).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>

                  {record.status === 'applied' && record.change_type !== 'rollback' && (
                    <RollbackDialog 
                      record={record} 
                      onRollback={() => rollbackMutation.mutate(record)}
                      isPending={rollbackMutation.isPending}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RollbackDialog({ record, onRollback, isPending }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw className="w-4 h-4 mr-2" />
          Reverter
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Reverter Configuração?</AlertDialogTitle>
        <AlertDialogDescription>
          Isso vai mudar o valor de <strong>{record.config_key}</strong> de <code>{record.new_value}</code> de volta para <code>{record.old_value}</code>.
        </AlertDialogDescription>
        <div className="flex gap-2 justify-end mt-4">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onRollback}
            disabled={isPending}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reverter Agora
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}