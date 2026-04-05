import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Plus, Search, Package, Loader2, CheckCircle, AlertCircle, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
import { toast } from 'sonner';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';
import ClientSearchSelect from '@/components/clients/ClientSearchSelect';
import { format } from 'date-fns';

const statusColors = {
  ESTOQUE: 'bg-slate-100 text-slate-700',
  VENDIDO: 'bg-blue-100 text-blue-700',
  INSTALADO: 'bg-emerald-100 text-emerald-700',
  EM_GARANTIA: 'bg-indigo-100 text-indigo-700',
  FORA_GARANTIA: 'bg-amber-100 text-amber-700',
};

export default function SerialNumberControl() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    serial_number: '',
    product_id: '',
    client_id: '',
    order_id: '',
    warranty_months: 12,
    installation_required: false,
    status: 'ESTOQUE',
    sale_date: '',
    notes: ''
  });

  const { data: serials, isLoading } = useQuery({
    queryKey: ['serial-numbers', companyId],
    queryFn: () => companyId ? base44.entities.SerialNumber.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: orders } = useQuery({
    queryKey: ['sales-orders', companyId],
    queryFn: () => companyId ? base44.entities.SalesOrder.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Verificar se o número de série já existe para este produto na empresa
      const existing = await base44.entities.SerialNumber.filter({ 
        company_id: companyId,
        serial_number: data.serial_number,
        product_id: data.product_id
      }).then(res => res?.[0]);

      const product = await base44.entities.Product.filter({ id: data.product_id }).then(p => p?.[0]);
      const client = data.client_id ? 
        await base44.entities.Client.filter({ id: data.client_id }).then(c => c?.[0]) : null;
      const order = data.order_id ?
        await base44.entities.SalesOrder.filter({ id: data.order_id }).then(o => o?.[0]) : null;

      const warrantyStartDate = data.sale_date ? new Date(data.sale_date + 'T12:00:00') : new Date();
      const warrantyExpires = new Date(warrantyStartDate);
      warrantyExpires.setMonth(warrantyExpires.getMonth() + Number(data.warranty_months || 0));

      const payload = {
        ...data,
        company_id: companyId,
        product_sku: product?.sku,
        product_name: product?.name,
        client_name: client?.name,
        order_number: order?.order_number,
        sale_date: data.sale_date || new Date().toISOString().split('T')[0],
        status: data.status,
        warranty_expires: warrantyExpires.toISOString().split('T')[0]
      };

      if (existing) {
        // Inteligência: Realocar em vez de duplicar
        return await base44.entities.SerialNumber.update(existing.id, payload);
      } else {
        // Novo registro
        return await base44.entities.SerialNumber.create(payload);
      }
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['serial-numbers', companyId] });
       toast.success('Número de série registrado');
       setShowForm(false);
       resetForm();
     },
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const warrantyStartDate = data.sale_date ? new Date(data.sale_date + 'T12:00:00') : new Date();
      const warrantyExpires = new Date(warrantyStartDate);
      warrantyExpires.setMonth(warrantyExpires.getMonth() + Number(data.warranty_months || 0));

      return await base44.entities.SerialNumber.update(editingId, {
        status: data.status,
        sale_date: data.sale_date,
        warranty_months: data.warranty_months,
        warranty_expires: warrantyExpires.toISOString().split('T')[0],
        client_id: data.client_id,
        order_id: data.order_id,
        installation_required: data.installation_required,
        notes: data.notes
      });
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['serial-numbers', companyId] });
       toast.success('Número de série atualizado');
       setShowForm(false);
       setEditingId(null);
       resetForm();
     },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.serial_number && !editingId) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    if (editingId) {
      updateMutation.mutate(form);
    } else {
      if (!form.product_id) {
        toast.error('Selecione um produto');
        return;
      }
      createMutation.mutate(form);
    }
  };

  const resetForm = () => {
    setForm({
      serial_number: '',
      product_id: '',
      client_id: '',
      order_id: '',
      warranty_months: 12,
      installation_required: false,
      status: 'ESTOQUE',
      sale_date: '',
      notes: ''
    });
    setEditingId(null);
  };

  const handleEdit = (serial) => {
    setEditingId(serial.id);
    setForm({
      serial_number: serial.serial_number,
      product_id: serial.product_id || '',
      client_id: serial.client_id || '',
      order_id: serial.order_id || '',
      warranty_months: serial.warranty_months || 12,
      installation_required: serial.installation_required || false,
      status: serial.status || 'ESTOQUE',
      sale_date: serial.sale_date || '',
      notes: serial.notes || ''
    });
    setShowForm(true);
  };

  const ordersMap = useMemo(() => {
    const map = {};
    orders?.forEach(o => { map[o.id] = o; });
    return map;
  }, [orders]);

  const filteredSerials = serials?.filter(serial => {
    const nf = serial.order_id ? ordersMap[serial.order_id]?.nf_number : null;
    const matchSearch = search === '' || 
      serial.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
      serial.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      serial.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      (nf && nf.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || serial.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Controle de Números de Série</h1>
          <p className="text-slate-500">Gestão e rastreamento de produtos com número de série</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-2" />
          Novo Registro
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por número de série, cliente, produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="ESTOQUE">Estoque</SelectItem>
                <SelectItem value="VENDIDO">Vendido</SelectItem>
                <SelectItem value="INSTALADO">Instalado</SelectItem>
                <SelectItem value="EM_GARANTIA">Em Garantia</SelectItem>
                <SelectItem value="FORA_GARANTIA">Fora de Garantia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número de Série</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>NF</TableHead>
                  <TableHead>Garantia até</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Instalação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSerials?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      Nenhum número de série encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSerials?.map((serial) => (
                    <TableRow key={serial.id} className="cursor-pointer hover:bg-slate-50">
                      <TableCell className="font-mono font-medium">{serial.serial_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{serial.product_name}</p>
                          <p className="text-xs text-slate-500">{serial.product_sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>{serial.client_name || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{serial.order_number || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {serial.order_id && ordersMap[serial.order_id]?.nf_number
                          ? ordersMap[serial.order_id].nf_number
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {serial.warranty_expires ? format(new Date(serial.warranty_expires), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[serial.status]}>
                          {serial.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {serial.installation_required ? (
                            serial.installation_date ? (
                              <CheckCircle className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-600" />
                            )
                          ) : '-'}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEdit(serial)}
                            className="h-6 w-6"
                          >
                            <Edit className="h-4 w-4 text-slate-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Número de Série' : 'Novo Número de Série'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número de Série *</Label>
                <Input
                  value={form.serial_number}
                  onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                  placeholder="Ex: SN123456789"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ESTOQUE">Estoque</SelectItem>
                    <SelectItem value="VENDIDO">Vendido</SelectItem>
                    <SelectItem value="INSTALADO">Instalado</SelectItem>
                    <SelectItem value="EM_GARANTIA">Em Garantia</SelectItem>
                    <SelectItem value="FORA_GARANTIA">Fora de Garantia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Venda/Início de Garantia</Label>
                <Input
                  type="date"
                  value={form.sale_date}
                  onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Meses de Garantia</Label>
                <Input
                  type="number"
                  value={form.warranty_months}
                  onChange={(e) => setForm({ ...form, warranty_months: parseInt(e.target.value) || 12 })}
                />
              </div>
            </div>

            <ProductSearchSelect
              label="Produto"
              value={form.product_id}
              onSelect={(v) => setForm({ ...form, product_id: v })}
              required={!editingId}
              disabled={!!editingId}
            />

            <ClientSearchSelect
              label="Cliente"
              value={form.client_id}
              onSelect={(v) => setForm({ ...form, client_id: v })}
              placeholder="Deixe em branco se estiver em estoque"
            />

            <div className="space-y-2">
              <Label>Pedido Relacionado</Label>
              <Select value={form.order_id} onValueChange={(v) => setForm({ ...form, order_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {orders?.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.order_number} - {o.client_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="installation"
                checked={form.installation_required}
                onChange={(e) => setForm({ ...form, installation_required: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="installation">Requer instalação</Label>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-indigo-600">
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {editingId ? 'Atualizar' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}