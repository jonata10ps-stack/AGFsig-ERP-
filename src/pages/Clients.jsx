import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { debounce } from 'lodash';
import { useCompanyId } from '@/components/useCompanyId';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  MoreHorizontal,
  Users,
  Mail,
  Phone,
  MapPin,
  FileSpreadsheet,
  Loader
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

function ClientForm({ client, onSave, onCancel, loading, allClients }) {
  const [form, setForm] = useState(() => {
    if (client) return client;
    
    // Gerar próximo código sequencial
    const existingCodes = allClients
      ?.map(c => c.code)
      .filter(code => code && /^\d+$/.test(code))
      .map(code => parseInt(code, 10))
      .filter(num => !isNaN(num)) || [];
    
    const nextNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    
    return {
      code: String(nextNumber).padStart(4, '0'),
      name: '',
      document: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      credit_limit: 0,
      active: true
    };
  });
  const [searchingCNPJ, setSearchingCNPJ] = useState(false);
  const [cnpjError, setCnpjError] = useState(null);

  const searchCNPJ = async (cnpj) => {
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    if (cleanCNPJ.length !== 14) return;

    setSearchingCNPJ(true);
    setCnpjError(null);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Acesse https://casadosdados.com.br/solucao/cnpj e busque os dados do CNPJ ${cleanCNPJ}. Extraia name (RAZÃO SOCIAL), email, phone, address, city, state.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            address: { type: "string" },
            city: { type: "string" },
            state: { type: "string" }
          },
          required: ["name"]
        }
      });

      if (result?.name) {
        setForm(prev => ({
          ...prev,
          name: (result.name || prev.name).toUpperCase(),
          email: result.email || prev.email,
          phone: result.phone || prev.phone,
          city: result.city || prev.city,
          state: result.state || prev.state,
          address: result.address || prev.address
        }));
        toast.success('Dados do CNPJ carregados');
      }
    } catch (error) {
      console.error('Erro CNPJ:', error);
    } finally {
      setSearchingCNPJ(false);
    }
  };

  const debouncedSearchCNPJ = debounce(searchCNPJ, 500);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) {
      toast.error('Nome é obrigatório');
      return;
    }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Código</Label>
          <Input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="CLI-001"
          />
        </div>
        <div className="space-y-2">
          <Label>CPF/CNPJ</Label>
          <div className="relative">
            <Input
              value={form.document}
              onChange={(e) => {
                setForm({ ...form, document: e.target.value });
                debouncedSearchCNPJ(e.target.value);
              }}
              placeholder="00.000.000/0000-00"
            />
            {searchingCNPJ && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Nome/Razão Social *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>E-mail</Label>
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
      </div>

      <div className="space-y-2">
        <Label>Endereço</Label>
        <Textarea
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Cidade</Label>
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div>
          <Label>Estado</Label>
          <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Limite de Crédito</Label>
        <Input
          type="number"
          step="0.01"
          value={form.credit_limit}
          onChange={(e) => setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })}
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

export default function Clients() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const [tablePage, setTablePage] = useState(0);
  const TABLE_PAGE_SIZE = 50;

  const { data: result, isLoading } = useQuery({
    queryKey: ['clients', tablePage, search],
    queryFn: async () => {
      const skip = tablePage * TABLE_PAGE_SIZE;
      const limit = skip + TABLE_PAGE_SIZE - 1;
      
      // MODO GERAL: Não filtra por companyId para que todas as empresas vejam todos os clientes
      // Usamos o acesso normal (supabase). Como você aplicou o SQL "USING (true)", ele verá tudo.
      let query = supabase
        .from('Client')
        .select('*', { count: 'exact' });

      if (search) {
        query = query.or(`name.ilike.%${search}%,document.ilike.%${search}%,code.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(skip, limit);

      if (error) throw error;
      
      const mappedData = (data || []).map(item => ({
        ...item,
        created_date: item.created_at || item.registered_date
      }));

      return { data: mappedData, count: count || 0 };
    }
  });

  const clients = result?.data || [];
  const totalCount = result?.count || 0;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.create({ ...data, company_id: companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setDialogOpen(false);
      toast.success('Cliente cadastrado');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setDialogOpen(false);
      setEditingClient(null);
      toast.success('Cliente atualizado');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setDeleteConfirm(null);
      toast.success('Cliente excluído');
    },
  });

  const handleSave = (data) => {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const totalTablePages = Math.ceil(totalCount / TABLE_PAGE_SIZE);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setTablePage(0);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const arrayBuffer = await importFile.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      const newClients = data.map((row) => ({
        company_id: companyId,
        name: String(row.nome || row.name || '').trim(),
        document: String(row.document || row.cnpj || row.cpf || '').trim(),
        code: String(row.code || row.codigo || '').trim(),
        email: String(row.email || '').trim(),
        phone: String(row.phone || row.telefone || '').trim(),
        address: String(row.address || row.endereco || '').trim(),
        city: String(row.city || row.cidade || '').trim(),
        state: String(row.state || row.estado || '').trim(),
        active: true
      })).filter(c => c.name);

      await base44.entities.Client.bulkCreate(newClients);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setImportDialogOpen(false);
      toast.success('Importação concluída');
    } catch (e) {
      toast.error('Erro na importação');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Banco de Clientes (Unificado)</h1>
          <p className="text-slate-500">Todos os clientes são compartilhados entre suas empresas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportDialogOpen(true)} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Importar Excel
          </Button>
          <Button onClick={() => { setEditingClient(null); setDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar em todo o banco de clientes..."
              value={search}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4 text-center">Carregando banco unificado...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-mono text-indigo-600">{client.code || '-'}</TableCell>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="text-slate-500">{client.document || '-'}</TableCell>
                      <TableCell>{client.city || '-'}/{client.state || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(client)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(client)} className="text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalTablePages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
                  <div className="text-sm text-slate-500">
                    Página {tablePage + 1} de {totalTablePages} ({totalCount} clientes)
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setTablePage(p => Math.max(0, p - 1))} disabled={tablePage === 0}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setTablePage(p => Math.min(totalTablePages - 1, p + 1))} disabled={tablePage >= totalTablePages - 1}>
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <ClientForm
            client={editingClient}
            onSave={handleSave}
            onCancel={() => setDialogOpen(false)}
            loading={createMutation.isPending || updateMutation.isPending}
            allClients={clients}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Cliente</DialogTitle></DialogHeader>
          <p>Deseja excluir <strong>{deleteConfirm?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteConfirm.id)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Importar Excel</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input type="file" accept=".xlsx,.xls" onChange={(e) => setImportFile(e.target.files[0])} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing}>{importing ? 'Importando...' : 'Importar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}