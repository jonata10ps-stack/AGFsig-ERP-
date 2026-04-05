import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  MoreHorizontal,
  Package,
  Filter,
  Download,
  Upload,
  QrCode,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import LabelPrintDialog from '@/components/label/LabelPrintDialog';
import * as XLSX from 'xlsx';

const UNITS = ['UN', 'KG', 'L', 'M', 'M2', 'M3', 'CX', 'PC'];

function ProductForm({ product, onSave, onCancel, loading }) {
  const [form, setForm] = useState(product || {
    sku: '',
    name: '',
    cod_finame: '',
    unit: 'UN',
    category: '',
    min_stock: 0,
    max_stock: 0,
    cost_price: 0,
    sale_price: 0,
    active: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.sku || !form.name) {
      toast.error('SKU e Nome são obrigatórios');
      return;
    }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>SKU *</Label>
          <Input
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
            placeholder="PROD-001"
          />
        </div>
        <div className="space-y-2">
          <Label>Unidade</Label>
          <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map(u => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
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
          placeholder="Nome do produto"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Ex: Matéria-prima, Acabado"
          />
        </div>
        <div className="space-y-2">
          <Label>Cod. FINAME</Label>
          <Input
            value={form.cod_finame}
            onChange={(e) => setForm({ ...form, cod_finame: e.target.value.toUpperCase() })}
            placeholder="Código FINAME"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estoque Mínimo</Label>
          <Input
            type="number"
            value={form.min_stock}
            onChange={(e) => setForm({ ...form, min_stock: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Estoque Máximo</Label>
          <Input
            type="number"
            value={form.max_stock}
            onChange={(e) => setForm({ ...form, max_stock: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Preço de Custo</Label>
          <Input
            type="number"
            step="0.01"
            value={form.cost_price}
            onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Preço de Venda</Label>
          <Input
            type="number"
            step="0.01"
            value={form.sale_price}
            onChange={(e) => setForm({ ...form, sale_price: parseFloat(e.target.value) || 0 })}
          />
        </div>
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

export default function Products() {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyId();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFiles, setImportFiles] = useState([]);
  const [importing, setImporting] = useState(false);

  const [tablePage, setTablePage] = useState(0);
  const TABLE_PAGE_SIZE = 50;

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.listAll({ company_id: companyId }, 'sku') : Promise.resolve([]),
    enabled: !!companyId,
    staleTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: (newProduct) => {
      queryClient.invalidateQueries({ queryKey: ['products', companyId] });
      setDialogOpen(false);
      toast.success('Produto criado com sucesso');

      // Abrir automaticamente o diálogo de impressão de etiqueta
      setSelectedLabel(newProduct);
      setLabelDialogOpen(true);
    },
    onError: (error) => toast.error('Erro ao criar produto: ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', companyId] });
      setDialogOpen(false);
      setEditingProduct(null);
      toast.success('Produto atualizado com sucesso');
    },
    onError: (error) => toast.error('Erro ao atualizar produto: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (product) => {
      // Verificar se há movimentações de estoque para este produto
      const moves = await base44.entities.InventoryMove.filter({ product_id: product.id });
      if (moves && moves.length > 0) {
        throw new Error(`Este produto possui ${moves.length} movimentação(ões) de estoque e não pode ser excluído.`);
      }
      return base44.entities.Product.delete(product.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', companyId] });
      setDeleteConfirm(null);
      toast.success('Produto excluído com sucesso');
    },
    onError: (error) => toast.error('Erro: ' + error.message),
  });

  const handleSave = (data) => {
    if (editingProduct) {
      // Ao editar, verifica se outro produto já tem o mesmo SKU
      const duplicate = products?.find(p => p.sku?.toUpperCase() === data.sku?.toUpperCase() && p.id !== editingProduct.id);
      if (duplicate) {
        toast.error(`SKU "${data.sku}" já está cadastrado em outro produto.`);
        return;
      }
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      // Ao criar, verifica se SKU já existe
      const duplicate = products?.find(p => p.sku?.toUpperCase() === data.sku?.toUpperCase());
      if (duplicate) {
        toast.error(`SKU "${data.sku}" já está cadastrado. Use outro código.`);
        return;
      }
      createMutation.mutate({ ...data, company_id: companyId });
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingProduct(null);
    setDialogOpen(true);
  };

  const filteredProducts = products?.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const totalTablePages = filteredProducts ? Math.ceil(filteredProducts.length / TABLE_PAGE_SIZE) : 0;
  const pagedProducts = filteredProducts?.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setTablePage(0);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const parseExcelFile = async (file) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    return rows.map(row => {
      const keys = Object.keys(row).reduce((acc, k) => { acc[k.toLowerCase().trim()] = row[k]; return acc; }, {});
      return {
        sku: String(keys['sku'] || '').trim().toUpperCase(),
        name: String(keys['name'] || keys['nome'] || '').trim(),
        unit: String(keys['unit'] || keys['unidade'] || 'UN').trim().toUpperCase() || 'UN',
        category: String(keys['category'] || keys['categoria'] || '').trim(),
        min_stock: parseFloat(keys['min_stock'] || keys['estoque_minimo'] || 0) || 0,
        max_stock: parseFloat(keys['max_stock'] || keys['estoque_maximo'] || 0) || 0,
        cost_price: parseFloat(keys['cost_price'] || keys['preco_custo'] || 0) || 0,
        sale_price: parseFloat(keys['sale_price'] || keys['preco_venda'] || 0) || 0,
      };
    }).filter(p => p.sku && p.name);
  };

  const handleImport = async () => {
    if (!importFiles.length) {
      toast.error('Selecione ao menos um arquivo Excel');
      return;
    }

    setImporting(true);
    try {
      // Ler todos os arquivos e combinar os itens
      const allParsed = await Promise.all(importFiles.map(parseExcelFile));
      const importedItems = allParsed.flat();

      // Remover duplicatas dentro do próprio arquivo (mesmo SKU repetido)
      const seen = new Set();
      const uniqueItems = importedItems.filter(p => {
        if (seen.has(p.sku)) return false;
        seen.add(p.sku);
        return true;
      });

      if (uniqueItems.length === 0) {
        throw new Error('Nenhum produto válido encontrado (verifique se as colunas sku e name/nome existem)');
      }

      // Buscar produtos existentes para verificar SKUs
      const existingProducts = await base44.entities.Product.filter({ company_id: companyId }, 'sku', 9999);
      const existingSkus = new Set(existingProducts.map(p => p.sku?.toUpperCase()));

      const newItems = uniqueItems.filter(p => !existingSkus.has(p.sku));
      const skippedCount = uniqueItems.length - newItems.length;

      if (newItems.length === 0) {
        toast.warning(`Todos os ${uniqueItems.length} produto(s) já existem no cadastro. Nenhum item foi importado.`);
        return;
      }

      const CHUNK_SIZE = 100;
      let created = 0;
      for (let i = 0; i < newItems.length; i += CHUNK_SIZE) {
        const chunk = newItems.slice(i, i + CHUNK_SIZE);
        await base44.entities.Product.bulkCreate(chunk.map(p => ({
          company_id: companyId,
          sku: p.sku, name: p.name, unit: p.unit, category: p.category,
          min_stock: p.min_stock, max_stock: p.max_stock,
          cost_price: p.cost_price, sale_price: p.sale_price, active: true
        })));
        created += chunk.length;
      }

      queryClient.invalidateQueries({ queryKey: ['products', companyId] });
      setImportDialogOpen(false);
      setImportFiles([]);

      const msg = skippedCount > 0
        ? `${created} produto(s) importado(s). ${skippedCount} já existiam e foram ignorados.`
        : `${created} produto(s) importado(s) com sucesso.`;
      toast.success(msg);
    } catch (error) {
      toast.error('Erro ao importar: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  if (companyLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="text-slate-500">Gerencie seu catálogo de produtos</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportDialogOpen(true)} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Importar Excel
          </Button>
          <Button onClick={handleNew} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por SKU, nome ou categoria..."
                value={search}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                </div>
              ))}
            </div>
          ) : filteredProducts?.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum produto encontrado</p>
              <Button onClick={handleNew} variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro produto
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Venda</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedProducts?.map((product) => (
                    <TableRow key={product.id} className="cursor-pointer hover:bg-slate-50">
                      <TableCell className="font-mono font-medium text-indigo-600">
                        {product.sku}
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-slate-500">{product.category || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.unit}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(product.cost_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(product.sale_price)}</TableCell>
                      <TableCell>
                        <Badge className={product.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                          {product.active !== false ? 'Ativo' : 'Inativo'}
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
                            <DropdownMenuItem onClick={() => { setSelectedLabel(product); setLabelDialogOpen(true); }}>
                              <QrCode className="h-4 w-4 mr-2" />
                              Imprimir Etiqueta
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(product)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirm(product)}
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
                  <span className="text-sm text-slate-500">
                    {filteredProducts?.length} produto(s) · Pág. {tablePage + 1}/{totalTablePages}
                  </span>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <ProductForm
            product={editingProduct}
            onSave={handleSave}
            onCancel={() => {
              setDialogOpen(false);
              setEditingProduct(null);
            }}
            loading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600">
            Tem certeza que deseja excluir o produto <strong>{deleteConfirm?.name}</strong>?
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Produtos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Selecione um arquivo Excel (.xlsx) com as seguintes colunas:
              </p>
              <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                <p><strong>sku</strong> - Código do produto (obrigatório)</p>
                <p><strong>name</strong> ou <strong>nome</strong> - Nome do produto (obrigatório)</p>
                <p><strong>unit</strong> ou <strong>unidade</strong> - Unidade (UN, KG, L, etc.)</p>
                <p><strong>category</strong> ou <strong>categoria</strong> - Categoria</p>
                <p><strong>min_stock</strong> ou <strong>estoque_minimo</strong> - Estoque mínimo</p>
                <p><strong>max_stock</strong> ou <strong>estoque_maximo</strong> - Estoque máximo</p>
                <p><strong>cost_price</strong> ou <strong>preco_custo</strong> - Preço de custo</p>
                <p><strong>sale_price</strong> ou <strong>preco_venda</strong> - Preço de venda</p>
                <p className="text-slate-400 pt-1">Sem limite de linhas. Colunas aceitas em maiúsculas ou minúsculas.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Arquivo Excel</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={(e) => setImportFiles(Array.from(e.target.files))}
              />
              {importFiles.length > 0 && (
                <p className="text-xs text-slate-500">{importFiles.length} arquivo(s) selecionado(s)</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportFiles([]); }}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={importing || !importFiles.length}>
              {importing ? 'Importando...' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Label Print Dialog */}
      <LabelPrintDialog
        open={labelDialogOpen}
        onClose={() => { setLabelDialogOpen(false); setSelectedLabel(null); }}
        label={selectedLabel}
        type="product"
      />
    </div>
  );
}