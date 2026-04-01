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
import { Edit2, Plus, Save } from 'lucide-react';

const CATEGORIES = ['vendas', 'producao', 'estoque', 'servico', 'geral'];
const TYPES = ['string', 'number', 'boolean', 'json'];

const categoryColors = {
  vendas: 'bg-blue-100 text-blue-800',
  producao: 'bg-orange-100 text-orange-800',
  estoque: 'bg-green-100 text-green-800',
  servico: 'bg-purple-100 text-purple-800',
  geral: 'bg-gray-100 text-gray-800'
};

export default function SystemConfiguration() {
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [filterCategory, setFilterCategory] = useState('all');
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['system-configs'],
    queryFn: () => base44.entities.SystemConfiguration.list('-created_date', 1000),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, value, type }) => {
      const parsedValue = type === 'json' ? JSON.stringify(JSON.parse(value)) : value;
      return base44.entities.SystemConfiguration.update(id, { value: parsedValue });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-configs'] });
      setEditingId(null);
      setEditValues({});
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SystemConfiguration.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-configs'] });
      setEditValues({});
    }
  });

  const filteredConfigs = filterCategory === 'all' 
    ? configs 
    : configs.filter(c => c.category === filterCategory);

  const handleSave = (config) => {
    updateMutation.mutate({
      id: config.id,
      value: editValues[config.id],
      type: config.type
    });
  };

  const handleCreateNew = (newConfig) => {
    createMutation.mutate(newConfig);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
          <p className="text-gray-500 mt-2">Parâmetros globais que afetam todo o sistema</p>
        </div>
        <CreateConfigDialog onCreate={handleCreateNew} />
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button 
          variant={filterCategory === 'all' ? 'default' : 'outline'}
          onClick={() => setFilterCategory('all')}
          size="sm"
        >
          Todas
        </Button>
        {CATEGORIES.map(cat => (
          <Button
            key={cat}
            variant={filterCategory === cat ? 'default' : 'outline'}
            onClick={() => setFilterCategory(cat)}
            size="sm"
            className="capitalize"
          >
            {cat}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Carregando configurações...</div>
      ) : (
        <div className="grid gap-4">
          {filteredConfigs.map(config => (
            <Card key={config.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{config.label}</h3>
                      <Badge className={categoryColors[config.category]}>
                        {config.category}
                      </Badge>
                      <Badge variant="outline">{config.type}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{config.description}</p>
                    
                    {editingId === config.id ? (
                      <div className="space-y-2">
                        {config.type === 'boolean' ? (
                          <Select 
                            value={editValues[config.id] || config.value}
                            onValueChange={(val) => setEditValues({...editValues, [config.id]: val})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Verdadeiro</SelectItem>
                              <SelectItem value="false">Falso</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : config.type === 'json' ? (
                          <Textarea
                            value={editValues[config.id] || config.value}
                            onChange={(e) => setEditValues({...editValues, [config.id]: e.target.value})}
                            className="font-mono text-sm"
                            rows={5}
                          />
                        ) : (
                          <Input
                            type={config.type === 'number' ? 'number' : 'text'}
                            value={editValues[config.id] || config.value}
                            onChange={(e) => setEditValues({...editValues, [config.id]: e.target.value})}
                          />
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => handleSave(config)}
                            disabled={updateMutation.isPending}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setEditValues({});
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded p-3 font-mono text-sm break-all">
                        {config.value}
                      </div>
                    )}
                  </div>
                  
                  {editingId !== config.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingId(config.id);
                        setEditValues({...editValues, [config.id]: config.value});
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
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

function CreateConfigDialog({ onCreate }) {
  const [open, setOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({
    key: '',
    label: '',
    value: '',
    type: 'string',
    category: 'geral',
    description: ''
  });

  const handleCreate = () => {
    onCreate(formData);
    setFormData({
      key: '',
      label: '',
      value: '',
      type: 'string',
      category: 'geral',
      description: ''
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nova Configuração
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Nova Configuração</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Chave (key)</Label>
            <Input
              value={formData.key}
              onChange={(e) => setFormData({...formData, key: e.target.value})}
              placeholder="ex: max_items_per_page"
            />
          </div>
          <div>
            <Label>Rótulo</Label>
            <Input
              value={formData.label}
              onChange={(e) => setFormData({...formData, label: e.target.value})}
              placeholder="ex: Máximo de itens por página"
            />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor</Label>
            <Input
              type={formData.type === 'number' ? 'number' : 'text'}
              value={formData.value}
              onChange={(e) => setFormData({...formData, value: e.target.value})}
              placeholder="Digite o valor"
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Descreva para que serve esta configuração"
              rows={3}
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button onClick={handleCreate} className="flex-1">Criar</Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}