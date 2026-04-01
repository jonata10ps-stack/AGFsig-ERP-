import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Plus, Search, Eye, MoreHorizontal, PackageX, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ClientSearchSelect from '@/components/clients/ClientSearchSelect';

const STATUS_CONFIG = {
  ABERTA: { color: 'bg-blue-100 text-blue-700', label: 'Aberta' },
  RECEBIDA: { color: 'bg-amber-100 text-amber-700', label: 'Recebida' },
  ANALISADA: { color: 'bg-purple-100 text-purple-700', label: 'Analisada' },
  APROVADA: { color: 'bg-emerald-100 text-emerald-700', label: 'Aprovada' },
  REJEITADA: { color: 'bg-rose-100 text-rose-700', label: 'Rejeitada' },
  FECHADA: { color: 'bg-slate-100 text-slate-700', label: 'Fechada' },
};

const CONDITION_CONFIG = {
  NOVO: { color: 'bg-emerald-100 text-emerald-700', label: 'Novo' },
  BOM: { color: 'bg-blue-100 text-blue-700', label: 'Bom' },
  DANIFICADO: { color: 'bg-amber-100 text-amber-700', label: 'Danificado' },
  INUTILIZAVEL: { color: 'bg-rose-100 text-rose-700', label: 'Inutilizável' },
};

function CreateReturnDialog({ open, onOpenChange, clients, orders, onCreate, loading }) {
  const [form, setForm] = useState({
    client_id: '',
    order_id: '',
    reason: '',
    reason_description: '',
    return_date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.client_id || !form.reason || !form.return_date) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    onCreate(form);
    setForm({
      client_id: '',
      order_id: '',
      reason: '',
      reason_description: '',
      return_date: format(new Date(), 'yyyy-MM-dd'),
      notes: ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Devolução</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ClientSearchSelect
            label="Cliente *"
            value={form.client_id}
            onSelect={(id) => setForm({ ...form, client_id: id, order_id: '' })}
            placeholder="Selecione o cliente..."
            required
          />

          {form.client_id && (
            <div className="space-y-2">
              <Label>Pedido Original (Opcional)</Label>
              <Select value={form.order_id} onValueChange={(id) => setForm({ ...form, order_id: id })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um pedido..." />
                </SelectTrigger>
                <SelectContent>
                  {orders?.filter(o => o.client_id === form.client_id)?.map(order => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.order_number} - {order.created_date ? format(new Date(order.created_date), 'dd/MM/yyyy', { locale: ptBR }) : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Motivo da Devolução *</Label>
            <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEFEITO">Defeito</SelectItem>
                <SelectItem value="NAO_CONFORMIDADE">Não Conformidade</SelectItem>
                <SelectItem value="ARREPENDIMENTO">Arrependimento</SelectItem>
                <SelectItem value="DANO_TRANSPORTE">Dano no Transporte</SelectItem>
                <SelectItem value="OUTRO">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição do Motivo</Label>
            <Input
              value={form.reason_description}
              onChange={(e) => setForm({ ...form, reason_description: e.target.value })}
              placeholder="Descreva o problema..."
            />
          </div>

          <div className="space-y-2">
            <Label>Data da Devolução *</Label>
            <Input
              type="date"
              value={form.return_date}
              onChange={(e) => setForm({ ...form, return_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Observações internas..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Devolução'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Returns() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: returns, isLoading } = useQuery({
    queryKey: ['returns', companyId],
    queryFn: () => companyId ? base44.entities.Return.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-active', companyId],
    queryFn: () => companyId ? base44.entities.Client.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: orders } = useQuery({
    queryKey: ['sales-orders-all', companyId],
    queryFn: () => companyId ? base44.entities.SalesOrder.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (formData) => {
      const returnNumber = `DEV-${Date.now().toString().slice(-8)}`;
      const order = orders?.find(o => o.id === formData.order_id);
      
      const returnData = {
         company_id: companyId,
         ...formData,
         return_number: returnNumber,
         order_number: order?.order_number || null,
         status: 'ABERTA'
       };

       await base44.entities.Return.create(returnData);
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['returns', companyId] });
       setCreateDialogOpen(false);
       toast.success('Devolução criada com sucesso');
     },
  });

  const filtered = returns?.filter(r => {
    const matchesSearch = r.return_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gerenciamento de Devoluções</h1>
          <p className="text-slate-500">Registre e acompanhe devoluções de clientes</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-2" />
          Nova Devolução
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por número ou cliente..."
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
              <PackageX className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhuma devolução encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resolução</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((ret) => (
                  <TableRow key={ret.id}>
                    <TableCell>
                      <span className="font-mono text-indigo-600 font-medium">
                        {ret.return_number || `#${ret.id.slice(0, 8)}`}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{ret.client_name}</TableCell>
                    <TableCell className="text-slate-500">{ret.reason}</TableCell>
                    <TableCell className="text-slate-500">
                      {ret.return_date ? format(new Date(ret.return_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_CONFIG[ret.status]?.color || 'bg-slate-100'}>
                        {STATUS_CONFIG[ret.status]?.label || ret.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {ret.resolution ? (
                        <Badge variant="outline">
                          {ret.resolution === 'CREDITO' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {ret.resolution === 'REENVIO' && <AlertCircle className="h-3 w-3 mr-1" />}
                          {ret.resolution}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={createPageUrl(`ReturnDetail?id=${ret.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateReturnDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        clients={clients}
        orders={orders}
        onCreate={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />
    </div>
  );
}