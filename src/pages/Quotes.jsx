import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Trash2, MoreHorizontal, FileText } from 'lucide-react';
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
import { useCompanyId } from '@/components/useCompanyId';
import ClientSearchSelect from '@/components/clients/ClientSearchSelect';

const STATUS_CONFIG = {
  RASCUNHO: { color: 'bg-slate-100 text-slate-700', label: 'Rascunho' },
  CONFIRMADO: { color: 'bg-blue-100 text-blue-700', label: 'Confirmado' },
  CONVERTIDO: { color: 'bg-emerald-100 text-emerald-700', label: 'Convertido' },
  REJEITADO: { color: 'bg-rose-100 text-rose-700', label: 'Rejeitado' },
  EXPIRADO: { color: 'bg-amber-100 text-amber-700', label: 'Expirado' },
};

function NewQuoteForm({ clients, sellers, paymentConditions, onSave, onCancel, loading }) {
  const [form, setForm] = useState({ 
    client_id: '', 
    client_name: '',
    seller_id: '',
    seller_name: '',
    payment_condition_id: '',
    payment_condition_name: '',
    validity_date: '',
    delivery_date: '',
    notes: ''
  });

  const handleClientChange = (clientId, client) => {
    setForm({ ...form, client_id: clientId, client_name: client?.name || '' });
  };

  const handleSellerChange = (sellerId) => {
    const seller = sellers?.find(s => s.id === sellerId);
    setForm({ ...form, seller_id: sellerId, seller_name: seller?.name || '' });
  };

  const handlePaymentConditionChange = (conditionId) => {
    const condition = paymentConditions?.find(c => c.id === conditionId);
    setForm({ ...form, payment_condition_id: conditionId, payment_condition_name: condition?.name || '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.client_id) {
      toast.error('Cliente é obrigatório');
      return;
    }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ClientSearchSelect
        label="Cliente"
        value={form.client_id}
        onSelect={handleClientChange}
        placeholder="Digite nome, código ou CNPJ/CPF..."
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Vendedor</Label>
          <Select value={form.seller_id} onValueChange={handleSellerChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {sellers?.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Condição de Pagamento</Label>
          <Select value={form.payment_condition_id} onValueChange={handlePaymentConditionChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {paymentConditions?.map(pc => (
                <SelectItem key={pc.id} value={pc.id}>
                  {pc.name} ({pc.installments}x)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Validade do Orçamento</Label>
          <Input
            type="date"
            value={form.validity_date}
            onChange={(e) => setForm({ ...form, validity_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Data de Entrega</Label>
          <Input
            type="date"
            value={form.delivery_date}
            onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Observações do orçamento"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Criando...' : 'Criar Orçamento'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function Quotes() {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyId();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [tablePage, setTablePage] = useState(0);
  const TABLE_PAGE_SIZE = 50;

  const { data: result, isLoading } = useQuery({
    queryKey: ['quotes', companyId, tablePage, search, filterStatus],
    queryFn: async () => {
      if (!companyId) return { data: [], count: 0 };
      
      const conditions = { company_id: companyId };
      if (filterStatus !== 'all') {
        conditions.status = filterStatus;
      }

      const searchFields = search ? ['quote_number', 'client_name', 'client_document'] : [];
      
      return base44.entities.Quote.queryPaginated(
        conditions, 
        '-created_date', 
        TABLE_PAGE_SIZE, 
        tablePage * TABLE_PAGE_SIZE,
        searchFields,
        search
      );
    },
    enabled: !!companyId,
  });

  const quotes = result?.data || [];
  const totalCount = result?.count || 0;

  const { data: clients } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => companyId ? base44.entities.Client.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: sellers } = useQuery({
    queryKey: ['sellers', companyId],
    queryFn: () => companyId ? base44.entities.Seller.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: paymentConditions } = useQuery({
    queryKey: ['payment-conditions', companyId],
    queryFn: () => companyId ? base44.entities.PaymentCondition.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Get last quote number to generate sequential
      const allQuotes = await base44.entities.Quote.filter({ company_id: companyId }, '-created_date');
      let nextNumber = 1;
      if (allQuotes && allQuotes.length > 0) {
        const lastQuote = allQuotes[0];
        if (lastQuote.quote_number) {
          const match = lastQuote.quote_number.match(/ORC-(\d+)/);
          if (match) {
            nextNumber = parseInt(match[1]) + 1;
          }
        }
      }
      const quoteNumber = `ORC-${String(nextNumber).padStart(6, '0')}`;
      
      const client = clients?.find(c => c.id === data.client_id);
      return base44.entities.Quote.create({
        company_id: companyId,
        quote_number: quoteNumber,
        client_id: data.client_id,
        client_name: data.client_name,
        client_document: client?.document || '',
        seller_id: data.seller_id || '',
        seller_name: data.seller_name || '',
        payment_condition_id: data.payment_condition_id || '',
        payment_condition_name: data.payment_condition_name || '',
        validity_date: data.validity_date,
        delivery_date: data.delivery_date,
        notes: data.notes || '',
        status: 'RASCUNHO',
        total_amount: 0,
      });
    },
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', companyId] });
      setDialogOpen(false);
      toast.success('Orçamento criado');
      window.location.href = createPageUrl(`QuoteDetail?id=${quote.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Quote.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', companyId] });
      setDeleteConfirm(null);
      toast.success('Orçamento excluído');
    },
  });

  const totalTablePages = Math.ceil(totalCount / TABLE_PAGE_SIZE);

  const pagedQuotes = React.useMemo(() => {
    if (!quotes || !search) return quotes;
    const s = search.toLowerCase();
    return [...quotes].sort((a, b) => {
      const aNum = a.quote_number?.toLowerCase() || '';
      const bNum = b.quote_number?.toLowerCase() || '';
      const aClient = a.client_name?.toLowerCase() || '';
      const bClient = b.client_name?.toLowerCase() || '';

      // 1. Exact match
      const aExact = aNum === s || aClient === s;
      const bExact = bNum === s || bClient === s;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      // 2. Starts with search string
      const aStarts = aNum.startsWith(s) || aClient.startsWith(s);
      const bStarts = bNum.startsWith(s) || bClient.startsWith(s);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      return 0;
    });
  }, [quotes, search]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setTablePage(0);
  };

  const handleStatusChange = (val) => {
    setFilterStatus(val);
    setTablePage(0);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orçamentos</h1>
          <p className="text-slate-500">Gerencie os orçamentos de vendas</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-indigo-600">
          <Plus className="h-4 w-4 mr-2" />
          Novo Orçamento
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
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={handleStatusChange}>
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
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : totalCount === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum orçamento encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedQuotes?.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell>
                      <span className="font-mono text-indigo-600 font-medium">
                        {quote.quote_number || `#${quote.id.slice(0, 8)}`}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{quote.client_name}</TableCell>
                    <TableCell className="text-slate-500">
                      {quote.created_date ? format(new Date(quote.created_date), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {quote.delivery_date ? format(new Date(quote.delivery_date), 'dd/MM/yyyy', { locale: ptBR }) : 'Não informada'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(quote.total_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_CONFIG[quote.status]?.color}>
                        {STATUS_CONFIG[quote.status]?.label}
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
                          <DropdownMenuItem asChild>
                            <Link to={createPageUrl(`QuoteDetail?id=${quote.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </Link>
                          </DropdownMenuItem>
                          
                          {/* Opção de Cancelar (Rejeitar) */}
                          {quote.status !== 'REJEITADO' && quote.status !== 'CONVERTIDO' && (
                            <DropdownMenuItem 
                              onClick={async () => {
                                if (window.confirm("Deseja realmente CANCELAR este orçamento?")) {
                                  try {
                                    await base44.entities.Quote.update(quote.id, { status: 'REJEITADO' });
                                    queryClient.invalidateQueries({ queryKey: ['quotes'] });
                                    toast.success("Orçamento cancelado");
                                  } catch (err) {
                                    toast.error("Erro ao cancelar: " + err.message);
                                  }
                                }
                              }}
                              className="text-amber-600"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Cancelar Orçamento
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />
                          {quote.status !== 'CONVERTIDO' && (
                            <DropdownMenuItem 
                              disabled={quote.notes?.includes('Gerado a partir da OS')}
                              onClick={() => {
                                if (quote.notes?.includes('Gerado a partir da OS')) {
                                  toast.error("Orçamentos vinculados a OS não podem ser excluídos, apenas cancelados.");
                                  return;
                                }
                                setDeleteConfirm(quote);
                              }} 
                              className={quote.notes?.includes('Gerado a partir da OS') ? "text-slate-400 opacity-50 cursor-not-allowed" : "text-red-600"}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          )}
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
                  Exibindo <span className="font-medium">{Math.min(totalCount, tablePage * TABLE_PAGE_SIZE + 1)}-{Math.min(totalCount, (tablePage + 1) * TABLE_PAGE_SIZE)}</span> de <span className="font-medium">{totalCount}</span> orçamentos 
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Orçamento</DialogTitle>
          </DialogHeader>
          <NewQuoteForm
            clients={clients}
            sellers={sellers}
            paymentConditions={paymentConditions}
            onSave={(data) => createMutation.mutate(data)}
            onCancel={() => setDialogOpen(false)}
            loading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja excluir este orçamento?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteConfirm.id)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}