import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Package, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';

export default function BOMDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const bomId = urlParams.get('id');
  const queryClient = useQueryClient();

  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({ selectedComponent: null, quantity: 1, sequence: 1, routes: [] });

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
      const newVersionNumber = (versions[0]?.version_number || 0) + 1;
      const newVersion = await base44.entities.BOMVersion.create({
        company_id: bom.company_id,
        bom_id: bomId,
        version_number: newVersionNumber,
        is_active: true,
        effective_date: new Date().toISOString().split('T')[0]
      });

      // Desativar versões antigas
      for (const v of versions) {
        await base44.entities.BOMVersion.update(v.id, { is_active: false });
      }

      // Atualizar BOM com nova versão
      await base44.entities.BOM.update(bomId, {
        current_version_id: newVersion.id,
        current_version_number: newVersionNumber
      });

      return newVersion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bom-versions']);
      queryClient.invalidateQueries(['bom']);
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
        routes: data.routes
      };

      // Compatibilidade: se houver roteiros, manter o primeiro como route_id
      if (data.routes.length > 0) {
        itemData.route_id = data.routes[0].route_id;
        itemData.route_name = data.routes[0].route_name;
      }

      return base44.entities.BOMItem.create(itemData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bom-items']);
      setShowAddItemDialog(false);
      setNewItem({ selectedComponent: null, quantity: 1, sequence: 1, routes: [] });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }) => {
      const itemData = {
        quantity: data.quantity,
        sequence: data.sequence,
        routes: data.routes
      };

      // Compatibilidade: se houver roteiros, manter o primeiro como route_id
      if (data.routes.length > 0) {
        itemData.route_id = data.routes[0].route_id;
        itemData.route_name = data.routes[0].route_name;
      } else {
        itemData.route_id = null;
        itemData.route_name = null;
      }

      return base44.entities.BOMItem.update(itemId, itemData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bom-items']);
      setShowEditItemDialog(false);
      setEditingItem(null);
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId) => base44.entities.BOMItem.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries(['bom-items']);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: () => base44.entities.BOM.update(bomId, { is_active: !bom.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries(['bom', bomId]);
    }
  });

  if (!bom) return <div className="p-8">Carregando...</div>;

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
        <Button onClick={() => createVersionMutation.mutate()}>
          Nova Versão
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Versão Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {bom.current_version_number || '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total de Itens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {bom.is_active ? (
              <Badge className="bg-green-100 text-green-800">Ativo</Badge>
            ) : (
              <Badge variant="outline">Inativo</Badge>
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
                      <div className="text-sm text-slate-500">
                        SKU: {item.component_sku} • Qtd: {item.quantity} {item.unit}
                        {Array.isArray(item.routes) && item.routes.length > 0 && (
                          <> • Roteiros: {item.routes.map((r, i) => `${i + 1}. ${r.route_name}`).join(', ')}</>
                        )}
                        {(!Array.isArray(item.routes) || item.routes.length === 0) && item.route_name && <> • Roteiro: {item.route_name}</>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingItem({
                          id: item.id,
                          quantity: item.quantity,
                          sequence: item.sequence,
                          routes: Array.isArray(item.routes) ? item.routes : []
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
    </div>
  );
}