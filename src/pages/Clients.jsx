import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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
        prompt: `Acesse https://casadosdados.com.br/solucao/cnpj e busque os dados do CNPJ ${cleanCNPJ}.

Extraia as seguintes informações EXATAMENTE como aparecem no site:

- "name": Razão Social em MAIÚSCULAS
- "email": Email de contato
- "phone": Telefone com DDD
- "address": Endereço completo (logradouro + número + complemento). Exemplo: "AVENIDA BRASIL 1500 SALA 10". NÃO incluir bairro, cidade, UF ou CEP neste campo.
- "city": Nome da cidade
- "state": Sigla do estado (2 letras maiúsculas)

Use "" para campos não disponíveis.`,
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
        toast.success('Dados do CNPJ carregados com sucesso');
      } else {
        setCnpjError('Dados não encontrados para este CNPJ');
      }
    } catch (error) {
      setCnpjError('Erro ao buscar CNPJ. Tente novamente.');
      console.error('Erro:', error);
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
              disabled={searchingCNPJ}
            />
            {searchingCNPJ && (
              <Loader className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>
          {cnpjError && <p className="text-xs text-red-600 mt-1">{cnpjError}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Nome/Razão Social *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nome do cliente"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@exemplo.com"
          />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="(00) 00000-0000"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Endereço</Label>
        <Textarea
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Rua, número, bairro"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Input
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            maxLength={2}
            placeholder="SP"
          />
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
  const { companyId, loading: companyLoading } = useCompanyId();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => companyId ? base44.entities.Client.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.create({ ...data, company_id: companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', companyId] });
      setDialogOpen(false);
      toast.success('Cliente criado com sucesso');
    },
    onError: (error) => toast.error('Erro ao criar cliente: ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', companyId] });
      setDialogOpen(false);
      setEditingClient(null);
      toast.success('Cliente atualizado com sucesso');
    },
    onError: (error) => toast.error('Erro ao atualizar cliente: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', companyId] });
      setDeleteConfirm(null);
      toast.success('Cliente excluído com sucesso');
    },
    onError: (error) => toast.error('Erro ao excluir cliente: ' + error.message),
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

  const handleNew = () => {
    setEditingClient(null);
    setDialogOpen(true);
  };

  const filteredClients = clients?.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.code?.toLowerCase().includes(search.toLowerCase()) ||
    c.document?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

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
              document: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
              address: { type: "string" },
              city: { type: "string" },
              state: { type: "string" },
              credit_limit: { type: "number" }
            },
            required: ["name"]
          }
        }
      });

      if (result.status === 'error') {
        throw new Error(result.details);
      }

      let clients = [];
      if (Array.isArray(result.output)) {
        clients = result.output;
      } else {
        throw new Error('Nenhum cliente encontrado no arquivo');
      }

      if (clients.length === 0) {
        throw new Error('Nenhum cliente encontrado no arquivo');
      }

      await base44.entities.Client.bulkCreate(clients.map(c => ({
        company_id: companyId,
        code: c.code || '',
        name: c.name,
        document: c.document || '',
        email: c.email || '',
        phone: c.phone || '',
        address: c.address || '',
        city: c.city || '',
        state: c.state || '',
        credit_limit: c.credit_limit || 0,
        active: true
      })));

      queryClient.invalidateQueries({ queryKey: ['clients', companyId] });
      setImportDialogOpen(false);
      setImportFile(null);
      toast.success(`${clients.length} cliente(s) importado(s) com sucesso`);
    } catch (error) {
      toast.error('Erro ao importar: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500">Gerencie sua carteira de clientes</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportDialogOpen(true)} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Importar Excel
          </Button>
          <Button onClick={handleNew} className="bg-indigo-600 hover:bg-indigo-700">
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
              placeholder="Buscar por nome, código, documento ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-32" />
                </div>
              ))}
            </div>
          ) : filteredClients?.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum cliente encontrado</p>
              <Button onClick={handleNew} variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro cliente
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="text-right">Limite</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients?.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-mono text-indigo-600">
                        {client.code || '-'}
                      </TableCell>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="text-slate-500">{client.document || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {client.email && (
                            <span className="flex items-center gap-1 text-sm text-slate-500">
                              <Mail className="h-3 w-3" />
                              {client.email}
                            </span>
                          )}
                          {client.phone && (
                            <span className="flex items-center gap-1 text-sm text-slate-500">
                              <Phone className="h-3 w-3" />
                              {client.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {client.city && client.state ? `${client.city}/${client.state}` : client.city || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(client.credit_limit)}
                      </TableCell>
                      <TableCell>
                        <Badge className={client.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                          {client.active !== false ? 'Ativo' : 'Inativo'}
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
                            <DropdownMenuItem onClick={() => handleEdit(client)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirm(client)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            onCancel={() => {
              setDialogOpen(false);
              setEditingClient(null);
            }}
            loading={createMutation.isPending || updateMutation.isPending}
            allClients={clients}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600">
            Tem certeza que deseja excluir o cliente <strong>{deleteConfirm?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Clientes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Selecione um arquivo Excel (.xlsx) com as seguintes colunas:
              </p>
              <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                <p><strong>name</strong> - Nome do cliente (obrigatório)</p>
                <p><strong>code</strong> - Código</p>
                <p><strong>document</strong> - CPF/CNPJ</p>
                <p><strong>email</strong> - E-mail</p>
                <p><strong>phone</strong> - Telefone</p>
                <p><strong>address</strong> - Endereço</p>
                <p><strong>city</strong> - Cidade</p>
                <p><strong>state</strong> - Estado</p>
                <p><strong>credit_limit</strong> - Limite de crédito</p>
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