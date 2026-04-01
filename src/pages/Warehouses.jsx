import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Plus, Search, Edit2, Trash2, MoreHorizontal, Warehouse, FileSpreadsheet } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const TYPES = [
  { value: 'ESTOQUE', label: 'Estoque' },
  { value: 'PRODUCAO', label: 'Produção' },
  { value: 'EXPEDICAO', label: 'Expedição' },
  { value: 'STAGING', label: 'Staging' },
];

function WarehouseForm({ warehouse, onSave, onCancel, loading }) {
  const [form, setForm] = useState(warehouse || {
    code: '',
    name: '',
    type: 'ESTOQUE',
    active: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      toast.error('Código e Nome são obrigatórios');
      return;
    }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Código *</Label>
          <Input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="ARM-01"
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nome do armazém"
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

export default function Warehouses() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => base44.entities.Warehouse.filter({ company_id: companyId }, '-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Warehouse.create({ ...data, company_id: companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', companyId] });
      setDialogOpen(false);
      toast.success('Armazém criado com sucesso');
    },
    onError: (error) => toast.error('Erro ao criar armazém: ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Warehouse.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', companyId] });
      setDialogOpen(false);
      setEditing(null);
      toast.success('Armazém atualizado com sucesso');
    },
    onError: (error) => toast.error('Erro ao atualizar armazém: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Warehouse.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', companyId] });
      setDeleteConfirm(null);
      toast.success('Armazém excluído com sucesso');
    },
    onError: (error) => toast.error('Erro ao excluir armazém: ' + error.message),
  });

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const typeColors = {
    ESTOQUE: 'bg-blue-100 text-blue-700',
    PRODUCAO: 'bg-amber-100 text-amber-700',
    EXPEDICAO: 'bg-emerald-100 text-emerald-700',
    STAGING: 'bg-purple-100 text-purple-700',
  };

  const filtered = warehouses?.filter(w =>
    w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.code?.toLowerCase().includes(search.toLowerCase())
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
              type: { type: "string" }
            },
            required: ["code", "name"]
          }
        }
      });

      if (result.status === 'error') {
        throw new Error(result.details);
      }

      let warehouses = Array.isArray(result.output) ? result.output : [];

      if (warehouses.length === 0) {
        throw new Error('Nenhum armazém encontrado no arquivo');
      }

      await base44.entities.Warehouse.bulkCreate(warehouses.map(w => ({
        company_id: companyId,
        code: w.code,
        name: w.name,
        type: w.type || 'MP',
        active: true
      })));

      queryClient.invalidateQueries({ queryKey: ['warehouses', companyId] });
      setImportDialogOpen(false);
      setImportFile(null);
      toast.success(`${warehouses.length} armazém(ns) importado(s) com sucesso`);
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
          <h1 className="text-2xl font-bold text-slate-900">Armazéns</h1>
          <p className="text-slate-500">Gerencie seus armazéns e depósitos</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportDialogOpen(true)} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Importar Excel
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            Novo Armazém
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar..."
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
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <Warehouse className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum armazém encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((wh) => (
                  <TableRow key={wh.id}>
                    <TableCell className="font-mono text-indigo-600">{wh.code}</TableCell>
                    <TableCell className="font-medium">{wh.name}</TableCell>
                    <TableCell>
                      <Badge className={typeColors[wh.type]}>{wh.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={wh.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                        {wh.active !== false ? 'Ativo' : 'Inativo'}
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
                          <DropdownMenuItem onClick={() => { setEditing(wh); setDialogOpen(true); }}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteConfirm(wh)} className="text-red-600">
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
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Armazém' : 'Novo Armazém'}</DialogTitle>
          </DialogHeader>
          <WarehouseForm
            warehouse={editing}
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
          <p>Tem certeza que deseja excluir o armazém <strong>{deleteConfirm?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteConfirm.id)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Armazéns</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Selecione um arquivo Excel (.xlsx) com as seguintes colunas:
              </p>
              <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                <p><strong>code</strong> - Código (obrigatório)</p>
                <p><strong>name</strong> - Nome (obrigatório)</p>
                <p><strong>type</strong> - Tipo (RECEBIMENTO, MP, ACABADO, WIP, STAGING_PRODUCAO, EXPEDICAO, PRODUCAO)</p>
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