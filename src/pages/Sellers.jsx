import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Plus, Search, Edit2, Trash2, Users, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function Sellers() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    commission_rate: 0,
    manager_ids: [],
    active: true
  });

  const { data: sellers, isLoading } = useQuery({
    queryKey: ['sellers', companyId],
    queryFn: () => companyId ? base44.entities.Seller.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Seller.create({ ...data, company_id: companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers', companyId] });
      toast.success('Vendedor criado');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Seller.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers', companyId] });
      toast.success('Vendedor atualizado');
      resetForm();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      toast.error('Código e nome são obrigatórios');
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const { data: users = [] } = useQuery({
    queryKey: ['users', companyId],
    queryFn: () => companyId ? base44.entities.User.list() : Promise.resolve([]),
    enabled: !!companyId,
  });

  const resetForm = () => {
    setForm({
      code: '',
      name: '',
      email: '',
      phone: '',
      commission_rate: 0,
      manager_ids: [],
      active: true
    });
    setShowForm(false);
    setEditing(null);
  };

  const handleEdit = (seller) => {
    setForm(seller);
    setEditing(seller);
    setShowForm(true);
  };

  const filteredSellers = sellers?.filter(s =>
    search === '' ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.code?.toLowerCase().includes(search.toLowerCase())
  );

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Selecione um arquivo Excel');
      return;
    }

    setImporting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: importFile });

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
              commission_rate: { type: "number" }
            },
            required: ["code", "name"]
          }
        }
      });

      if (result.status === 'error') {
        throw new Error(result.details);
      }

      let sellers = Array.isArray(result.output) ? result.output : [];

      // Buscar vendedores existentes para verificar duplicidade por código
      const existingSellers = await base44.entities.Seller.filter({ company_id: companyId });
      const existingCodes = new Set(existingSellers.map(s => s.code?.toUpperCase()));

      const newSellers = sellers.filter(s => !existingCodes.has(s.code?.toUpperCase()));
      const skippedCount = sellers.length - newSellers.length;

      if (newSellers.length === 0) {
        toast.warning(`Todos os ${sellers.length} vendedor(es) já existem no cadastro. Nenhum item foi importado.`);
        setImportDialogOpen(false);
        setImportFile(null);
        return;
      }

      await base44.entities.Seller.bulkCreate(newSellers.map(s => ({
        company_id: companyId,
        code: s.code,
        name: s.name,
        email: s.email || '',
        phone: s.phone || '',
        commission_rate: s.commission_rate || 0,
        active: true
      })));

      queryClient.invalidateQueries({ queryKey: ['sellers', companyId] });
      setImportDialogOpen(false);
      setImportFile(null);
      
      const msg = skippedCount > 0
        ? `${newSellers.length} vendedor(es) importado(s). ${skippedCount} já existiam e foram ignorados para preservar o histórico.`
        : `${newSellers.length} vendedor(es) importado(s) com sucesso.`;
      toast.success(msg);
    } catch (error) {
      toast.error('Erro ao importar: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendedores</h1>
          <p className="text-slate-500">Gestão de vendedores</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportDialogOpen(true)} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Importar Excel
          </Button>
          <Button onClick={() => setShowForm(true)} className="bg-indigo-600">
            <Plus className="h-4 w-4 mr-2" />
            Novo Vendedor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar vendedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSellers?.map((seller) => (
                <TableRow key={seller.id}>
                  <TableCell className="font-mono">{seller.code}</TableCell>
                  <TableCell className="font-medium">{seller.name}</TableCell>
                  <TableCell className="text-sm">{seller.email || '-'}</TableCell>
                  <TableCell className="text-sm">{seller.phone || '-'}</TableCell>
                  <TableCell>{seller.commission_rate}%</TableCell>
                  <TableCell>
                    <Badge className={seller.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                      {seller.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(seller)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Vendedor' : 'Novo Vendedor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Comissão (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.commission_rate}
                  onChange={(e) => setForm({ ...form, commission_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Gestores</Label>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`manager-${user.id}`}
                      checked={form.manager_ids?.includes(user.id)}
                      onChange={(e) => {
                        const newManagerIds = e.target.checked
                          ? [...(form.manager_ids || []), user.id]
                          : (form.manager_ids || []).filter(id => id !== user.id);
                        setForm({ ...form, manager_ids: newManagerIds });
                      }}
                      className="rounded"
                    />
                    <Label htmlFor={`manager-${user.id}`} className="cursor-pointer">
                      {user.full_name || user.email}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="active">Ativo</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Vendedores</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Selecione um arquivo Excel (.xlsx) com as seguintes colunas:
              </p>
              <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                <p><strong>code</strong> - Código (obrigatório)</p>
                <p><strong>name</strong> - Nome (obrigatório)</p>
                <p><strong>email</strong> - E-mail</p>
                <p><strong>phone</strong> - Telefone</p>
                <p><strong>commission_rate</strong> - Taxa de comissão (%)</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Arquivo Excel</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files[0])}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportFile(null); }}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={importing || !importFile}>
              {importing ? 'Importando...' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}