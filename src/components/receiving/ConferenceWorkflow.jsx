import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function ConferenceWorkflow({ items, batchId, materialRequestItems, onComplete }) {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [conferredQty, setConferredQty] = useState('');
  const [conferenceData, setConferenceData] = useState({});

  // Filtrar apenas itens pendentes de conferência (não armazenados)
  const validItems = items?.filter(item => item.status !== 'ARMAZENADO') || [];
  const currentItem = validItems?.[currentIndex];
  const totalItems = validItems?.length || 0;
  const conferredCount = Object.keys(conferenceData).length;
  const isCompleted = conferenceData[currentItem?.id] !== undefined;

  const confirmItemMutation = useMutation({
    mutationFn: async (data) => {
      const { itemId, receivedQty } = data;
      const item = validItems.find(i => i.id === itemId);
      const user = await base44.auth.me();
      
      // Buscar quantidade esperada da solicitação original, se houver
      let expectedQty = item.qty; // Padrão: o que veio no recebimento
      if (materialRequestItems) {
        const requestItem = materialRequestItems.find(ri => ri.product_id === item.product_id);
        if (requestItem) {
          expectedQty = requestItem.qty_requested;
        }
      }

      const variance = receivedQty - expectedQty;

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
          quantity_received: receivedQty,
          variance: variance,
          variance_type: varianceType,
          status: 'ABERTO',
          action_type: 'NENHUMA'
        });
      }

      // Atualizar item com quantidade confirmada e status
      await base44.entities.ReceivingItem.update(itemId, { 
        status: 'CONFERIDO',
        qty: receivedQty
      });
    },
    onSuccess: (_, { itemId, receivedQty }) => {
      setConferenceData(prev => ({
        ...prev,
        [itemId]: receivedQty
      }));
      setConferredQty('');
      toast.success('Item conferido');
      
      // Move to next item
      if (currentIndex < totalItems - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        toast.success('Todos os itens foram conferidos!');
      }
    },
    onError: (error) => {
      toast.error('Erro ao conferir item: ' + error.message);
    }
  });

  const skipItemMutation = useMutation({
    mutationFn: async (itemId) => {
      // Mark as pending but move to next
      return Promise.resolve();
    },
    onSuccess: () => {
      setConferredQty('');
      if (currentIndex < totalItems - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  });

  const handleConfirm = () => {
    if (!conferredQty && conferredQty !== '0') {
      toast.error('Digite a quantidade conferida');
      return;
    }

    const qty = parseFloat(conferredQty);
    if (isNaN(qty) || qty < 0) {
      toast.error(`Quantidade inválida`);
      return;
    }

    confirmItemMutation.mutate({
      itemId: currentItem.id,
      receivedQty: qty
    });
  };

  const handleNext = () => {
    if (currentIndex < totalItems - 1) {
      setCurrentIndex(currentIndex + 1);
      setConferredQty('');
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setConferredQty('');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  if (!currentItem) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">Nenhum item para conferir</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-700">Progresso</span>
          <span className="text-sm text-slate-600">{conferredCount} de {totalItems}</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(conferredCount / totalItems) * 100}%` }}
          />
        </div>
      </div>

      {/* Current Item Card */}
      <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Item {currentIndex + 1} de {totalItems}</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Código: {currentItem.product_sku}</p>
            </div>
            {isCompleted && (
              <Badge className="bg-emerald-100 text-emerald-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Conferido
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Product Info */}
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500 mb-1">Produto</p>
            <p className="font-semibold text-lg">{currentItem.product_name}</p>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div>
                <p className="text-xs text-slate-500">Quantidade Esperada</p>
                <p className="text-2xl font-bold text-indigo-600">{currentItem.qty}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Valor Unitário</p>
                <p className="font-medium">{formatCurrency(currentItem.unit_cost)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Valor Total</p>
                <p className="font-medium">{formatCurrency(currentItem.qty * currentItem.unit_cost)}</p>
              </div>
            </div>
            {currentItem.warehouse_name && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-slate-500">Destino</p>
                <p className="font-medium">{currentItem.warehouse_name}</p>
              </div>
            )}
          </div>

          {/* Conference Input */}
          {!isCompleted ? (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900">Confira a quantidade recebida</p>
                  <p className="text-amber-700 mt-1">Digite a quantidade que foi realmente recebida do lote</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Quantidade Conferida
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={conferredQty}
                  onChange={(e) => setConferredQty(e.target.value.replace(',', '.'))}
                  placeholder="0"
                  className="text-lg h-10"
                  autoFocus
                />
                <p className="text-xs text-slate-500">
                  Máximo: {currentItem.qty} unidades
                </p>
              </div>

              {conferredQty && parseFloat(conferredQty) < currentItem.qty && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-sm text-orange-800">
                    <strong>Atenção:</strong> Faltarão {(currentItem.qty - parseFloat(conferredQty)).toFixed(2)} unidades
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="font-medium text-emerald-900">Item Conferido</p>
                  <p className="text-sm text-emerald-700">Quantidade: {conferenceData[currentItem.id]}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 justify-between">
        <div className="flex gap-2">
          <Button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            variant="outline"
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentIndex === totalItems - 1}
            variant="outline"
            className="gap-2"
          >
            Próximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {!isCompleted && (
          <div className="flex gap-2">
            <Button
              onClick={() => skipItemMutation.mutate(currentItem.id)}
              variant="outline"
            >
              Pular
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmItemMutation.isPending || !conferredQty && conferredQty !== '0'}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {confirmItemMutation.isPending ? 'Conferindo...' : 'Conferir'}
            </Button>
          </div>
        )}

        {isCompleted && currentIndex === totalItems - 1 && conferredCount === totalItems && (
          <Button
            onClick={() => onComplete?.()}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Finalizar Conferência
          </Button>
        )}
      </div>

      {/* Summary of Conferenced Items */}
      {Object.keys(conferenceData).length > 0 && (
        <Card className="bg-slate-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Itens Conferidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {validItems
                .filter(item => conferenceData[item.id] !== undefined)
                .map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm p-2 bg-white rounded">
                    <span className="font-medium">{item.product_sku} - {item.product_name}</span>
                    <Badge className="bg-emerald-100 text-emerald-700">
                      {conferenceData[item.id]}/{item.qty}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}