import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Plus, Search, Edit2, Trash2, MoreHorizontal, MapPin, QrCode, Printer, FileSpreadsheet } from 'lucide-react';
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
import LabelPrintDialog from '@/components/label/LabelPrintDialog';

function LocationForm({ location, warehouses, onSave, onCancel, loading }) {
  const [form, setForm] = useState(location || {
    warehouse_id: '',
    rua: '',
    modulo: '',
    nivel: '',
    posicao: '',
    barcode: '',
    capacity: 0,
    active: true
  });

  const generateBarcode = () => {
    const wh = warehouses?.find(w => w.id === form.warehouse_id);
    const code = `${wh?.code || 'LOC'}-${form.rua || 'R'}${form.modulo || 'M'}${form.nivel || 'N'}${form.posicao || 'P'}`.toUpperCase();
    setForm({ ...form, barcode: code });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.warehouse_id || !form.barcode) {
      toast.error('Armazém e Código de Barras são obrigatórios');
      return;
    }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Armazém *</Label>
        <Select value={form.warehouse_id} onValueChange={(v) => setForm({ ...form, warehouse_id: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {warehouses?.map(wh => (
              <SelectItem key={wh.id} value={wh.id}>{wh.code} - {wh.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Rua</Label>
          <Input
            value={form.rua}
            onChange={(e) => setForm({ ...form, rua: e.target.value.toUpperCase() })}
            placeholder="A"
          />
        </div>
        <div className="space-y-2">
          <Label>Módulo</Label>
          <Input
            value={form.modulo}
            onChange={(e) => setForm({ ...form, modulo: e.target.value })}
            placeholder="01"
          />
        </div>
        <div className="space-y-2">
          <Label>Nível</Label>
          <Input
            value={form.nivel}
            onChange={(e) => setForm({ ...form, nivel: e.target.value })}
            placeholder="1"
          />
        </div>
        <div className="space-y-2">
          <Label>Posição</Label>
          <Input
            value={form.posicao}
            onChange={(e) => setForm({ ...form, posicao: e.target.value })}
            placeholder="A"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Código de Barras *</Label>
        <div className="flex gap-2">
          <Input
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value.toUpperCase() })}
            placeholder="ARM-01-A01-1-A"
          />
          <Button type="button" variant="outline" onClick={generateBarcode}>
            <QrCode className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Capacidade</Label>
        <Input
          type="number"
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: parseFloat(e.target.value) || 0 })}
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

export default function Locations() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterWarehouse, setFilterWarehouse] = useState('all');
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const { data: locations, isLoading } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => companyId ? base44.entities.Location.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => companyId ? base44.entities.Warehouse.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Location.create({ ...data, company_id: companyId }),
    onSuccess: (newLocation) => {
      queryClient.invalidateQueries({ queryKey: ['locations', companyId] });
      setDialogOpen(false);
      toast.success('Localização criada com sucesso');
      
      // Abrir automaticamente o diálogo de impressão de etiqueta
      setSelectedLabel(newLocation);
      setLabelDialogOpen(true);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Location.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations', companyId] });
      setDialogOpen(false);
      setEditing(null);
      toast.success('Localização atualizada com sucesso');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Location.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations', companyId] });
      setDeleteConfirm(null);
      toast.success('Localização excluída com sucesso');
    },
  });

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const warehouseMap = warehouses?.reduce((acc, wh) => ({ ...acc, [wh.id]: wh }), {}) || {};

  const filtered = locations?.filter(loc => {
    const matchesSearch = loc.barcode?.toLowerCase().includes(search.toLowerCase()) ||
      loc.rua?.toLowerCase().includes(search.toLowerCase());
    const matchesWarehouse = filterWarehouse === 'all' || loc.warehouse_id === filterWarehouse;
    return matchesSearch && matchesWarehouse;
  });

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
              warehouse_code: { type: "string" },
              barcode: { type: "string" },
              rua: { type: "string" },
              modulo: { type: "string" },
              nivel: { type: "string" },
              posicao: { type: "string" },
              capacity: { type: "number" }
            },
            required: ["warehouse_code", "barcode"]
          }
        }
      });

      if (result.status === 'error') {
        throw new Error(result.details);
      }

      let locations = Array.isArray(result.output) ? result.output : [];

      if (locations.length === 0) {
        throw new Error('Nenhuma localização encontrada no arquivo');
      }

      const warehouseByCode = warehouses?.reduce((acc, wh) => ({ ...acc, [wh.code]: wh.id }), {}) || {};

      await base44.entities.Location.bulkCreate(locations.map(l => ({
        company_id: companyId,
        warehouse_id: warehouseByCode[l.warehouse_code],
        barcode: l.barcode,
        rua: l.rua || '',
        modulo: l.modulo || '',
        nivel: l.nivel || '',
        posicao: l.posicao || '',
        capacity: l.capacity || 0,
        active: true
      })).filter(l => l.warehouse_id));

      queryClient.invalidateQueries({ queryKey: ['locations', companyId] });
      setImportDialogOpen(false);
      setImportFile(null);
      toast.success(`${locations.length} localização(ões) importada(s) com sucesso`);
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
          <h1 className="text-2xl font-bold text-slate-900">Localizações</h1>
          <p className="text-slate-500">Gerencie as posições de armazenagem</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportDialogOpen(true)} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Importar Excel
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            Nova Localização
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Armazém" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os armazéns</SelectItem>
                {warehouses?.map(wh => (
                  <SelectItem key={wh.id} value={wh.id}>{wh.code} - {wh.name}</SelectItem>
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
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhuma localização encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Armazém</TableHead>
                  <TableHead>Rua</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Posição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-mono text-indigo-600">{loc.barcode}</TableCell>
                    <TableCell>{warehouseMap[loc.warehouse_id]?.name || '-'}</TableCell>
                    <TableCell>{loc.rua || '-'}</TableCell>
                    <TableCell>{loc.modulo || '-'}</TableCell>
                    <TableCell>{loc.nivel || '-'}</TableCell>
                    <TableCell>{loc.posicao || '-'}</TableCell>
                    <TableCell>
                      <Badge className={loc.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                        {loc.active !== false ? 'Ativo' : 'Inativo'}
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
                          <DropdownMenuItem onClick={() => { setSelectedLabel(loc); setLabelDialogOpen(true); }}>
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimir Etiqueta
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditing(loc); setDialogOpen(true); }}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteConfirm(loc)} className="text-red-600">
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
            <DialogTitle>{editing ? 'Editar Localização' : 'Nova Localização'}</DialogTitle>
          </DialogHeader>
          <LocationForm
            location={editing}
            warehouses={warehouses}
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
          <p>Tem certeza que deseja excluir a localização <strong>{deleteConfirm?.barcode}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteConfirm.id)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Label Print Dialog */}
      <LabelPrintDialog
        open={labelDialogOpen}
        onClose={() => { setLabelDialogOpen(false); setSelectedLabel(null); }}
        label={selectedLabel}
        type="location"
      />

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Localizações</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Selecione um arquivo Excel (.xlsx) com as seguintes colunas:
              </p>
              <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                <p><strong>warehouse_code</strong> - Código do armazém (obrigatório)</p>
                <p><strong>barcode</strong> - Código de barras (obrigatório)</p>
                <p><strong>rua</strong> - Rua</p>
                <p><strong>modulo</strong> - Módulo</p>
                <p><strong>nivel</strong> - Nível</p>
                <p><strong>posicao</strong> - Posição</p>
                <p><strong>capacity</strong> - Capacidade</p>
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