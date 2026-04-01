import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CheckCircle2, AlertCircle, Clock, Play, Plus, Settings, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const TEST_TYPES = {
  type_validation: 'Validação de Tipo',
  business_rule: 'Regra de Negócio',
  range_validation: 'Validação de Intervalo',
  pattern_validation: 'Validação de Padrão'
};

const statusIcons = {
  passed: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  failed: <AlertCircle className="w-4 h-4 text-red-600" />,
  pending: <Clock className="w-4 h-4 text-gray-400" />
};

export default function ConfigurationTesting() {
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['config-tests'],
    queryFn: () => base44.entities.ConfigurationTest.list('-created_date', 1000),
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['system-configs'],
    queryFn: () => base44.entities.SystemConfiguration.list('-created_date', 1000),
  });

  const runTestMutation = useMutation({
    mutationFn: async (test) => {
      const config = configs.find(c => c.id === test.config_id);
      if (!config) throw new Error('Configuração não encontrada');

      const rule = JSON.parse(test.validation_rule);
      let passed = false;

      switch (test.test_type) {
        case 'type_validation':
          passed = typeof config.value === rule.expectedType;
          break;
        case 'range_validation':
          const val = parseFloat(config.value);
          passed = val >= rule.minValue && val <= rule.maxValue;
          break;
        case 'pattern_validation':
          const regex = new RegExp(rule.pattern);
          passed = regex.test(config.value);
          break;
        case 'business_rule':
          passed = JSON.stringify(config.value) === JSON.stringify(rule.expectedValue);
          break;
        default:
          passed = false;
      }

      const result = passed ? 'passed' : 'failed';
      
      if (passed && test.auto_apply) {
        // Aplicar automaticamente
        if (test.expected_value && test.expected_value !== config.value) {
          await base44.entities.SystemConfiguration.update(config.id, {
            value: test.expected_value
          });

          await base44.entities.ConfigurationHistory.create({
            config_id: config.id,
            config_key: test.config_key,
            old_value: config.value,
            new_value: test.expected_value,
            change_type: 'automated_by_test',
            test_id: test.id,
            reason: `Aplicado automaticamente pelo teste: ${test.name}`,
            version: 1
          });
        }
      }

      await base44.entities.ConfigurationTest.update(test.id, {
        last_run: new Date().toISOString(),
        last_result: result
      });

      return { result, passed };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['config-tests'] });
      queryClient.invalidateQueries({ queryKey: ['system-configs'] });
      toast.success(data.passed ? 'Teste passou! ✓' : 'Teste falhou ✗');
    },
    onError: (error) => {
      toast.error('Erro ao executar teste: ' + error.message);
    }
  });

  const filteredTests = filterStatus === 'all' 
    ? tests 
    : tests.filter(t => t.last_result === filterStatus);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Testes de Configuração</h1>
          <p className="text-gray-500 mt-2">Valide e aplique automaticamente configurações</p>
        </div>
        <CreateTestDialog configs={configs} />
      </div>

      <div className="flex gap-2">
        <Button 
          variant={filterStatus === 'all' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('all')}
          size="sm"
        >
          Todos
        </Button>
        <Button 
          variant={filterStatus === 'passed' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('passed')}
          size="sm"
        >
          Passou ✓
        </Button>
        <Button 
          variant={filterStatus === 'failed' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('failed')}
          size="sm"
        >
          Falhou ✗
        </Button>
        <Button 
          variant={filterStatus === 'pending' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('pending')}
          size="sm"
        >
          Pendente
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Carregando testes...</div>
      ) : (
        <div className="grid gap-4">
          {filteredTests.map(test => (
            <Card key={test.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {statusIcons[test.last_result]}
                      <h3 className="font-semibold">{test.name}</h3>
                      <Badge variant="outline">{TEST_TYPES[test.test_type]}</Badge>
                      {test.auto_apply && (
                        <Badge className="bg-blue-100 text-blue-800">
                          Auto-apply
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{test.description}</p>
                    
                    <div className="space-y-2 text-sm">
                      <div className="bg-gray-50 rounded p-2">
                        <span className="text-gray-500">Config: </span>
                        <span className="font-mono">{test.config_key}</span>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <span className="text-gray-500">Regra: </span>
                        <span className="font-mono text-xs break-all">
                          {test.validation_rule}
                        </span>
                      </div>
                      {test.last_run && (
                        <div className="text-gray-500 text-xs">
                          Última execução: {new Date(test.last_run).toLocaleString('pt-BR')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => runTestMutation.mutate(test)}
                      disabled={runTestMutation.isPending}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Executar
                    </Button>
                    <EditTestDialog test={test} configs={configs} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTestDialog({ configs }) {
  const [open, setOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({
    config_id: '',
    config_key: '',
    name: '',
    description: '',
    test_type: 'type_validation',
    validation_rule: '{}',
    expected_value: '',
    auto_apply: false
  });
  const queryClient = React.useContext(React.createContext());

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ConfigurationTest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-tests'] });
      setFormData({
        config_id: '',
        config_key: '',
        name: '',
        description: '',
        test_type: 'type_validation',
        validation_rule: '{}',
        expected_value: '',
        auto_apply: false
      });
      setOpen(false);
      toast.success('Teste criado com sucesso!');
    }
  });

  const handleConfigChange = (configId) => {
    const config = configs.find(c => c.id === configId);
    if (config) {
      setFormData({
        ...formData,
        config_id: configId,
        config_key: config.key
      });
    }
  };

  const handleCreate = () => {
    try {
      JSON.parse(formData.validation_rule);
      createMutation.mutate({
        ...formData,
        validation_rule: formData.validation_rule
      });
    } catch {
      toast.error('Regra JSON inválida');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Teste
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Teste</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Configuração</Label>
            <Select value={formData.config_id} onValueChange={handleConfigChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma configuração" />
              </SelectTrigger>
              <SelectContent>
                {configs.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label} ({c.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nome do Teste</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="ex: Validar máximo de itens"
            />
          </div>
          <div>
            <Label>Tipo de Teste</Label>
            <Select value={formData.test_type} onValueChange={(val) => setFormData({...formData, test_type: val})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TEST_TYPES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Regra de Validação (JSON)</Label>
            <Textarea
              value={formData.validation_rule}
              onChange={(e) => setFormData({...formData, validation_rule: e.target.value})}
              className="font-mono text-sm"
              rows={3}
              placeholder='{"minValue": 1, "maxValue": 100}'
            />
          </div>
          <div>
            <Label>Valor Esperado (Opcional)</Label>
            <Input
              value={formData.expected_value}
              onChange={(e) => setFormData({...formData, expected_value: e.target.value})}
              placeholder="Valor a aplicar se teste passar"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto_apply"
              checked={formData.auto_apply}
              onChange={(e) => setFormData({...formData, auto_apply: e.target.checked})}
            />
            <Label htmlFor="auto_apply" className="cursor-pointer">Aplicar automaticamente se passar?</Label>
          </div>
          <div className="flex gap-2 pt-4">
            <Button onClick={handleCreate} className="flex-1" disabled={!formData.config_id}>Criar</Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditTestDialog({ test, configs }) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ConfigurationTest.update(test.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-tests'] });
      setOpen(false);
      toast.success('Teste atualizado!');
    }
  });

  const toggleAutoApply = () => {
    updateMutation.mutate({ auto_apply: !test.auto_apply });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{test.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Descrição</Label>
            <p className="text-sm text-gray-600">{test.description}</p>
          </div>
          <div>
            <Label>Tipo</Label>
            <p className="text-sm">{TEST_TYPES[test.test_type]}</p>
          </div>
          <div>
            <Label>Status</Label>
            <Badge className={test.last_result === 'passed' ? 'bg-green-100 text-green-800' : test.last_result === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}>
              {test.last_result}
            </Badge>
          </div>
          <div>
            <button
              className="w-full px-4 py-2 border rounded flex items-center justify-between hover:bg-gray-50"
              onClick={toggleAutoApply}
            >
              <span>Auto-apply em Produção</span>
              <input type="checkbox" checked={test.auto_apply} readOnly />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}