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

  const [tablePage, setTablePage] = useState(0);
  const TABLE_PAGE_SIZE = 50;

  const { data: result, isLoading } = useQuery({
    queryKey: ['clients', companyId, tablePage, search],
    queryFn: async () => {
      if (!companyId) return { data: [], count: 0 };
      const searchFields = search ? ['name', 'document', 'code', 'email'] : [];
      return base44.entities.Client.queryPaginated(
        { company_id: companyId },
        '-created_date',
        TABLE_PAGE_SIZE,
        tablePage * TABLE_PAGE_SIZE,
        searchFields,
        search
      );
    },
    enabled: !!companyId,
  });

  const clients = result?.data || [];
  const totalCount = result?.count || 0;

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

  const totalTablePages = Math.ceil(totalCount / TABLE_PAGE_SIZE);

  const pagedClients = React.useMemo(() => {
    if (!clients || !search) return clients;
    const s = search.toLowerCase();
    return [...clients].sort((a, b) => {
      const aName = a.name?.toLowerCase() || '';
      const bName = b.name?.toLowerCase() || '';
      const aDoc = a.document?.toLowerCase() || '';
      const bDoc = b.document?.toLowerCase() || '';
      const aCode = a.code?.toLowerCase() || '';
      const bCode = b.code?.toLowerCase() || '';

      // 1. Exact match in name, document or code
      const aExact = aName === s || aDoc === s || aCode === s;
      const bExact = bName === s || bDoc === s || bCode === s;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      // 2. Starts with search string
      const aStarts = aName.startsWith(s) || aDoc.startsWith(s) || aCode.startsWith(s);
      const bStarts = bName.startsWith(s) || bDoc.startsWith(s) || bCode.startsWith(s);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      return 0;
    });
  }, [clients, search]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setTablePage(0);
  };

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
      const arrayBuffer = await importFile.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      const clients = data.map((row) => {
        const getVal = (possibleKeys) => {
          const key = Object.keys(row).find((k) =>
            possibleKeys.some((pk) => k.toLowerCase().includes(pk))
          );
          return key && row[key] ? String(row[key]).trim() : '';
        };

        return {
          name: getVal(['name', 'nome', 'razão', 'razao']),
          code: getVal(['code', 'código', 'codigo']),
          document: getVal(['document', 'cpf', 'cnpj', 'doc']),
          email: getVal(['email', 'e-mail']),
          phone: getVal(['phone', 'telefone', 'celular', 'contato']),
          address: getVal(['address', 'endereço', 'endereco', 'rua', 'logradouro']),
          city: getVal(['city', 'cidade', 'município', 'municipio']),
          state: getVal(['state', 'estado', 'uf']),
          credit_limit: parseFloat(getVal(['credit', 'limite'])) || 0,
        };
      }).filter((c) => c.name);

      if (clients.length === 0) {
        throw new Error('Nenhum cliente encontrado no arquivo. Verifique se a coluna "Nome" existe.');
      }

      // Buscar clientes existentes para verificar duplicidade por documento (CNPJ/CPF)
      const existingClients = await base44.entities.Client.filter({ company_id: companyId }, '-created_date', 9999);
      const existingDocs = new Set(existingClients.map(c => c.document?.replace(/\D/g, '')).filter(Boolean));
      const existingCodes = new Set(existingClients.map(c => c.code?.toUpperCase()).filter(Boolean));

      const newClients = clients.filter(c => {
        const cleanDoc = c.document?.replace(/\D/g, '');
        const codeUpper = c.code?.toUpperCase();
        
        // Se tem documento e já existe, pula
        if (cleanDoc && existingDocs.has(cleanDoc)) return false;
        // Se tem código e já existe, pula
        if (codeUpper && existingCodes.has(codeUpper)) return false;
        
        return true;
      });

      const skippedCount = clients.length - newClients.length;

      if (newClients.length === 0) {
        toast.warning(`Todos os ${clients.length} cliente(s) já existem no cadastro (pelo CPF/CNPJ ou Código). Nenhum item foi importado.`);
        setImportDialogOpen(false);
        setImportFile(null);
        return;
      }

      await base44.entities.Client.bulkCreate(newClients.map(c => ({
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
      
      const msg = skippedCount > 0
        ? `${newClients.length} cliente(s) importado(s). ${skippedCount} já existiam e foram ignorados para preservar o histórico.`
        : `${newClients.length} cliente(s) importado(s) com sucesso.`;
      toast.success(msg);
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
              onChange={handleSearchChange}
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
          ) : totalCount === 0 ? (
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
                  {pagedClients?.map((client) => (
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
              {totalTablePages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
                  <div className="text-sm text-slate-500">
                    Exibindo <span className="font-medium">{Math.min(totalCount, tablePage * TABLE_PAGE_SIZE + 1)}-{Math.min(totalCount, (tablePage + 1) * TABLE_PAGE_SIZE)}</span> de <span className="font-medium">{totalCount}</span> itens 
                    {totalCount > 0 && ` · Pág. ${tablePage + 1}/${totalTablePages}`}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setTablePage(p => Math.max(0, p - 1))} disabled={tablePage === 0}>
                      ← Anterior
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setTablePage(p => Math.min(totalTablePages - 1, p + 1))} disabled={tablePage >= totalTablePages - 1}>
                      Próxima →
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