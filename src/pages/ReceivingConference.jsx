import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  ArrowLeft, CheckCircle, XCircle, Printer, Package, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import LabelGenerator from '../components/receiving/LabelGenerator';
import ConferenceWorkflow from '../components/receiving/ConferenceWorkflow';
import { QRCodeSVG } from 'qrcode.react';

export default function ReceivingConference() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const batchId = urlParams.get('batch');
  const [labelsDialogOpen, setLabelsDialogOpen] = useState(false);
  const [qrListDialogOpen, setQrListDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [workflowMode, setWorkflowMode] = useState(false);
  const [selectedRejectItem, setSelectedRejectItem] = useState(null);
  const [partialQty, setPartialQty] = useState(0);
  const [confirmQtyDialogOpen, setConfirmQtyDialogOpen] = useState(false);
  const [selectedItemForConfirm, setSelectedItemForConfirm] = useState(null);
  const [confirmedQty, setConfirmedQty] = useState(0);

  const { data: batch, isLoading: loadingBatch } = useQuery({
    queryKey: ['receiving-batch', batchId],
    queryFn: () => base44.entities.ReceivingBatch.filter({ id: batchId }),
    select: (data) => data?.[0],
    enabled: !!batchId,
  });

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['receiving-items', batchId],
    queryFn: () => base44.entities.ReceivingItem.filter({ batch_id: batchId }),
    enabled: !!batchId,
  });

  const { data: materialRequest } = useQuery({
    queryKey: ['material-request-batch', batchId],
    queryFn: async () => {
      if (!batch?.reason?.includes('Solicitação:')) return null;
      const match = batch.reason.match(/Solicitação: (.+)/);
      if (!match) return null;
      const requests = await base44.entities.MaterialRequest.filter({ request_number: match[1] });
      return requests?.[0];
    },
    enabled: !!batch,
  });

  const { data: materialRequestItems } = useQuery({
    queryKey: ['material-request-items', materialRequest?.id],
    queryFn: () => base44.entities.MaterialRequestItem.filter({ request_id: materialRequest.id }),
    enabled: !!materialRequest?.id,
  });

  const confirmItemMutation = useMutation({
     mutationFn: async ({ itemId, realQty, originalQty }) => {
       const user = await base44.auth.me();
       const item = items?.find(i => i.id === itemId);
       if (!item) return;

       // Buscar quantidade esperada da solicitação original, se houver
       let expectedQty = originalQty;
       if (materialRequestItems) {
         const requestItem = materialRequestItems.find(ri => ri.product_id === item.product_id);
         if (requestItem) {
           expectedQty = requestItem.qty_requested;
         }
       }

       const variance = realQty - expectedQty;

       // Atualizar item com quantidade confirmada
       await base44.entities.ReceivingItem.update(itemId, { 
         status: 'CONFERIDO',
         qty: realQty
       });

       // Se houver diferença, criar não-conformidade
       if (variance !== 0) {
         const reportNumber = `NCR-${Date.now()}-${itemId.substring(0, 4)}`;
         const varianceType = variance > 0 ? 'EXCESSO' : 'FALTANTE';

         await base44.entities.NonConformityReport.create({
           company_id: user.company_id,
           report_number: reportNumber,
           receiving_batch_id: batchId,
           receiving_item_id: itemId,
           product_id: item.product_id,
           product_sku: item.product_sku,
           product_name: item.product_name,
           quantity_expected: expectedQty,
           quantity_received: realQty,
           variance: variance,
           variance_type: varianceType,
           order_id: batch?.order_id,
           order_number: batch?.order_number,
           status: 'ABERTO',
           action_type: 'NENHUMA'
         });
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['receiving-items', batchId] });
       setConfirmQtyDialogOpen(false);
       setSelectedItemForConfirm(null);
       setConfirmedQty(0);
       toast.success('Item conferido');
     },
     onError: (error) => {
       toast.error('Erro ao confirmar item: ' + error.message);
     }
   });

   const rejectItemMutation = useMutation({
     mutationFn: async ({ item, receivedQty }) => {
       const qtyToReject = item.qty - receivedQty;

       if (receivedQty > 0) {
         // Atualizar item para quantidade recebida
         await base44.entities.ReceivingItem.update(item.id, { 
           qty: receivedQty,
           status: 'CONFERIDO'
         });
       } else {
         // Deletar item se nada for recebido
         await base44.entities.ReceivingItem.delete(item.id);
       }

       // Voltar quantidade rejeitada para pendente se existir
       if (qtyToReject > 0 && item.batch_id) {
         const batch = await base44.entities.ReceivingBatch.filter({ id: item.batch_id });
         if (batch?.[0]?.order_id) {
           const orderItems = await base44.entities.SalesOrderItem.filter({ order_id: batch[0].order_id });
           const matchingItem = orderItems?.find(oi => oi.product_id === item.product_id);
           if (matchingItem) {
             await base44.entities.SalesOrderItem.update(matchingItem.id, {
               qty_received: Math.max(0, (matchingItem.qty_received || 0) - qtyToReject)
             });
           }
         }
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['receiving-items', batchId] });
       setRejectDialogOpen(false);
       setSelectedRejectItem(null);
       setPartialQty(0);
       toast.success('Quantidade atualizada');
     },
     onError: (error) => {
       toast.error('Erro ao processar item: ' + error.message);
     }
   });

  const confirmBatchMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      
      // Verificar se todos os itens resultaram em 0 recebido
      const totalReceived = items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;
      
      if (totalReceived === 0) {
        // Criar não-conformidade para recebimento zerado
        const reportNumber = `NCR-${Date.now()}-ZERO`;
        await base44.entities.NonConformityReport.create({
          company_id: user.company_id,
          report_number: reportNumber,
          receiving_batch_id: batchId,
          description: `Lote ${batch.batch_number} - Todos os itens foram rejeitados na conferência. Nenhum item recebido.`,
          order_id: batch?.order_id,
          order_number: batch?.order_number,
          status: 'ABERTO',
          action_type: 'DEVOLUCAO'
        });
        
        // Atualizar lote para CANCELADO ao invés de CONFERIDO
        await base44.entities.ReceivingBatch.update(batchId, {
          status: 'CANCELADO',
          confirmed_date: new Date().toISOString()
        });
        
        return { zeroItems: true };
      }
      
      // Fluxo normal: atualiza o status do lote para CONFERIDO
      await base44.entities.ReceivingBatch.update(batchId, {
        status: 'CONFERIDO',
        confirmed_date: new Date().toISOString()
      });
      
      return { zeroItems: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['receiving-batch', batchId] });
      
      if (result.zeroItems) {
        toast.error('Nenhum item recebido - Não-conformidade gerada e lote cancelado');
      } else {
        toast.success('Conferência concluída!');
        setLabelsDialogOpen(true);
      }
    },
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  if (loadingBatch) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Lote de recebimento não encontrado</p>
        <Link to={createPageUrl('ReceivingList')}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const allItemsConfirmed = items?.every(item => item.status === 'CONFERIDO');
  const confirmedCount = items?.filter(item => item.status === 'CONFERIDO').length || 0;

  const STATUS_CONFIG = {
    PENDENTE_CONFERENCIA: { color: 'bg-amber-100 text-amber-700', label: 'Pendente Conferência' },
    CONFERIDO: { color: 'bg-blue-100 text-blue-700', label: 'Conferido' },
    ARMAZENADO: { color: 'bg-emerald-100 text-emerald-700', label: 'Armazenado' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('ReceivingList')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Conferência - {batch.batch_number}
            </h1>
            <Badge className={STATUS_CONFIG[batch.status]?.color}>
              {STATUS_CONFIG[batch.status]?.label}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {batch.status === 'CONFERIDO' && (
            <>
              {items?.some(item => item.qty > 0) && (
                <Link to={createPageUrl('StorageAllocation')}>
                  <Button className="bg-indigo-600 hover:bg-indigo-700">
                    <Package className="h-4 w-4 mr-2" />
                    Ir para Alocação
                  </Button>
                </Link>
              )}
              <Button onClick={() => setLabelsDialogOpen(true)} variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Etiquetas Individuais
              </Button>
            </>
          )}
          {batch.status === 'CANCELADO' && (
            <Badge className="bg-red-100 text-red-700 px-4 py-2">
              Lote Cancelado - Nenhum item recebido
            </Badge>
          )}
          {batch.status === 'PENDENTE_CONFERENCIA' && (
            <>
              <Button onClick={() => setQrListDialogOpen(true)} variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Lista com QR Codes
              </Button>
              {allItemsConfirmed && (
                <Button onClick={() => confirmBatchMutation.mutate()} className="bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Conferência
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informações do Recebimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Número do Lote</p>
                <p className="font-medium">{batch.batch_number}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Data de Recebimento</p>
                <p className="font-medium">
                  {batch.received_date ? format(new Date(batch.received_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                </p>
              </div>
              {batch.nf_number && (
                <div>
                  <p className="text-sm text-slate-500">Nota Fiscal</p>
                  <p className="font-medium">{batch.nf_number}</p>
                </div>
              )}
              {batch.supplier && (
                <div>
                  <p className="text-sm text-slate-500">Fornecedor</p>
                  <p className="font-medium">{batch.supplier}</p>
                </div>
              )}
              {batch.reason && (
                <div className="col-span-2">
                  <p className="text-sm text-slate-500">Observações</p>
                  <p className="font-medium">{batch.reason}</p>
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
                <span className="text-slate-500">Total de Itens</span>
                <span className="font-medium">{items?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Conferidos</span>
                <span className="font-medium text-emerald-600">{confirmedCount}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-medium">Valor Total</span>
                <span className="font-bold text-indigo-600">{formatCurrency(batch.total_value)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow or Table */}
      {workflowMode && batch.status === 'PENDENTE_CONFERENCIA' ? (
        <ConferenceWorkflow 
          items={items} 
          batchId={batchId}
          onComplete={() => {
            setWorkflowMode(false);
            confirmBatchMutation.mutate();
          }}
        />
      ) : (
        <>
          <div className="flex justify-end mb-4">
            {batch.status === 'PENDENTE_CONFERENCIA' && items?.length > 0 && (
              <Button 
                onClick={() => setWorkflowMode(true)}
                className="bg-indigo-600 hover:bg-indigo-700 gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Iniciar Workflow de Conferência
              </Button>
            )}
          </div>

      <Card>
        <CardHeader>
          <CardTitle>Itens para Conferência</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingItems ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items?.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum item no recebimento</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Custo Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Status</TableHead>
                  {batch.status === 'PENDENTE_CONFERENCIA' && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-indigo-600">{item.product_sku}</TableCell>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell className="text-right font-medium">{item.qty}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.qty * item.unit_cost)}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {item.warehouse_name}
                      {item.location_barcode && ` / ${item.location_barcode}`}
                    </TableCell>
                    <TableCell>
                      {item.status === 'CONFERIDO' || item.status === 'ARMAZENADO' ? (
                        <Badge className="bg-emerald-100 text-emerald-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Conferido
                        </Badge>
                      ) : (
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => {
                           // Buscar quantidade esperada da solicitação se houver
                           let expectedQty = item.qty;
                           if (materialRequestItems) {
                             const requestItem = materialRequestItems.find(ri => ri.product_id === item.product_id);
                             if (requestItem) {
                               expectedQty = requestItem.qty_requested;
                             }
                           }
                           setSelectedItemForConfirm({ ...item, originalQty: expectedQty });
                           setConfirmedQty(parseFloat(item.qty) || 0);
                           setConfirmQtyDialogOpen(true);
                         }}
                         className="bg-amber-100 text-amber-700 hover:bg-amber-200 p-2 h-auto"
                       >
                         Pendente Conferência
                       </Button>
                      )}
                    </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {/* Labels Dialog */}
      <Dialog open={labelsDialogOpen} onOpenChange={setLabelsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerador de Etiquetas</DialogTitle>
          </DialogHeader>
          <LabelGenerator items={items} />
        </DialogContent>
      </Dialog>

      {/* Confirm Quantity Dialog */}
      {selectedItemForConfirm && (
       <Dialog open={confirmQtyDialogOpen} onOpenChange={setConfirmQtyDialogOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <CheckCircle className="h-5 w-5 text-blue-500" />
               Confirmar Quantidade Recebida
             </DialogTitle>
           </DialogHeader>
           {selectedItemForConfirm && (
             <div className="space-y-4">
               <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                 <p><strong>SKU:</strong> {selectedItemForConfirm.product_sku}</p>
                 <p><strong>Produto:</strong> {selectedItemForConfirm.product_name}</p>
                 <p><strong>Quantidade Esperada:</strong> {selectedItemForConfirm.qty}</p>
               </div>

               <div className="space-y-2">
                 <label className="block text-sm font-medium text-slate-700">
                   Quantidade Recebida Realmente
                 </label>
                 <Input
                   autoFocus
                   type="number"
                   min="0"
                   step="0.01"
                   value={confirmedQty}
                   onChange={(e) => setConfirmedQty(Math.max(0, parseFloat(e.target.value) || 0))}
                   className="w-full text-lg font-medium"
                   placeholder="Digite a quantidade"
                 />
                 {confirmedQty !== selectedItemForConfirm.qty && (
                   <div className={`p-3 rounded-lg ${confirmedQty > selectedItemForConfirm.qty ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
                     <p className={`text-sm font-medium ${confirmedQty > selectedItemForConfirm.qty ? 'text-amber-700' : 'text-red-700'}`}>
                       {confirmedQty > selectedItemForConfirm.qty 
                         ? `Excesso: +${(confirmedQty - selectedItemForConfirm.qty).toFixed(2)} unidades`
                         : `Falta: -${(selectedItemForConfirm.qty - confirmedQty).toFixed(2)} unidades`
                       }
                     </p>
                   </div>
                 )}
               </div>

               <div className="flex gap-2 justify-end">
                 <Button variant="outline" onClick={() => {
                   setConfirmQtyDialogOpen(false);
                   setConfirmedQty(0);
                 }}>
                   Cancelar
                 </Button>
                 <Button
                   onClick={() => confirmItemMutation.mutate({ 
                     itemId: selectedItemForConfirm.id, 
                     realQty: confirmedQty, 
                     originalQty: selectedItemForConfirm.originalQty 
                   })}
                   disabled={confirmItemMutation.isPending || confirmedQty < 0}
                   className="bg-emerald-600 hover:bg-emerald-700"
                 >
                   {confirmItemMutation.isPending ? 'Processando...' : 'Confirmar'}
                 </Button>
               </div>
             </div>
             )}
             </DialogContent>
             </Dialog>
             )}

             {/* QR List Dialog */}
      <Dialog open={qrListDialogOpen} onOpenChange={setQrListDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lista de Conferência com QR Codes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button 
              onClick={() => window.print()} 
              className="w-full print:hidden"
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Lista
            </Button>
            
            <div className="space-y-3">
              <div className="bg-slate-50 p-4 rounded-lg print:bg-white">
                <h2 className="font-bold text-lg mb-2">Lote: {batch.batch_number}</h2>
                <p className="text-sm text-slate-600">Data: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                {batch.nf_number && <p className="text-sm text-slate-600">NF: {batch.nf_number}</p>}
                {batch.supplier && <p className="text-sm text-slate-600">Fornecedor: {batch.supplier}</p>}
              </div>
              
              <div className="space-y-3">
                {items?.map((item, index) => (
                  <div key={item.id} className="border-2 border-slate-200 rounded-lg p-4 print:border-black print:break-inside-avoid">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <QRCodeSVG 
                          value={item.product_sku} 
                          size={80} 
                          level="M"
                          className="border border-slate-200"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-slate-500">SKU</p>
                            <p className="font-mono font-bold">{item.product_sku}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Quantidade</p>
                            <p className="font-bold text-lg">{item.qty}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs text-slate-500">Produto</p>
                            <p className="font-medium">{item.product_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Destino</p>
                            <p className="text-sm">{item.warehouse_name}</p>
                          </div>
                          {item.location_barcode && (
                            <div>
                              <p className="text-xs text-slate-500">Localização</p>
                              <p className="text-sm">{item.location_barcode}</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-4 print:hidden">
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="w-4 h-4" />
                            <span>Conferido</span>
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 border-t pt-2 print:block hidden">
                      <p className="text-xs text-slate-500">Assinatura: _______________________</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}