import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, Search, Filter, Eye, CheckCircle, Wrench, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';
import ClientSearchSelect from '@/components/clients/ClientSearchSelect';
import { format } from 'date-fns';

const statusColors = {
  ABERTA: 'bg-blue-100 text-blue-700',
  EM_ATENDIMENTO: 'bg-indigo-100 text-indigo-700',
  AGUARDANDO_PECA: 'bg-amber-100 text-amber-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  ENCERRADA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-slate-100 text-slate-700',
};

export default function ServiceRequests() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    client_id: '',
    order_id: '',
    product_id: '',
    serial_number: '',
    type: 'MANUTENCAO',
    priority: 'NORMAL',
    description: '',
    contact_phone: '',
    contact_address: '',
    scheduled_date: ''
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ['service-requests', companyId],
    queryFn: () => companyId ? base44.entities.ServiceRequest.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => companyId ? base44.entities.Client.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: orders } = useQuery({
    queryKey: ['sales-orders-faturados', companyId],
    queryFn: () => companyId ? base44.entities.SalesOrder.filter({ company_id: companyId, status: 'FATURADO' }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: serviceOrders } = useQuery({
    queryKey: ['service-orders', companyId],
    queryFn: () => companyId ? base44.entities.ServiceOrder.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const requestNumber = `SR-${Date.now().toString().slice(-8)}`;
      const client = clients?.find(c => c.id === data.client_id);
      const order = orders?.find(o => o.id === data.order_id);
      const product = await base44.entities.Product.filter({ id: data.product_id }).then(p => p?.[0]);

      return await base44.entities.ServiceRequest.create({
         company_id: companyId,
         ...data,
         request_number: requestNumber,
         client_name: client?.name,
         order_number: order?.order_number,
         product_name: product?.name,
         status: 'ABERTA'
       });
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['service-requests', companyId] });
       toast.success('Solicitação criada');
       setShowForm(false);
       resetForm();
     },
  });

  const createOSMutation = useMutation({
    mutationFn: async (request) => {
      const osNumber = `OS-${Date.now().toString().slice(-8)}`;
      
      await base44.entities.ServiceOrder.create({
        company_id: companyId,
        os_number: osNumber,
        request_id: request.id,
        client_id: request.client_id,
        client_name: request.client_name,
        product_id: request.product_id,
        product_name: request.product_name,
        serial_number: request.serial_number,
        type: request.type,
        priority: request.priority,
        description: request.description,
        status: 'PENDENTE'
      });

      await base44.entities.ServiceRequest.update(request.id, {
        status: 'EM_ATENDIMENTO'
      });
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['service-requests', companyId] });
       queryClient.invalidateQueries({ queryKey: ['service-orders', companyId] });
       toast.success('Ordem de serviço criada');
     },
  });

  const checkAndCloseRequestsMutation = useMutation({
    mutationFn: async () => {
      const allServiceOrders = await base44.entities.ServiceOrder.list('-created_date', 1000);
      const requestsToClose = [];

      requests?.forEach(req => {
        if (req.status !== 'ENCERRADA' && req.status !== 'CANCELADA') {
          const requestOrders = allServiceOrders.filter(so => so.request_id === req.id);
          if (requestOrders.length > 0 && requestOrders.every(so => so.status === 'CONCLUIDA')) {
            requestsToClose.push(req.id);
          }
        }
      });

      for (const requestId of requestsToClose) {
        await base44.entities.ServiceRequest.update(requestId, {
          status: 'ENCERRADA'
        });
      }

      return requestsToClose.length;
    },
    onSuccess: (count) => {
       if (count > 0) {
         queryClient.invalidateQueries({ queryKey: ['service-requests', companyId] });
         toast.success(`${count} solicitação(ões) encerrada(s)`);
       }
     },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.client_id || !form.description) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    createMutation.mutate(form);
  };

  const resetForm = () => {
    setForm({
      client_id: '',
      order_id: '',
      product_id: '',
      serial_number: '',
      type: 'MANUTENCAO',
      priority: 'NORMAL',
      description: '',
      contact_phone: '',
      contact_address: '',
      scheduled_date: ''
    });
  };

  const filteredRequests = requests?.filter(req => {
    const matchSearch = search === '' || 
      req.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      req.request_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchType = typeFilter === 'all' || req.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <div>
           <h1 className="text-2xl font-bold text-slate-900">Solicitações de Serviço</h1>
           <p className="text-slate-500 text-sm sm:text-base">Gestão de solicitações de assistência técnica</p>
         </div>
         <div className="flex gap-2 w-full sm:w-auto">
           <Button onClick={() => checkAndCloseRequestsMutation.mutate()} disabled={checkAndCloseRequestsMutation.isPending} className="flex-1 sm:flex-initial bg-amber-600 hover:bg-amber-700">
             {checkAndCloseRequestsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
             Verificar Encerramento
           </Button>
           <Button onClick={() => setShowForm(true)} className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700">
             <Plus className="h-4 w-4 mr-2" />
             Nova Solicitação
           </Button>
         </div>
       </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">Todos Status</SelectItem>
                   <SelectItem value="ABERTA">Aberta</SelectItem>
                   <SelectItem value="EM_ATENDIMENTO">Em Atendimento</SelectItem>
                   <SelectItem value="AGUARDANDO_PECA">Aguardando Peça</SelectItem>
                   <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                   <SelectItem value="ENCERRADA">Encerrada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  <SelectItem value="INSTALACAO">Instalação</SelectItem>
                  <SelectItem value="MANUTENCAO">Manutenção</SelectItem>
                  <SelectItem value="GARANTIA">Garantia</SelectItem>
                  <SelectItem value="RECLAMACAO">Reclamação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests?.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-mono text-sm">{req.request_number}</TableCell>
                        <TableCell>{req.client_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{req.type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{req.product_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={req.priority === 'URGENTE' ? 'destructive' : 'secondary'}>
                            {req.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[req.status]}>
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(req.created_date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">•••</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {req.status === 'ABERTA' && (
                                <DropdownMenuItem onClick={() => createOSMutation.mutate(req)}>
                                  <Wrench className="h-4 w-4 mr-2" />
                                  Criar OS
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredRequests?.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-500">Nenhuma solicitação encontrada</p>
                  </div>
                ) : (
                  filteredRequests?.map((req) => (
                    <Card key={req.id} className="border-slate-200">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <p className="font-mono text-sm font-semibold text-indigo-600">{req.request_number}</p>
                            <p className="text-slate-900 font-medium">{req.client_name}</p>
                          </div>
                          <Badge className={statusColors[req.status]}>
                            {req.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-slate-500">Tipo</p>
                            <p className="font-medium text-slate-900">{req.type}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Prioridade</p>
                            <Badge variant={req.priority === 'URGENTE' ? 'destructive' : 'secondary'} className="text-xs">
                              {req.priority}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-slate-500">Produto</p>
                            <p className="font-medium text-slate-900">{req.product_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Data</p>
                            <p className="font-medium text-slate-900">
                              {format(new Date(req.created_date), 'dd/MM')}
                            </p>
                          </div>
                        </div>

                        {req.status === 'ABERTA' && (
                          <Button
                            onClick={() => createOSMutation.mutate(req)}
                            disabled={createOSMutation.isPending}
                            className="w-full bg-indigo-600 hover:bg-indigo-700"
                          >
                            <Wrench className="h-4 w-4 mr-2" />
                            Criar Ordem de Serviço
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
         <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>Nova Solicitação de Serviço</DialogTitle>
           </DialogHeader>
           <form onSubmit={handleSubmit} className="space-y-4 pb-4">
            <ClientSearchSelect
               label="Cliente *"
               value={form.client_id}
               onSelect={(v) => setForm({ ...form, client_id: v })}
               placeholder="Digite nome, código ou documento..."
               required
             />

             <div className="space-y-2">
               <Label>Pedido Relacionado</Label>
               <Select value={form.order_id} onValueChange={(v) => setForm({ ...form, order_id: v })}>
                 <SelectTrigger>
                   <SelectValue placeholder="Opcional" />
                 </SelectTrigger>
                 <SelectContent>
                   {orders?.map(o => (
                     <SelectItem key={o.id} value={o.id}>{o.order_number}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>

             <div className="grid grid-cols-2 gap-3 sm:gap-4">
               <div className="space-y-2">
                 <Label>Tipo *</Label>
                 <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="INSTALACAO">Instalação</SelectItem>
                     <SelectItem value="MANUTENCAO">Manutenção</SelectItem>
                     <SelectItem value="GARANTIA">Garantia</SelectItem>
                     <SelectItem value="RECLAMACAO">Reclamação</SelectItem>
                     <SelectItem value="TROCA">Troca</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Prioridade</Label>
                 <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="BAIXA">Baixa</SelectItem>
                     <SelectItem value="NORMAL">Normal</SelectItem>
                     <SelectItem value="ALTA">Alta</SelectItem>
                     <SelectItem value="URGENTE">Urgente</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
             </div>

            <ProductSearchSelect
              label="Produto"
              value={form.product_id}
              onSelect={(v) => setForm({ ...form, product_id: v })}
            />

            <div className="space-y-2">
              <Label>Número de Série</Label>
              <Input
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição do Problema *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
               <div className="space-y-2">
                 <Label>Telefone para Contato</Label>
                 <Input
                   value={form.contact_phone}
                   onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                 />
               </div>
               <div className="space-y-2">
                 <Label>Data Agendada</Label>
                 <Input
                   type="date"
                   value={form.scheduled_date}
                   onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                 />
               </div>
             </div>

            <div className="space-y-2">
              <Label>Endereço para Atendimento</Label>
              <Textarea
                value={form.contact_address}
                onChange={(e) => setForm({ ...form, contact_address: e.target.value })}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Solicitação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}