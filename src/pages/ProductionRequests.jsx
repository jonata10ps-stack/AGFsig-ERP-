import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Plus, Search, Edit2, Trash2, MoreHorizontal, Factory, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  PENDENTE: { color: 'bg-slate-100 text-slate-700', label: 'Pendente' },
  EM_PRODUCAO: { color: 'bg-amber-100 text-amber-700', label: 'Em Produção' },
  PARCIAL: { color: 'bg-blue-100 text-blue-700', label: 'Parcialmente Atendida' },
  CONCLUIDA: { color: 'bg-emerald-100 text-emerald-700', label: 'Concluída' },
  CANCELADA: { color: 'bg-rose-100 text-rose-700', label: 'Cancelada' },
};

const PRIORITY_CONFIG = {
  BAIXA: { color: 'bg-slate-100 text-slate-700', label: 'Baixa' },
  NORMAL: { color: 'bg-blue-100 text-blue-700', label: 'Normal' },
  ALTA: { color: 'bg-amber-100 text-amber-700', label: 'Alta' },
  URGENTE: { color: 'bg-rose-100 text-rose-700', label: 'Urgente' },
};

function RequestForm({ request, products, onSave, onCancel, loading, readOnly = false }) {
  const [form, setForm] = useState(request || {
    product_id: '',
    product_name: '',
    qty_requested: 1,
    qty_fulfilled: 0,
    qty_residue: 0,
    priority: 'NORMAL',
    origin_type: 'MANUAL',
    due_date: '',
    notes: '',
    status: 'PENDENTE'
  });

  const handleProductChange = (productId) => {
    const product = products?.find(p => p.id === productId);
    setForm({ ...form, product_id: productId, product_name: product?.name || '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.product_id || form.qty_requested <= 0) {
      toast.error('Produto e quantidade são obrigatórios');
      return;
    }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Produto *</Label>
        <Select value={form.product_id} onValueChange={handleProductChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um produto" />
          </SelectTrigger>
          <SelectContent>
            {products?.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Quantidade Solicitada *</Label>
          <Input
            type="number"
            min="1"
            value={form.qty_requested}
            onChange={(e) => setForm({ ...form, qty_requested: parseFloat(e.target.value) || 0 })}
            disabled={readOnly || form.status !== 'PENDENTE'}
          />
        </div>
        <div className="space-y-2">
          <Label>Prioridade</Label>
          <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })} disabled={readOnly || form.status !== 'PENDENTE'}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.status === 'EM_PRODUCAO' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Quantidade Atendida</Label>
            <Input
              type="number"
              min="0"
              value={form.qty_fulfilled}
              onChange={(e) => setForm({ ...form, qty_fulfilled: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Resíduos/Perdas</Label>
            <Input
              type="number"
              min="0"
              value={form.qty_residue}
              onChange={(e) => setForm({ ...form, qty_residue: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Data Necessária</Label>
        <Input
          type="date"
          value={form.due_date}
          onChange={(e) => setForm({ ...form, due_date: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Observações sobre a solicitação"
          rows={3}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function ProductionRequests() {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyId();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['production-requests', companyId],
    queryFn: () => companyId ? base44.entities.ProductionRequest.listAll({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.listAll({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: ops } = useQuery({
    queryKey: ['production-orders', companyId],
    queryFn: () => companyId ? base44.entities.ProductionOrder.listAll({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => companyId ? base44.entities.Warehouse.listAll({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => companyId ? base44.entities.Location.listAll({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProductionRequest.create({ ...data, company_id: companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-requests', companyId] });
      setDialogOpen(false);
      toast.success('Solicitação criada com sucesso');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductionRequest.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-requests', companyId] });
      setDialogOpen(false);
      setEditing(null);
      toast.success('Solicitação atualizada com sucesso');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductionRequest.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-requests', companyId] });
      setDeleteConfirm(null);
      toast.success('Solicitação excluída com sucesso');
    },
  });

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [opDialogOpen, setOpDialogOpen] = useState(false);
  const [opExternalNumber, setOpExternalNumber] = useState('');
  const [opQuantity, setOpQuantity] = useState(0);
  const [opWarehouseId, setOpWarehouseId] = useState('');
  const [opLocationId, setOpLocationId] = useState('');
  const [warehouseLocations, setWarehouseLocations] = useState([]);
  const [clearResidueConfirm, setClearResidueConfirm] = useState(null);
  const [cancelRequestConfirm, setCancelRequestConfirm] = useState(null);

  const createOPMutation = useMutation({
    mutationFn: async ({ request, numeroOpExterno, quantidade, warehouseId, locationId }) => {
      if (!quantidade || quantidade <= 0) {
        throw new Error('Quantidade deve ser maior que zero');
      }

      const qtdDisponivel = request.qty_requested - (request.qty_fulfilled || 0);
      if (quantidade > qtdDisponivel) {
        throw new Error(`Quantidade excede o disponível (${qtdDisponivel})`);
      }

      if (!request.product_id) {
        throw new Error('ID do produto não encontrado na solicitação');
      }

      if (!warehouseId) {
        throw new Error('Armazém de destino é obrigatório');
      }

      const opNumber = `OP-${Date.now().toString().slice(-8)}`;

      // Buscar produto completo de forma direta e eficiente
      const product = await base44.entities.Product.get(request.product_id);

      if (!product) {
        throw new Error('Produto não encontrado no cadastro mestre');
      }

      const routeId = product.route_id;
       let routeName = '';

       if (routeId) {
         const route = await base44.entities.ProductionRoute.get(routeId);
         routeName = route?.name || '';
       } else {
         console.warn(`Produto ${product.name} não possui roteiro associado`);
       }

      const warehouse = warehouses?.find(w => w.id === warehouseId);
      const location = locations?.find(l => l.id === locationId);

      // Criar OP com a quantidade especificada
      const newOP = await base44.entities.ProductionOrder.create({
        company_id: companyId,
        op_number: opNumber,
        numero_op_externo: numeroOpExterno,
        request_id: request.id,
        product_id: request.product_id,
        product_name: request.product_name,
        route_id: routeId || null,
        route_name: routeName,
        qty_planned: quantidade,
        qty_produced: 0,
        qty_attended: quantidade,
        status: 'ABERTA',
        priority: request.priority,
        due_date: request.due_date,
        warehouse_id: warehouseId,
        warehouse_name: warehouse?.name || '',
        location_id: locationId || null,
        location_barcode: location?.barcode || ''
      });
      
      // Inicializar etapas a partir do BOM
      try {
        const boms = await base44.entities.BOM.filter({
          company_id: companyId,
          product_id: request.product_id,
          active: true
        });

        if (boms?.[0]) {
          const bom = boms[0];
          const bomItems = await base44.entities.BOMItem.filter({
            company_id: companyId,
            bom_version_id: bom.current_version_id
          });

          if (bomItems && bomItems.length > 0) {
            // Otimização: Coletar todos os IDs de roteiro de uma vez para evitar N chamadas ao banco
            const allRouteIds = new Set();
            bomItems.forEach(item => {
              if (item.route_id) allRouteIds.add(item.route_id);
              if (item.routes?.length) item.routes.forEach(r => { if (r.route_id) allRouteIds.add(r.route_id); });
            });

            // Carregar todos os passos de uma vez (bulk fetch)
            const routeIdsArray = Array.from(allRouteIds);
            let allRouteSteps = [];
            if (routeIdsArray.length > 0) {
              allRouteSteps = await base44.entities.ProductionRouteStep.filter({
                company_id: companyId,
                route_id: routeIdsArray // O filter do base44Client já suporta o operador 'in' para arrays
              });
            }

            const stepsToCreate = [];
            let globalSequence = 1;

            for (const bomItem of bomItems) {
              const currentItemRouteIds = [];
              if (bomItem.route_id) currentItemRouteIds.push(bomItem.route_id);
              if (bomItem.routes?.length) {
                bomItem.routes.forEach(r => { if (r.route_id) currentItemRouteIds.push(r.route_id); });
              }

              if (currentItemRouteIds.length === 0) {
                stepsToCreate.push({
                  company_id: companyId,
                  op_id: newOP.id,
                  sequence: globalSequence++,
                  name: `${bomItem.component_name}`,
                  description: `Componente: ${bomItem.component_sku}`,
                  status: 'PENDENTE'
                });
              } else {
                for (const rId of currentItemRouteIds) {
                  const relevantSteps = allRouteSteps.filter(rs => rs.route_id === rId);
                  for (const routeStep of relevantSteps) {
                    stepsToCreate.push({
                      company_id: companyId,
                      op_id: newOP.id,
                      sequence: globalSequence++,
                      name: routeStep.name,
                      description: `${bomItem.component_name} - ${routeStep.description || ''}`,
                      resource_type: routeStep.resource_type,
                      resource_id: routeStep.resource_id,
                      status: 'PENDENTE',
                      estimated_time: routeStep.estimated_time
                    });
                  }
                }
              }
            }

            if (stepsToCreate.length > 0) {
              await base44.entities.ProductionStep.bulkCreate(stepsToCreate);
            }
          }
        }
      } catch (err) {
        console.error('Erro ao inicializar etapas do BOM:', err);
      }
      
      // Atualizar solicitação
      const novaQtdAtendida = (request.qty_fulfilled || 0) + quantidade;
      const qtdPendente = request.qty_requested - novaQtdAtendida;
      
      let novoStatus = 'PENDENTE';
      if (qtdPendente > 0) {
        novoStatus = 'PARCIAL';
      } else if (qtdPendente === 0) {
        novoStatus = 'CONCLUIDA';
      }
      
      await base44.entities.ProductionRequest.update(request.id, {
        qty_fulfilled: novaQtdAtendida,
        status: novoStatus
      });
      
      return { op: newOP, qtdPendente };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['production-requests', companyId] });
      queryClient.invalidateQueries({ queryKey: ['production-orders', companyId] });
      setOpDialogOpen(false);
      setOpExternalNumber('');
      setOpQuantity(0);
      setOpWarehouseId('');
      setOpLocationId('');
      setWarehouseLocations([]);
      setSelectedRequest(null);

      if (data.qtdPendente > 0) {
        toast.success(`OP criada! Restam ${data.qtdPendente} un pendentes na solicitação`);
      } else {
        toast.success('OP criada e solicitação concluída');
      }
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const clearResidueMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductionRequest.update(id, { qty_residue: 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-requests', companyId] });
      setClearResidueConfirm(null);
      toast.success('Resíduos eliminados com sucesso');
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (requestId) => {
      // Buscar OP vinculada
      const linkedOPs = await base44.entities.ProductionOrder.filter({ request_id: requestId });
      
      // Desvincular OP
      if (linkedOPs && linkedOPs.length > 0) {
        await Promise.all(
          linkedOPs.map(op => 
            base44.entities.ProductionOrder.update(op.id, { 
              request_id: '',
              qty_attended: 0,
              qty_residue: 0
            })
          )
        );
      }
      
      // Atualizar solicitação
      await base44.entities.ProductionRequest.update(requestId, { 
        status: 'PENDENTE',
        qty_fulfilled: 0,
        qty_residue: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-requests', companyId] });
      queryClient.invalidateQueries({ queryKey: ['production-orders', companyId] });
      toast.success('Vínculo removido com sucesso');
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: async ({ requestId, cancelOPs }) => {
      const request = requests?.find(r => r.id === requestId);

      // Atualizar solicitação para CANCELADA
      await base44.entities.ProductionRequest.update(requestId, { status: 'CANCELADA' });

      // Se solicitado, cancelar OPs vinculadas
      if (cancelOPs) {
        const linkedOPs = await base44.entities.ProductionOrder.filter({ request_id: requestId });
        if (linkedOPs && linkedOPs.length > 0) {
          const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm');
          const nota = `[${timestamp}] Cancelamento de SC ${request?.id} - Pedido de origem: ${request?.order_number || 'N/A'} - Produto: ${request?.product_name} - Qtd. atendida: ${request?.qty_fulfilled || 0} un`;

          await Promise.all(
            linkedOPs.map(op => {
              const notasAtualizadas = op.notes ? `${op.notes}\n${nota}` : nota;
              return base44.entities.ProductionOrder.update(op.id, { 
                status: 'CANCELADA',
                cancellation_reason: 'Solicitação de produção cancelada',
                notes: notasAtualizadas
              });
            })
          );
        }
      } else {
        // Manter OP e registrar rastreio nas notas com dados do pedido
        const linkedOPs = await base44.entities.ProductionOrder.filter({ request_id: requestId });
        if (linkedOPs && linkedOPs.length > 0) {
          const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm');
          const nota = `[${timestamp}] SC ${request?.id} cancelada - Pedido de origem: ${request?.order_number || 'N/A'} - Produto: ${request?.product_name} - Qtd solicitada: ${request?.qty_requested} un - Qtd atendida: ${request?.qty_fulfilled || 0} un - Caminho reverso iniciado`;

          await Promise.all(
            linkedOPs.map(op => {
              const notasAtualizadas = op.notes ? `${op.notes}\n${nota}` : nota;
              return base44.entities.ProductionOrder.update(op.id, { notes: notasAtualizadas });
            })
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-requests', companyId] });
      queryClient.invalidateQueries({ queryKey: ['production-orders', companyId] });
      queryClient.invalidateQueries({ queryKey: ['production-requests-pending', companyId] });
      setCancelRequestConfirm(null);
      toast.success('Solicitação cancelada com sucesso');
    },
  });

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getLinkedOP = (requestId) => {
    return ops?.find(op => op.request_id === requestId);
  };

  const filtered = requests?.filter(r => {
    const matchesSearch = r.product_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Solicitações de Produção</h1>
          <p className="text-slate-500">Gerencie as solicitações de produção</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-2" />
          Nova Solicitação
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <Factory className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd Solicitada</TableHead>
                  <TableHead className="text-right">Qtd Atendida</TableHead>
                  <TableHead className="text-right">Qtd Pendente</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Data Necessária</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((request) => {
                   const qtdPendente = Math.max(0, request.qty_requested - (request.qty_fulfilled || 0));
                   const linkedOP = getLinkedOP(request.id);
                   return (
                     <TableRow key={request.id}>
                       <TableCell>
                         <div>
                           <p className="font-medium">{request.product_name}</p>
                           {linkedOP && (
                             <div className="flex items-center gap-1 mt-1">
                               <Factory className="h-3 w-3 text-blue-600" />
                               <p className="text-xs text-blue-600">
                                 OP: {linkedOP.numero_op_externo}
                               </p>
                             </div>
                           )}
                         </div>
                       </TableCell>
                       <TableCell className="text-right font-medium">{request.qty_requested}</TableCell>
                       <TableCell className="text-right font-medium text-emerald-600">{request.qty_fulfilled || 0}</TableCell>
                       <TableCell className="text-right font-medium text-amber-600">{qtdPendente}</TableCell>
                       <TableCell>
                         <Badge variant="outline">{request.origin_type}</Badge>
                       </TableCell>
                       <TableCell>
                         <Badge className={PRIORITY_CONFIG[request.priority]?.color}>
                           {PRIORITY_CONFIG[request.priority]?.label}
                         </Badge>
                       </TableCell>
                       <TableCell className="text-slate-500">
                         {request.due_date ? format(new Date(request.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                       </TableCell>
                       <TableCell>
                         <Badge className={STATUS_CONFIG[request.status]?.color}>
                           {STATUS_CONFIG[request.status]?.label}
                         </Badge>
                       </TableCell>
                       <TableCell>
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon">
                               <MoreHorizontal className="h-4 w-4" />
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                             {request.status === 'PENDENTE' && (
                               <>
                                 <DropdownMenuItem onClick={() => { 
                                   setSelectedRequest(request); 
                                   setOpQuantity(request.qty_requested);
                                   setOpDialogOpen(true); 
                                 }}>
                                   <Play className="h-4 w-4 mr-2" />
                                   Criar OP
                                 </DropdownMenuItem>
                                 <DropdownMenuItem onClick={() => { setEditing(request); setDialogOpen(true); }}>
                                   <Edit2 className="h-4 w-4 mr-2" />
                                   Editar
                                 </DropdownMenuItem>
                                 <DropdownMenuItem onClick={() => setDeleteConfirm(request)} className="text-red-600">
                                   <Trash2 className="h-4 w-4 mr-2" />
                                   Excluir
                                 </DropdownMenuItem>
                               </>
                             )}
                             {(request.status === 'EM_PRODUCAO' || request.status === 'PARCIAL') && (
                               <>
                                 <DropdownMenuItem onClick={() => { 
                                   setSelectedRequest(request); 
                                   const pendente = request.qty_requested - (request.qty_fulfilled || 0);
                                   setOpQuantity(pendente);
                                   setOpDialogOpen(true); 
                                 }}>
                                   <Play className="h-4 w-4 mr-2" />
                                   Criar Próxima OP
                                 </DropdownMenuItem>
                                 <DropdownMenuItem onClick={() => { setEditing(request); setDialogOpen(true); }}>
                                   <Edit2 className="h-4 w-4 mr-2" />
                                   Atualizar
                                 </DropdownMenuItem>
                                 {request.qty_residue > 0 && (
                                   <DropdownMenuItem onClick={() => setClearResidueConfirm(request)} className="text-amber-600">
                                     <Trash2 className="h-4 w-4 mr-2" />
                                     Eliminar Resíduos
                                   </DropdownMenuItem>
                                 )}
                                 <DropdownMenuItem 
                                   onClick={() => {
                                     if (window.confirm('Deseja desvincular esta solicitação da OP? A solicitação voltará ao status PENDENTE.')) {
                                       unlinkMutation.mutate(request.id);
                                     }
                                   }} 
                                   className="text-red-600"
                                 >
                                   <Trash2 className="h-4 w-4 mr-2" />
                                   Desvincular OP
                                 </DropdownMenuItem>
                                 <DropdownMenuItem onClick={() => setCancelRequestConfirm(request)} className="text-red-600">
                                   <Trash2 className="h-4 w-4 mr-2" />
                                   Cancelar Solicitação
                                 </DropdownMenuItem>
                               </>
                             )}
                             {request.status === 'PENDENTE' && (
                               <DropdownMenuItem onClick={() => setCancelRequestConfirm(request)} className="text-red-600">
                                 <Trash2 className="h-4 w-4 mr-2" />
                                 Cancelar Solicitação
                               </DropdownMenuItem>
                             )}
                           </DropdownMenuContent>
                         </DropdownMenu>
                       </TableCell>
                     </TableRow>
                   );
                 })}
                      </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>
               {editing ? (editing.status === 'EM_PRODUCAO' ? 'Registrar Atendimento' : 'Editar Solicitação') : 'Nova Solicitação'}
             </DialogTitle>
           </DialogHeader>
           <RequestForm
             request={editing}
             products={products}
             onSave={handleSave}
             onCancel={() => { setDialogOpen(false); setEditing(null); }}
             loading={createMutation.isPending || updateMutation.isPending}
           />
         </DialogContent>
       </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja excluir esta solicitação?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteConfirm.id)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={opDialogOpen} onOpenChange={setOpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar OP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">Produto</p>
              <p className="font-medium">{selectedRequest?.product_name}</p>
              <p className="text-sm text-slate-500 mt-2">Quantidade Solicitada</p>
              <p className="font-medium">{selectedRequest?.qty_requested}</p>
              {selectedRequest && (selectedRequest.qty_fulfilled || 0) > 0 && (
                <>
                  <p className="text-sm text-slate-500 mt-2">Já Atendido</p>
                  <p className="font-medium text-emerald-600">{selectedRequest.qty_fulfilled}</p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Número da OP Externa *</Label>
              <Input
                value={opExternalNumber}
                onChange={(e) => setOpExternalNumber(e.target.value.toUpperCase())}
                placeholder="Ex: OP-EXT-2024-001"
              />
            </div>

            <div className="space-y-2">
              <Label>Quantidade a Produzir nesta OP *</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                max={selectedRequest ? selectedRequest.qty_requested - (selectedRequest.qty_fulfilled || 0) : 1}
                value={opQuantity}
                onChange={(e) => setOpQuantity(parseFloat(e.target.value) || 0)}
                placeholder="Digite a quantidade"
                autoFocus
              />
              <div className="text-xs space-y-1">
                {selectedRequest && (
                  <>
                    <p className="text-slate-600">
                      Disponível: {selectedRequest.qty_requested - (selectedRequest.qty_fulfilled || 0)} un
                    </p>
                    {opQuantity > 0 && opQuantity < (selectedRequest.qty_requested - (selectedRequest.qty_fulfilled || 0)) && (
                      <p className="text-amber-600 font-medium">
                        ⚠ Ficará pendente: {((selectedRequest.qty_requested - (selectedRequest.qty_fulfilled || 0)) - opQuantity).toFixed(2)} un
                      </p>
                    )}
                    {opQuantity > 0 && opQuantity === (selectedRequest.qty_requested - (selectedRequest.qty_fulfilled || 0)) && (
                      <p className="text-emerald-600 font-medium">
                        ✓ Atenderá toda a solicitação
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Armazém de Destino *</Label>
                <Select 
                  value={opWarehouseId} 
                  onValueChange={async (warehouseId) => {
                    setOpWarehouseId(warehouseId);
                    setOpLocationId('');
                    const locs = await base44.entities.Location.filter({
                      company_id: companyId,
                      warehouse_id: warehouseId,
                      active: true
                    });
                    setWarehouseLocations(locs || []);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses?.map(w => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Localização de Destino</Label>
                <Select 
                  value={opLocationId} 
                  onValueChange={(locationId) => setOpLocationId(locationId)}
                  disabled={!opWarehouseId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={opWarehouseId ? "Selecione..." : "Escolha um armazém"} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseLocations?.map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.barcode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { 
              setOpDialogOpen(false); 
              setOpExternalNumber(''); 
              setOpQuantity(0);
              setOpWarehouseId('');
              setOpLocationId('');
              setWarehouseLocations([]);
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createOPMutation.mutate({ 
                request: selectedRequest, 
                numeroOpExterno: opExternalNumber,
                quantidade: opQuantity,
                warehouseId: opWarehouseId,
                locationId: opLocationId
              })}
              disabled={!opExternalNumber || opQuantity <= 0 || !opWarehouseId || createOPMutation.isPending}
            >
              {createOPMutation.isPending ? 'Criando...' : 'Criar OP'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!clearResidueConfirm} onOpenChange={() => setClearResidueConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Resíduos</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja eliminar os resíduos (<strong>{clearResidueConfirm?.qty_residue}</strong>) desta solicitação?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearResidueConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => clearResidueMutation.mutate(clearResidueConfirm.id)} disabled={clearResidueMutation.isPending}>
              {clearResidueMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelRequestConfirm} onOpenChange={() => setCancelRequestConfirm(null)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Cancelar Solicitação de Produção</DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             <div className="p-3 bg-slate-50 rounded-lg">
               <p className="text-sm text-slate-700">Solicitação: <strong>{cancelRequestConfirm?.product_name}</strong></p>
               <p className="text-sm text-slate-600 mt-1">Qtd. Solicitada: {cancelRequestConfirm?.qty_requested}</p>
               <p className="text-sm text-slate-600">Qtd. Atendida: {cancelRequestConfirm?.qty_fulfilled || 0}</p>
             </div>

             {getLinkedOP(cancelRequestConfirm?.id) && (
               <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                 <p className="text-sm font-medium text-amber-900">OP Vinculada</p>
                 <p className="text-sm text-amber-800 mt-1">
                   OP: <strong>{getLinkedOP(cancelRequestConfirm?.id)?.numero_op_externo}</strong>
                 </p>
                 <p className="text-sm text-amber-700 mt-2">O que fazer com a OP?</p>
               </div>
             )}
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setCancelRequestConfirm(null)}>Fechar</Button>
             {getLinkedOP(cancelRequestConfirm?.id) ? (
               <>
                 <Button 
                   variant="default"
                   onClick={() => cancelRequestMutation.mutate({ requestId: cancelRequestConfirm.id, cancelOPs: false })}
                   disabled={cancelRequestMutation.isPending}
                 >
                   Manter OP Aberta
                 </Button>
                 <Button 
                   variant="destructive"
                   onClick={() => cancelRequestMutation.mutate({ requestId: cancelRequestConfirm.id, cancelOPs: true })}
                   disabled={cancelRequestMutation.isPending}
                 >
                   Cancelar OP também
                 </Button>
               </>
             ) : (
               <Button 
                 variant="destructive"
                 onClick={() => cancelRequestMutation.mutate({ requestId: cancelRequestConfirm.id, cancelOPs: false })}
                 disabled={cancelRequestMutation.isPending}
               >
                 {cancelRequestMutation.isPending ? 'Cancelando...' : 'Cancelar'}
               </Button>
             )}
           </DialogFooter>
         </DialogContent>
       </Dialog>
      </div>
      );
      }