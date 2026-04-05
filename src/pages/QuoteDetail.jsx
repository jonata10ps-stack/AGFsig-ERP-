import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { ArrowLeft, Plus, Trash2, Save, CheckCircle, FileText, Download, X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import QuotePrintTemplate from '@/components/quotes/QuotePrintTemplate';
import CancelOrderDialog from '@/components/sales/CancelOrderDialog';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';

const STATUS_CONFIG = {
  RASCUNHO: { color: 'bg-slate-100 text-slate-700', label: 'Rascunho' },
  CONFIRMADO: { color: 'bg-blue-100 text-blue-700', label: 'Confirmado' },
  CONVERTIDO: { color: 'bg-emerald-100 text-emerald-700', label: 'Convertido' },
  REJEITADO: { color: 'bg-rose-100 text-rose-700', label: 'Rejeitado' },
  EXPIRADO: { color: 'bg-amber-100 text-amber-700', label: 'Expirado' },
};

function SubitemForm({ quoteItemId, onAdd, onCancel, loading }) {
  const [form, setForm] = useState({ product_name: '', qty: 1, unit_price: 0 });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.product_name || form.qty <= 0 || form.unit_price < 0) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }
    onAdd({ ...form, quote_item_id: quoteItemId });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Descrição *</Label>
        <Input
          value={form.product_name}
          onChange={(e) => setForm({ ...form, product_name: e.target.value })}
          placeholder="Ex: Instalação, Configuração, etc"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Quantidade *</Label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Preço Unitário *</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.unit_price}
            onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>Adicionar</Button>
      </DialogFooter>
    </form>
  );
}

function ItemForm({ item, products, onSave, onCancel, loading }) {
  const [form, setForm] = useState(item || {
    product_id: '',
    product_sku: '',
    product_name: '',
    qty: 1,
    unit_price: 0,
  });

  const handleProductChange = (productId) => {
    const product = products?.find(p => p.id === productId);
    setForm({
      ...form,
      product_id: productId,
      product_sku: product?.sku || '',
      product_name: product?.name || '',
      unit_price: product?.sale_price || 0
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.product_id || form.qty <= 0) {
      toast.error('Produto e quantidade são obrigatórios');
      return;
    }
    const total_price = form.qty * form.unit_price;
    onSave({ ...form, total_price });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ProductSearchSelect
        label="Produto"
        value={form.product_id}
        onSelect={handleProductChange}
        placeholder="Buscar por código ou descrição..."
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Quantidade *</Label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Preço Unitário</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.unit_price}
            onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="p-3 bg-slate-50 rounded-lg">
        <p className="text-sm text-slate-600">
          Total: <span className="font-semibold">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(form.qty * form.unit_price)}
          </span>
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>Adicionar</Button>
      </DialogFooter>
    </form>
  );
}

function ConvertToOrderDialog({ open, onClose, quote, onConvert, loading }) {
  const [externalNumber, setExternalNumber] = useState('');

  const handleConvert = () => {
    if (!externalNumber.trim()) {
      toast.error('Número do pedido externo é obrigatório');
      return;
    }
    onConvert(externalNumber);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Efetivar Orçamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Este orçamento será convertido para Pedido de Venda. Os subitens serão consolidados no valor final do item principal.
          </p>
          <div>
            <Label>Número do Pedido Externo (TOTVS) *</Label>
            <Input
              value={externalNumber}
              onChange={(e) => setExternalNumber(e.target.value)}
              placeholder="Ex: 123456"
              className="mt-2"
              autoFocus
            />
          </div>
          <div className="bg-slate-50 p-3 rounded-lg text-sm">
            <p className="text-slate-600">Total a faturar: <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote?.total_amount || 0)}</strong></p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={handleConvert} disabled={loading} className="bg-emerald-600">
            {loading ? 'Efetivando...' : 'Efetivar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function QuoteDetail() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const quoteId = urlParams.get('id');

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [subitemDialogOpen, setSubitemDialogOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState(null);
  const [selectedQuoteItem, setSelectedQuoteItem] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cancelConversionDialogOpen, setCancelConversionDialogOpen] = useState(false);
  const printRef = useRef();

  const { data: quote, isLoading: loadingQuote } = useQuery({
    queryKey: ['quote', quoteId],
    queryFn: () => base44.entities.Quote.filter({ id: quoteId }),
    select: (data) => data?.[0],
    enabled: !!quoteId,
  });

  const { data: quoteItems, isLoading: loadingItems } = useQuery({
    queryKey: ['quote-items', quoteId],
    queryFn: () => base44.entities.QuoteItem.filter({ quote_id: quoteId }),
    enabled: !!quoteId,
  });

  const { data: subitems } = useQuery({
    queryKey: ['quote-subitems', quoteId],
    queryFn: async () => {
      if (!quoteItems?.length) return [];
      const all = await base44.entities.QuoteSubitem.list();
      return all.filter(s => quoteItems.some(qi => qi.id === s.quote_item_id));
    },
    enabled: !!quoteItems?.length,
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ active: true }),
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.filter({ active: true }),
  });

  const { data: sellers } = useQuery({
    queryKey: ['sellers'],
    queryFn: () => base44.entities.Seller.filter({ active: true }),
  });

  const { data: attachments } = useQuery({
    queryKey: ['quote-attachments', quoteId],
    queryFn: () => base44.entities.QuoteAttachment.filter({ quote_id: quoteId }),
    enabled: !!quoteId,
  });

  const { data: productionRequests } = useQuery({
    queryKey: ['production-requests-order', quote?.converted_order_id, cancelConversionDialogOpen],
    queryFn: async () => {
      if (!quote?.converted_order_id) return [];
      
      try {
        // Buscar solicitações de produção vinculadas ao pedido
        const allRequests = await base44.entities.ProductionRequest.list();
        const linked = allRequests.filter(r => 
          r.origin_id === quote.converted_order_id || 
          r.order_id === quote.converted_order_id
        );
        return linked;
      } catch (err) {
        console.error('Erro ao buscar production requests:', err);
        return [];
      }
    },
    enabled: !!quote?.converted_order_id && cancelConversionDialogOpen,
    staleTime: 0,
  });

  const { data: productionOrders } = useQuery({
    queryKey: ['production-orders-for-quote', cancelConversionDialogOpen],
    queryFn: async () => {
      try {
        return await base44.entities.ProductionOrder.list();
      } catch (err) {
        console.error('Erro ao buscar production orders:', err);
        return [];
      }
    },
    enabled: cancelConversionDialogOpen,
    staleTime: 0,
  });

  const { data: client } = useQuery({
    queryKey: ['client', quote?.client_id],
    queryFn: () => base44.entities.Client.filter({ id: quote.client_id }),
    select: (data) => data?.[0],
    enabled: !!quote?.client_id,
  });

  const { data: paymentCondition } = useQuery({
    queryKey: ['payment-condition', quote?.payment_condition_id],
    queryFn: () => base44.entities.PaymentCondition.filter({ id: quote.payment_condition_id }),
    select: (data) => data?.[0],
    enabled: !!quote?.payment_condition_id,
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Orcamento_${quote?.quote_number || 'sem_numero'}`,
  });

  const addItemMutation = useMutation({
    mutationFn: async (data) => {
      const baseTotal = data.qty * data.unit_price;
      
      const quote = await base44.entities.Quote.filter({ id: quoteId });
      if (!quote?.[0]) throw new Error('Orçamento não encontrado');
      
      await base44.entities.QuoteItem.create({
        company_id: quote[0].company_id,
        quote_id: quoteId,
        product_id: data.product_id,
        product_sku: data.product_sku,
        product_name: data.product_name,
        qty: data.qty,
        unit_price: data.unit_price,
        base_total: baseTotal,
        subitems_total: 0,
        final_total: baseTotal,
        line_sequence: (quoteItems?.length || 0) + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-items', quoteId] });
      setItemDialogOpen(false);
      toast.success('Item adicionado');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao adicionar item');
    }
  });

  const addSubitemMutation = useMutation({
    mutationFn: async (subitem) => {
      const totalPrice = subitem.qty * subitem.unit_price;
      
      const quoteData = await base44.entities.Quote.filter({ id: quoteId });
      if (!quoteData?.[0]) throw new Error('Orçamento não encontrado');
      
      await base44.entities.QuoteSubitem.create({
        company_id: quoteData[0].company_id,
        ...subitem,
        total_price: totalPrice,
        line_sequence: 1,
      });

      // Atualizar totais do item
      const quoteItem = quoteItems?.find(qi => qi.id === subitem.quote_item_id);
      if (quoteItem) {
        const itemSubitems = subitems?.filter(s => s.quote_item_id === quoteItem.id) || [];
        const subitemTotal = itemSubitems.reduce((sum, s) => Number(sum) + Number(s.total_price || 0), 0) + Number(totalPrice);
        
        await base44.entities.QuoteItem.update(quoteItem.id, {
          subitems_total: subitemTotal,
          final_total: Number(quoteItem.base_total || 0) + subitemTotal,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-subitems', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quote-items', quoteId] });
      setSubitemDialogOpen(false);
      setSelectedQuoteItem(null);
      toast.success('Subitem adicionado');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao adicionar subitem');
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId) => {
      // Deletar subitens associados
      const itemSubitems = subitems?.filter(s => s.quote_item_id === itemId) || [];
      await Promise.all(itemSubitems.map(s => base44.entities.QuoteSubitem.delete(s.id)));
      
      await base44.entities.QuoteItem.delete(itemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-items', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quote-subitems', quoteId] });
      setDeleteItemConfirm(null);
      toast.success('Item removido');
    },
  });

  const deleteSubitemMutation = useMutation({
    mutationFn: async (subitemId) => {
      const subitem = subitems?.find(s => s.id === subitemId);
      await base44.entities.QuoteSubitem.delete(subitemId);

      if (subitem) {
        const quoteItem = quoteItems?.find(qi => qi.id === subitem.quote_item_id);
        if (quoteItem) {
          const remainingSubitems = subitems?.filter(s => s.quote_item_id === quoteItem.id && s.id !== subitemId) || [];
          const subitemTotal = remainingSubitems.reduce((sum, s) => Number(sum) + Number(s.total_price || 0), 0);
          
          await base44.entities.QuoteItem.update(quoteItem.id, {
            subitems_total: subitemTotal,
            final_total: Number(quoteItem.base_total || 0) + subitemTotal,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-subitems', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quote-items', quoteId] });
      toast.success('Subitem removido');
    },
  });

  const saveQuoteMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Quote.update(quoteId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
      toast.success('Orçamento salvo');
    },
  });

  const confirmQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!quoteItems?.length) {
        throw new Error('Adicione itens ao orçamento');
      }
      return base44.entities.Quote.update(quoteId, { status: 'CONFIRMADO' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
      toast.success('Orçamento confirmado');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (id) => base44.entities.QuoteAttachment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-attachments', quoteId] });
      toast.success('Anexo removido');
    },
  });

  const cancelConversionMutation = useMutation({
    mutationFn: async (decisions) => {
      if (quote.converted_order_id) {
        // Desconectar quote primeiro
        await base44.entities.Quote.update(quoteId, {
          status: 'CONFIRMADO',
          converted_order_id: null,
          converted_at: null,
        });

        // Buscar quote vinculado e desconectar
        const quotes = await base44.entities.Quote.list();
        const linkedQuote = quotes?.find(q => q.converted_order_id === quote.converted_order_id);
        if (linkedQuote) {
          await base44.entities.Quote.update(linkedQuote.id, {
            status: 'CONFIRMADO',
            converted_order_id: null,
            converted_at: null,
          });
        }

        // Processar decisões sobre solicitações de produção
        if (decisions) {
          // Cancelar solicitações pendentes
          for (const decision of decisions.pendingRequests) {
            if (decision.action === 'CANCELAR') {
              const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm');
              const nota = `[${timestamp}] Cancelada por cancelamento de pedido de venda`;
              const req = productionRequests?.find(r => r.id === decision.id);
              const notasAtualizadas = req?.notes ? `${req.notes}\n${nota}` : nota;

              await base44.entities.ProductionRequest.update(decision.id, { 
                status: 'CANCELADA',
                notes: notasAtualizadas
              });
            }
          }

            // Processar OPs em andamento (solicitações não concluídas)
            for (const decision of decisions.inProgressOps) {
              if (decision.action === 'CANCELAR') {
                // Cancelar a solicitação
                await base44.entities.ProductionRequest.update(decision.requestId, { 
                  status: 'CANCELADA'
                });

                // Cancelar todas as OPs associadas
                if (decision.opIds && decision.opIds.length > 0) {
                  const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm');
                  for (const opId of decision.opIds) {
                    const op = productionOrders?.find(o => o.id === opId);
                    const notaCancel = `[${timestamp}] Cancelada por cancelamento de pedido de venda`;
                    const notasAtualizadas = op?.notes ? `${op.notes}\n${notaCancel}` : notaCancel;

                    await base44.entities.ProductionOrder.update(opId, {
                      status: 'CANCELADA',
                      cancellation_reason: 'Pedido de venda cancelado',
                      notes: notasAtualizadas
                    });
                  }
                }
              } else if (decision.action === 'MANTER') {
                // Manter solicitação e OPs, mas registrar no histórico
                const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm');
                const nota = `[${timestamp}] Pedido de venda foi cancelado, mas SC mantida em aberto`;

                await base44.entities.ProductionRequest.update(decision.requestId, { 
                  origin_id: null,
                  notes: (productionRequests?.find(r => r.id === decision.requestId)?.notes || '') + '\n' + nota
                });

                // Registrar também nas OPs
                if (decision.opIds && decision.opIds.length > 0) {
                  for (const opId of decision.opIds) {
                    const op = productionOrders?.find(o => o.id === opId);
                    const notaOp = `[${timestamp}] Pedido de origem cancelado, mas OP mantida em aberto`;
                    const notasAtualizadas = op?.notes ? `${op.notes}\n${notaOp}` : notaOp;

                    await base44.entities.ProductionOrder.update(opId, { 
                      notes: notasAtualizadas
                    });
                  }
                }
              }
            }

          // Processar solicitações concluídas
          for (const decision of decisions.completedRequests) {
            if (decision.action === 'ELIMINAR_RESIDUO' && decision.id) {
              const order = await base44.entities.SalesOrder.filter({ id: quote.converted_order_id });
              const request = productionRequests?.find(r => r.id === decision.id);
              if (request && request.qty_residue > 0) {
                await base44.entities.InventoryMove.create({
                  company_id: order?.[0]?.company_id,
                  type: 'BAIXA',
                  product_id: request.product_id,
                  qty: request.qty_residue,
                  reason: 'Cancelamento de orçamento - eliminação de resíduo',
                  baixa_motivo: 'Cancelamento de orçamento',
                  related_type: 'PEDIDO',
                  related_id: quote.converted_order_id,
                });
              }
              await base44.entities.ProductionRequest.update(decision.id, { qty_residue: 0 });
            }
          }
        }

        // Deletar itens do pedido
        const orderItems = await base44.entities.SalesOrderItem.filter({ order_id: quote.converted_order_id });
        for (const item of orderItems) {
          await base44.entities.SalesOrderItem.delete(item.id);
        }

        // Deletar pedido
        await base44.entities.SalesOrder.delete(quote.converted_order_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
      setCancelConversionDialogOpen(false);
      toast.success('Conversão cancelada, orçamento voltou para confirmado');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const convertMutation = useMutation({
    mutationFn: async (externalNumber) => {
      if (!quoteItems?.length) {
        throw new Error('Adicione itens ao orçamento');
      }

      const order = await base44.entities.SalesOrder.create({
        company_id: quote.company_id,
        numero_pedido_externo: externalNumber,
        client_id: quote.client_id,
        client_name: quote.client_name,
        seller_id: quote.seller_id || '',
        seller_name: quote.seller_name || '',
        payment_condition_id: quote.payment_condition_id || '',
        payment_condition_name: quote.payment_condition_name || '',
        status: 'RASCUNHO',
        total_amount: quote.total_amount,
        delivery_date: quote.delivery_date,
        notes: quote.notes,
      });

      await Promise.all(
       quoteItems.map(qItem =>
         base44.entities.SalesOrderItem.create({
           company_id: quote.company_id,
           order_id: order.id,
           product_id: qItem.product_id,
           product_sku: qItem.product_sku,
           product_name: qItem.product_name,
           qty: qItem.qty,
           unit_price: qItem.final_total / qItem.qty,
           total_price: qItem.final_total,
           fulfill_mode: 'AUTO',
           qty_reserved: 0,
           qty_separated: 0,
         })
       )
      );

      await base44.entities.Quote.update(quoteId, {
        status: 'CONVERTIDO',
        converted_order_id: order.id,
        converted_at: new Date().toISOString(),
      });

      return order;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
      setConvertOpen(false);
      toast.success('Orçamento convertido para pedido!');
      setTimeout(() => navigate(createPageUrl(`SalesOrderDetail?id=${order.id}`)), 1000);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Apenas arquivos PDF são aceitos');
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const fileType = file.name.toLowerCase().includes('projeto') ? 'projeto' : 'outro';
      
      await base44.entities.QuoteAttachment.create({
        quote_id: quoteId,
        file_url,
        file_name: file.name,
        file_type: fileType,
        description: '',
      });

      queryClient.invalidateQueries({ queryKey: ['quote-attachments', quoteId] });
      toast.success('Arquivo anexado com sucesso');
      e.target.value = '';
    } catch (error) {
      toast.error('Erro ao anexar arquivo');
    } finally {
      setUploading(false);
    }
  };

  // Recalculate total whenever items change
  React.useEffect(() => {
    if (!quoteItems?.length) {
      if (Number(quote?.total_amount || 0) !== 0) {
        base44.entities.Quote.update(quoteId, { total_amount: 0 });
        queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
      }
      return;
    }
    
    const total = quoteItems.reduce((sum, item) => Number(sum) + Number(item.final_total || 0), 0);
    if (total !== Number(quote?.total_amount || 0)) {
      base44.entities.Quote.update(quoteId, { total_amount: total });
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
    }
  }, [quoteItems]);

  if (loadingQuote) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Orçamento não encontrado</p>
        <Link to={createPageUrl('Quotes')}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const canEdit = quote.status === 'RASCUNHO' || quote.status === 'CONFIRMADO';
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Quotes')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Orçamento {quote.quote_number}
            </h1>
            <Badge className={STATUS_CONFIG[quote.status]?.color}>
              {STATUS_CONFIG[quote.status]?.label}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {(quote.status === 'RASCUNHO' || quote.status === 'CONFIRMADO') && quoteItems?.length > 0 && (
            <Button onClick={handlePrint} variant="outline">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          )}
          {quote.status === 'RASCUNHO' && !quoteItems?.length && (
            <p className="text-amber-600 text-sm">Adicione itens antes de confirmar</p>
          )}
          {quote.status === 'RASCUNHO' && quoteItems?.length > 0 && (
            <Button onClick={() => confirmQuoteMutation.mutate()} className="bg-indigo-600">
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Orçamento
            </Button>
          )}
          {quote.status === 'CONFIRMADO' && (
            <Button onClick={() => setConvertOpen(true)} className="bg-emerald-600">
              <CheckCircle className="h-4 w-4 mr-2" />
              Efetivar Pedido
            </Button>
          )}
          {quote.status === 'CONVERTIDO' && (
            <Button onClick={() => setCancelConversionDialogOpen(true)} variant="outline" className="text-amber-600 border-amber-300">
              Cancelar Conversão
            </Button>
          )}
        </div>
      </div>

      {/* Quote Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informações do Orçamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Cliente</p>
                  <p className="font-medium">{quote.client_name}</p>
                  {quote.client_document && (
                    <p className="text-xs text-slate-500">{quote.client_document}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-500">Data do Orçamento</p>
                    <p className="text-sm font-medium text-slate-900">
                      {quote.created_date ? format(new Date(quote.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Não informada'}
                    </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Vendedor</p>
                  <p className="font-medium">{quote.seller_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Condição de Pagamento</p>
                  <p className="font-medium">{quote.payment_condition_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Data de Validade</p>
                  <p className="font-medium">
                    {quote.validity_date ? format(new Date(quote.validity_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Data de Entrega</p>
                    <p className="text-sm font-medium text-slate-900">
                      {quote.delivery_date ? format(new Date(quote.delivery_date), 'dd/MM/yyyy', { locale: ptBR }) : 'Não informada'}
                    </p>
                </div>
              </div>
              
              {canEdit && (
                <div className="space-y-2 pt-4 border-t">
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Adicione observações ao orçamento"
                    rows={3}
                    defaultValue={quote.notes || ''}
                    onBlur={(e) => {
                      if (e.target.value !== (quote.notes || '')) {
                        saveQuoteMutation.mutate({ notes: e.target.value });
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {attachments?.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline text-sm">
                        <Download className="h-3 w-3" />
                        {att.file_name}
                      </a>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAttachmentMutation.mutate(att.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3 text-red-600" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Nenhum documento anexado</p>
              )}
              
              {canEdit && (
                <div className="pt-2 border-t">
                  <label className="flex items-center gap-2 text-sm text-indigo-600 cursor-pointer hover:underline">
                    <Plus className="h-4 w-4" />
                    {uploading ? 'Enviando...' : 'Anexar PDF'}
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Itens</span>
                <span className="font-medium">{quoteItems?.length || 0}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-medium">Total</span>
                <span className="font-bold text-indigo-600">{formatCurrency(quote.total_amount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Itens do Orçamento</CardTitle>
          {canEdit && (
            <Button onClick={() => setItemDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loadingItems ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : quoteItems?.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">Nenhum item adicionado</p>
              {canEdit && (
                <Button onClick={() => setItemDialogOpen(true)} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar primeiro item
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4 p-6">
              {quoteItems.map((item) => {
                const itemSubitems = subitems?.filter(s => s.quote_item_id === item.id) || [];
                return (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold">{item.product_name}</p>
                        <p className="text-sm text-slate-500">{item.product_sku}</p>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteItemConfirm(item)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm mb-4 pb-4 border-b">
                      <div>
                        <p className="text-slate-500">Quantidade</p>
                        <p className="font-medium">{item.qty}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Valor Unit.</p>
                        <p className="font-medium">{formatCurrency(item.unit_price)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Item Principal</p>
                        <p className="font-medium">{formatCurrency(item.base_total)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Total</p>
                        <p className="font-bold text-emerald-600">{formatCurrency(item.final_total)}</p>
                      </div>
                    </div>

                    {itemSubitems.length > 0 && (
                      <div className="ml-4 space-y-2 mb-3">
                        <p className="text-sm font-medium text-slate-700">Subitens (+ {formatCurrency(item.subitems_total)}):</p>
                        {itemSubitems.map(sub => (
                          <div key={sub.id} className="flex justify-between text-sm bg-slate-50 p-2 rounded">
                            <span>{sub.product_name} ({sub.qty}x {formatCurrency(sub.unit_price)})</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{formatCurrency(sub.total_price)}</span>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteSubitemMutation.mutate(sub.id)}
                                >
                                  <Trash2 className="h-3 w-3 text-red-600" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedQuoteItem(item.id);
                          setSubitemDialogOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-2" />
                        Adicionar Subitem
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
          </DialogHeader>
          <ItemForm
            products={products}
            onSave={(data) => addItemMutation.mutate(data)}
            onCancel={() => setItemDialogOpen(false)}
            loading={addItemMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Add Subitem Dialog */}
      {selectedQuoteItem && (
        <Dialog open={subitemDialogOpen} onOpenChange={setSubitemDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Subitem</DialogTitle>
            </DialogHeader>
            <SubitemForm
              quoteItemId={selectedQuoteItem}
              onAdd={(subitem) => addSubitemMutation.mutate(subitem)}
              onCancel={() => setSubitemDialogOpen(false)}
              loading={addSubitemMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Item Confirmation */}
      <Dialog open={!!deleteItemConfirm} onOpenChange={() => setDeleteItemConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Item</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja remover <strong>{deleteItemConfirm?.product_name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItemConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteItemMutation.mutate(deleteItemConfirm.id)}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Order Dialog */}
      <ConvertToOrderDialog
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        quote={quote}
        onConvert={(externalNumber) => convertMutation.mutate(externalNumber)}
        loading={convertMutation.isPending}
      />

      {/* Hidden Print Template */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <QuotePrintTemplate
          ref={printRef}
          quote={quote}
          quoteItems={quoteItems}
          subitems={subitems}
          client={client}
          paymentCondition={paymentCondition}
        />
      </div>

      {/* Cancel Conversion Dialog */}
      {cancelConversionDialogOpen && (
        <>
          {(productionRequests?.length || 0) > 0 || (productionOrders?.some(o => o.quote_id === quoteId || o.order_id === quote?.converted_order_id) || false) ? (
            <CancelOrderDialog
              open={cancelConversionDialogOpen}
              onClose={() => setCancelConversionDialogOpen(false)}
              productionRequests={productionRequests}
              productionOrders={productionOrders?.filter(o => o.quote_id === quoteId || o.order_id === quote?.converted_order_id)}
              onConfirm={(decisions) => {
                cancelConversionMutation.mutate(decisions);
              }}
              loading={cancelConversionMutation.isPending}
            />
          ) : (
            <Dialog open={cancelConversionDialogOpen} onOpenChange={setCancelConversionDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancelar Conversão</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-slate-600">
                  Nenhuma solicitação de produção ou OP vinculada. Deseja continuar com o cancelamento?
                </p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCancelConversionDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={() => cancelConversionMutation.mutate(null)}>
                    Confirmar Cancelamento
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-only, .print-only * {
            visibility: visible;
          }
          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
        @media screen {
          .print-only {
            display: none;
          }
          .print-only.visible {
            display: block;
          }
        }
      `}</style>
    </div>
  );
}