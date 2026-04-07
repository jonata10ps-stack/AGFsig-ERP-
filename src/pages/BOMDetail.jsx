import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Package, Pencil, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';
import { toast } from 'sonner';

export default function BOMDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const bomId = urlParams.get('id');
  const queryClient = useQueryClient();

  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({ selectedComponent: null, quantity: 1, sequence: 1, routes: [] });
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ active: true })
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: () => base44.entities.ProductionRoute.filter({ active: true })
  });

  const { data: bom } = useQuery({
    queryKey: ['bom', bomId],
    queryFn: async () => {
      if (!bomId) return null;
      // Tentar buscar direto pelo ID para ser mais eficiente
      const result = await base44.entities.BOM.list();
      return result.find(b => b.id === bomId);
    },
    enabled: !!bomId
  });

  const { data: versions = [] } = useQuery({
    queryKey: ['bom-versions', bomId],
    queryFn: () => base44.entities.BOMVersion.filter({ bom_id: bomId }, '-version_number'),
    enabled: !!bomId
  });

  const activeVersion = versions.find(v => v.is_active) || versions[0];

  const { data: items = [] } = useQuery({
    queryKey: ['bom-items', activeVersion?.id],
    queryFn: () => activeVersion?.id ? base44.entities.BOMItem.filter({ bom_version_id: activeVersion.id }, 'sequence') : Promise.resolve([]),
    enabled: !!activeVersion?.id
  });

  const createVersionMutation = useMutation({
    mutationFn: async () => {
      // 1. Obter versão ativa e seus itens antes de criar a nova
      const currentActiveVersion = versions.find(v => v.is_active) || versions[0];
      let itemsToClone = [];
      if (currentActiveVersion) {
        itemsToClone = await base44.entities.BOMItem.listAll({ bom_version_id: currentActiveVersion.id });
      }

      // 2. Criar nova versão
      const newVersionNumber = (versions[0]?.version_number || 0) + 1;
      const newVersion = await base44.entities.BOMVersion.create({
        company_id: bom.company_id,
        bom_id: bomId,
        version_number: newVersionNumber,
        is_active: true,
        effective_date: new Date().toISOString().split('T')[0]
      });

      // 3. Clonar os itens se existirem
      if (itemsToClone && itemsToClone.length > 0) {
        const clonedItems = itemsToClone.map(item => {
          const newItem = { ...item };
          delete newItem.id;
          delete newItem.created_at;
          delete newItem.created_date;
          delete newItem.registered_date;
          newItem.bom_version_id = newVersion.id;
          return newItem;
        });
        await base44.entities.BOMItem.bulkCreate(clonedItems);
      }

      // 4. Desativar versões antigas
      for (const v of versions) {
        await base44.entities.BOMVersion.update(v.id, { is_active: false });
      }

      // 5. Atualizar BOM com nova versão
      await base44.entities.BOM.update(bomId, {
        current_version_id: newVersion.id,
        current_version_number: newVersionNumber
      });

      return newVersion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-versions'] });
      queryClient.invalidateQueries({ queryKey: ['bom'] });
      queryClient.invalidateQueries({ queryKey: ['bom-items'] });
      setShowNewVersionDialog(false);
      toast.success('Nova versão criada com sucesso com todos os itens clonados!');
    },
    onError: (error) => {
      toast.error('Erro ao criar nova versão: ' + error.message);
    }
  });

  const addItemMutation = useMutation({
    mutationFn: async (data) => {
      const component = data.selectedComponent;
      const itemData = {
        company_id: bom?.company_id,
        bom_id: bomId,
        bom_version_id: activeVersion?.id,
        component_id: component.id,
        component_sku: component.sku,
        component_name: component.name,
        quantity: data.quantity,
        sequence: data.sequence,
        unit: component.unit || 'UN',
        routes: Array.isArray(data.routes) ? JSON.stringify(data.routes) : data.routes
      };

      // Compatibilidade: se houver roteiros, manter o primeiro como route_id
      const routesArray = Array.isArray(data.routes) ? data.routes : [];
      if (routesArray.length > 0) {
        itemData.route_id = routesArray[0].route_id || null;
        itemData.route_name = routesArray[0].route_name || null;
      } else {
        itemData.route_id = null;
        itemData.route_name = null;
      }

      return base44.entities.BOMItem.create(itemData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-items'] });
      setShowAddItemDialog(false);
      setNewItem({ selectedComponent: null, quantity: 1, sequence: 1, routes: [] });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }) => {
      console.log('📝 Tentando atualizar item:', itemId, data);
      
      const itemData = {
        quantity: data.quantity,
        sequence: data.sequence,
        // Garantir que routes seja enviado como string se a coluna for do tipo TEXT no banco
        routes: Array.isArray(data.routes) ? JSON.stringify(data.routes) : data.routes
      };

      // Compatibilidade: se houver roteiros, manter o primeiro como route_id (UUID)
      const routesArray = Array.isArray(data.routes) ? data.routes : [];
      if (routesArray.length > 0) {
        itemData.route_id = routesArray[0].route_id || null;
        itemData.route_name = routesArray[0].route_name || null;
      } else {
        itemData.route_id = null;
        itemData.route_name = null;
      }

      console.log('📤 Dados enviados ao banco:', itemData);
      
      const result = await base44.entities.BOMItem.update(itemId, itemData);
      console.log('✅ Resultado do banco:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('🎉 Update sucesso:', data);
      queryClient.invalidateQueries({ queryKey: ['bom-items'] });
      toast.success('Item atualizado com sucesso');
      setShowEditItemDialog(false);
      setEditingItem(null);
    },
    onError: (error) => {
      console.error('❌ Erro no update do item:', error);
      toast.error('Erro ao salvar: ' + (error.message || 'Verifique o console'));
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId) => base44.entities.BOMItem.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-items'] });
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async () => {
      const newStatus = !bom.is_active;
      return await base44.entities.BOM.update(bomId, { is_active: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', bomId] });
      toast.success(bom.is_active ? 'BOM inativado' : 'BOM ativado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status do BOM: ' + error.message);
    }
  });

  const updateVersionMutation = useMutation({
    mutationFn: async (data) => {
      if (!activeVersion?.id) return;
      const payload = {
        routes: Array.isArray(data.routes) ? JSON.stringify(data.routes) : data.routes
      };
      return await base44.entities.BOMVersion.update(activeVersion.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-versions'] });
      toast.success('Roteiros do produto final atualizados');
    },
    onError: (error) => {
      toast.error('Erro ao salvar roteiros da versão: ' + error.message);
    }
  });

  if (!bom) return <div className="p-8">Carregando...</div>;

  // Extrair roteiros da versão ativa para o componente
  let versionRoutes = [];
  try {
    if (activeVersion?.routes) {
      versionRoutes = typeof activeVersion.routes === 'string' 
        ? JSON.parse(activeVersion.routes) 
        : activeVersion.routes;
    }
  } catch (e) {
    console.error('Erro ao parsear roteiros da versão:', e);
  }
  if (!Array.isArray(versionRoutes)) versionRoutes = [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('BOMs')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900">{bom.product_name}</h1>
          <p className="text-slate-500">SKU: {bom.product_sku}</p>
        </div>
        <Button 
          variant={bom.is_active ? "outline" : "default"}
          onClick={() => toggleActiveMutation.mutate()}
          disabled={toggleActiveMutation.isPending}
        >
          {bom.is_active ? 'Inativar' : 'Ativar'}
        </Button>
        <Button onClick={() => setShowNewVersionDialog(true)}>
          Nova Versão
        </Button>
      </div>

      {createVersionMutation.isPending && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl border flex flex-col items-center gap-4">
            <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="font-bold text-lg">Criando Nova Versão...</p>
              <p className="text-sm text-slate-500">Clonando itens da versão anterior</p>
            </div>
          </div>
        </div>
      )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="col-span-1 border-indigo-100 bg-indigo-50/5">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-600" />
              Versão Ativa
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="text-2xl font-bold text-indigo-900 overflow-hidden text-ellipsis whitespace-nowrap">
              v{activeVersion?.version_number || '-'}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {bom.is_active ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Ativa</Badge>
              ) : (
                <Badge variant="outline" className="text-slate-400">Inativa</Badge>
              )}
              <span className="text-[10px] text-slate-400">
                {activeVersion?.effective_date ? new Date(activeVersion.effective_date).toLocaleDateString() : ''}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-3 border-emerald-100 bg-emerald-50/5">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ArrowLeft className="h-4 w-4 text-emerald-600 rotate-180" />
                Roteiros do Produto Principal
              </CardTitle>
              <p className="text-[10px] text-slate-500 mt-0.5">Etapas de montagem final para {bom.product_name}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-emerald-700 hover:bg-emerald-100 gap-1 px-2"
              onClick={() => {
                const updatedRoutes = [...versionRoutes, { route_id: '', route_name: '', sequence: versionRoutes.length + 1 }];
                updateVersionMutation.mutate({ routes: updatedRoutes });
              }}
            >
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </CardHeader>
          <CardContent className="py-2 px-4">
            {versionRoutes.length === 0 ? (
              <div className="py-3 text-center border border-dashed border-emerald-200 rounded-lg">
                <p className="text-[11px] text-slate-400 italic">Nenhum roteiro de montagem final cadastrado.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 py-1">
                {versionRoutes.map((route, idx) => (
                  <div key={idx} className="flex items-center bg-white border border-emerald-100 shadow-sm rounded-md px-2 py-1 gap-2 group transition-all hover:border-emerald-300">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 h-5 w-5 rounded-full flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <select
                      className="bg-transparent border-none text-xs focus:ring-0 p-0 h-auto w-32 cursor-pointer font-medium text-slate-700"
                      value={route.route_id}
                      onChange={(e) => {
                        const sel = routes.find(r => r.id === e.target.value);
                        const updated = [...versionRoutes];
                        updated[idx] = { ...updated[idx], route_id: sel?.id, route_name: sel?.name };
                        updateVersionMutation.mutate({ routes: updated });
                      }}
                    >
                      <option value="">Selecionar...</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <button 
                      className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      onClick={() => {
                        const updated = versionRoutes.filter((_, i) => i !== idx);
                        updateVersionMutation.mutate({ routes: updated });
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Componentes</CardTitle>
            <Button onClick={() => setShowAddItemDialog(true)} disabled={!activeVersion}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>Nenhum componente cadastrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-500 w-8">#{item.sequence}</div>
                    <div>
                      <div className="font-medium">{item.component_name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        SKU: {item.component_sku || ''}
                        {(!item.component_sku && item.product_sku) ? item.product_sku : ''}
                        {item.unit && ` • Unidade: ${item.unit}`}
                        {(() => {
                          const routes = typeof item.routes === 'string' ? JSON.parse(item.routes || '[]') : (Array.isArray(item.routes) ? item.routes : []);
                          if (routes.length > 0) {
                            return <> • Roteiros: {routes.map((r, i) => `${i + 1}. ${r.route_name}`).join(', ')}</>;
                          }
                          if (item.route_name) {
                            return <> • Roteiro: {item.route_name}</>;
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        let existingRoutes = [];
                        try {
                          existingRoutes = typeof item.routes === 'string' ? JSON.parse(item.routes || '[]') : (Array.isArray(item.routes) ? item.routes : []);
                        } catch (e) {
                          console.warn('Erro ao parsear routes:', e);
                        }

                        const defaultRoutes = (existingRoutes.length === 0 && item.route_id) 
                          ? [{ route_id: item.route_id, route_name: item.route_name || 'Roteiro Atual', sequence: 1 }]
                          : existingRoutes;
                          
                        setEditingItem({
                          id: item.id,
                          quantity: item.quantity,
                          sequence: item.sequence,
                          component_name: item.component_name,
                          routes: defaultRoutes
                        });
                        setShowEditItemDialog(true);
                      }}
                    >
                      <Pencil className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteItemMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEditItemDialog} onOpenChange={setShowEditItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Item do BOM</DialogTitle>
            <div className="text-xs text-slate-500 mt-1">
              Configure os roteiros e detalhes do item selecionado.
            </div>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 pt-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Roteiros Sequenciais</label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingItem({
                        ...editingItem,
                        routes: [...editingItem.routes, { route_id: '', route_name: '', sequence: editingItem.routes.length + 1 }]
                      });
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar Roteiro
                  </Button>
                </div>
                {editingItem.routes.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Nenhum roteiro adicionado</p>
                ) : (
                  <div className="space-y-2">
                    {editingItem.routes.map((route, index) => (
                      <div key={index} className="flex gap-2 items-start p-2 border rounded">
                        <div className="text-sm font-medium w-6 pt-2">#{index + 1}</div>
                        <select
                          className="flex-1 h-9 px-3 rounded-md border border-input bg-transparent text-sm"
                          value={route.route_id}
                          onChange={(e) => {
                            const selectedRoute = routes.find(r => r.id === e.target.value);
                            const updatedRoutes = [...editingItem.routes];
                            updatedRoutes[index] = {
                              route_id: selectedRoute?.id || '',
                              route_name: selectedRoute?.name || '',
                              sequence: index + 1
                            };
                            setEditingItem({ ...editingItem, routes: updatedRoutes });
                          }}
                        >
                          <option value="">Selecione um roteiro</option>
                          {routes.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.code} - {r.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const updatedRoutes = editingItem.routes.filter((_, i) => i !== index);
                            setEditingItem({ ...editingItem, routes: updatedRoutes });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Quantidade</label>
                  <Input
                    type="number"
                    value={editingItem.quantity}
                    onChange={(e) => setEditingItem({ ...editingItem, quantity: parseFloat(e.target.value) })}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Sequência</label>
                  <Input
                    type="number"
                    value={editingItem.sequence}
                    onChange={(e) => setEditingItem({ ...editingItem, sequence: parseInt(e.target.value) })}
                    min="1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditItemDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => updateItemMutation.mutate({ itemId: editingItem.id, data: editingItem })}
                  disabled={updateItemMutation.isPending}
                >
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Componente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Componente</label>
              <ProductSearchSelect
                value={newItem.selectedComponent?.id}
                onSelect={(productId, product) => {
                  setNewItem({ ...newItem, selectedComponent: product || null });
                }}
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Roteiros Sequenciais</label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNewItem({
                      ...newItem,
                      routes: [...newItem.routes, { route_id: '', route_name: '', sequence: newItem.routes.length + 1 }]
                    });
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar Roteiro
                </Button>
              </div>
              {newItem.routes.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Nenhum roteiro adicionado</p>
              ) : (
                <div className="space-y-2">
                  {newItem.routes.map((route, index) => (
                    <div key={index} className="flex gap-2 items-start p-2 border rounded">
                      <div className="text-sm font-medium w-6 pt-2">#{index + 1}</div>
                      <select
                        className="flex-1 h-9 px-3 rounded-md border border-input bg-transparent text-sm"
                        value={route.route_id}
                        onChange={(e) => {
                          const selectedRoute = routes.find(r => r.id === e.target.value);
                          const updatedRoutes = [...newItem.routes];
                          updatedRoutes[index] = {
                            route_id: selectedRoute?.id || '',
                            route_name: selectedRoute?.name || '',
                            sequence: index + 1
                          };
                          setNewItem({ ...newItem, routes: updatedRoutes });
                        }}
                      >
                        <option value="">Selecione um roteiro</option>
                        {routes.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.code} - {r.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          const updatedRoutes = newItem.routes.filter((_, i) => i !== index);
                          setNewItem({ ...newItem, routes: updatedRoutes });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Quantidade</label>
                <Input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Sequência</label>
                <Input
                  type="number"
                  value={newItem.sequence}
                  onChange={(e) => setNewItem({ ...newItem, sequence: parseInt(e.target.value) })}
                  min="1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => addItemMutation.mutate(newItem)}
                disabled={!newItem.selectedComponent || addItemMutation.isPending}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showNewVersionDialog} onOpenChange={setShowNewVersionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Nova Versão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-600">
              Você está prestes a criar a <strong>Versão {(versions[0]?.version_number || 0) + 1}</strong> deste BOM.
            </p>
            <p className="text-sm text-slate-600">
              Todos os itens da versão atual serão clonados automaticamente para que você possa editá-los sem perder o histórico do BOM antigo.
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowNewVersionDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => createVersionMutation.mutate()}
                disabled={createVersionMutation.isPending}
              >
                Gerar Nova Versão
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}