import React, { useState, useEffect } from 'react';
import { processProductionOrderControls } from '@/utils/productionControlUtils';
import { executeInventoryTransaction } from '@/utils/inventoryTransactionUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, AlertCircle, CheckCircle, Loader2, Package, FileText, Printer, QrCode } from 'lucide-react';
import { DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import SignatureCanvas from '@/components/inventory/SignatureCanvas';
import { downloadBaixaPDF, printBaixaPDF } from '@/components/inventory/BaixaPDF';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';
import OPSearchSelect from '@/components/production/OPSearchSelect';
import QRScanner from '@/components/scanner/QRScanner';

export default function CreateInventoryMove() {
  const { companyId } = useCompanyId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [form, setForm] = useState({
    type: 'ENTRADA',
    product_id: '',
    qty: 0,
    from_warehouse_id: '',
    from_location_id: '',
    to_warehouse_id: '',
    to_location_id: '',
    related_type: '',
    related_id: '',
    reason: '',
    unit_cost: 0,
    baixa_motivo: '',
    baixa_detalhamento: '',
    cost_center_id: '',
    manager_signature: ''
  });

  const [availableStock, setAvailableStock] = useState(null);
  const [stockError, setStockError] = useState(null);
  const [showBaixaDialog, setShowBaixaDialog] = useState(false);
  const [createdMove, setCreatedMove] = useState(null);
  const [scanProductOpen, setScanProductOpen] = useState(false);
  const [scanFromLocationOpen, setScanFromLocationOpen] = useState(false);
  const [scanToLocationOpen, setScanToLocationOpen] = useState(false);
  const [scanOPOpen, setScanOPOpen] = useState(false);

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => companyId ? base44.entities.Warehouse.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => companyId ? base44.entities.Location.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: salesOrders } = useQuery({
    queryKey: ['sales-orders', companyId],
    queryFn: () => companyId ? base44.entities.SalesOrder.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId && form.related_type === 'PEDIDO',
  });

  const { data: productionOrders } = useQuery({
    queryKey: ['production-orders', companyId],
    queryFn: () => companyId ? base44.entities.ProductionOrder.filter({ company_id: companyId }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId && form.related_type === 'OP',
  });

  const { data: costCenters } = useQuery({
    queryKey: ['cost-centers', companyId],
    queryFn: () => companyId ? base44.entities.CostCenter.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: opComponents, isLoading: loadingComponents } = useQuery({
    queryKey: ['op-components', companyId, form.related_id],
    queryFn: () => (companyId && form.related_id) ? base44.entities.BOMDeliveryControl.filter({ 
      op_id: form.related_id,
      status: 'ABERTO' 
    }) : Promise.resolve([]),
    enabled: !!companyId && !!form.related_id && form.related_type === 'OP',
  });

  // Validar saldo disponível em tempo real
  useEffect(() => {
    const validateStock = async () => {
      console.log('=== VALIDAÁ‡ÁƒO DE ESTOQUE ===');
      console.log('companyId:', companyId);
      console.log('product_id:', form.product_id);
      console.log('from_warehouse_id:', form.from_warehouse_id);
      console.log('from_location_id:', form.from_location_id);
      console.log('qty:', form.qty);
      console.log('type:', form.type);
      
      if (!companyId || !form.product_id || !form.from_warehouse_id || form.qty <= 0) {
        console.log('Validação ignorada - dados incompletos');
        setAvailableStock(null);
        setStockError(null);
        return;
      }

      if (form.type === 'SAIDA' || form.type === 'TRANSFERENCIA' || form.type === 'BAIXA') {
        try {
          const filterQuery = {
            company_id: companyId,
            product_id: form.product_id,
            warehouse_id: form.from_warehouse_id
          };
          
          // Se tiver location_id específico, filtrar por ele
          if (form.from_location_id) {
            filterQuery.location_id = form.from_location_id;
          }

          console.log('Buscando estoque com filtro:', JSON.stringify(filterQuery, null, 2));
          const balances = await base44.entities.StockBalance.filter(filterQuery);
          console.log('Saldos encontrados:', balances.length, 'registros');
          console.log('Detalhes dos saldos:', JSON.stringify(balances, null, 2));

          const totalAvailable = balances.reduce((sum, b) => sum + (b.qty_available || 0), 0);
          console.log('Total disponível calculado:', totalAvailable);
          setAvailableStock(totalAvailable);

          if (totalAvailable < form.qty) {
            setStockError(`Estoque insuficiente! Disponível: ${totalAvailable}`);
          } else {
            setStockError(null);
          }
        } catch (err) {
          console.error('ERRO ao buscar estoque:', err);
          console.error('Detalhes do erro:', JSON.stringify(err, null, 2));
        }
      }
    };

    validateStock();
  }, [form.product_id, form.from_warehouse_id, form.from_location_id, form.qty, form.type, companyId]);

  const createMoveMutation = useMutation({
     mutationFn: async (formData) => {
       // Sanitizar os dados: converter strings vazias em null para colunas UUID
       const data = Object.keys(formData).reduce((acc, key) => {
         acc[key] = formData[key] === '' ? null : formData[key];
         return acc;
       }, {});

        // Executar transação centralizada (Garante saldo não negativo e consistência)
        const move = await executeInventoryTransaction({
          type: data.type,
          product_id: data.product_id,
          qty: data.qty,
          from_warehouse_id: data.from_warehouse_id,
          from_location_id: data.from_location_id,
          to_warehouse_id: data.to_warehouse_id,
          to_location_id: data.to_location_id,
          unit_cost: data.unit_cost,
          related_type: data.related_type,
          related_id: data.related_id,
          reason: data.reason,
          notes: data.notes
        }, companyId);

        // Centralizado: Atualizar Controles de OP (BOM e Consumo) - Se relacionado a OP
        if (data.related_type === 'OP' && data.related_id) {
          await processProductionOrderControls(data, companyId, move.id);
        }

      // Criar log de auditoria
      const product = products?.find(p => p.id === data.product_id);
      const user = await base44.auth.me();
      
      await base44.entities.AuditLog.create({
        action: 'MOVIMENTACAO_ESTOQUE',
        entity_type: 'InventoryMove',
        entity_id: move.id,
        new_data: JSON.stringify({
          type: data.type,
          product: product?.sku,
          qty: data.qty,
          from: data.from_warehouse_id,
          to: data.to_warehouse_id,
          related_type: data.related_type,
          related_id: data.related_id
        }),
        user_email: user.email
      });

      return move;
    },
    onSuccess: (move) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-moves', companyId] });
      queryClient.invalidateQueries({ queryKey: ['stock-balances', companyId] });
      queryClient.invalidateQueries({ queryKey: ['delivery-controls', companyId] });
      
      if (form.type === 'BAIXA') {
        setCreatedMove(move);
        setShowBaixaDialog(true);
      } else {
        toast.success('Movimentação criada com sucesso');
        navigate(createPageUrl('InventoryMoves'));
      }
    },
    onError: (error) => {
      toast.error('Erro ao criar Movimentação: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    // Evitar múltiplos submits
    if (createMoveMutation.isPending) {
      return;
    }

    if (!form.product_id || form.qty <= 0) {
      toast.error('Produto e quantidade são obrigatórios');
      return;
    }

    if (form.type === 'ENTRADA' && !form.to_warehouse_id) {
      toast.error('Armazém de destino é obrigatório para entrada');
      return;
    }

    if (form.type === 'SAIDA' && !form.from_warehouse_id) {
      toast.error('Armazém de origem é obrigatório para saída');
      return;
    }

    if (form.type === 'BAIXA' && !form.from_warehouse_id) {
      toast.error('Armazém de origem é obrigatório para baixa');
      return;
    }

    if (form.type === 'BAIXA' && !form.baixa_motivo) {
      toast.error('Motivo da baixa é obrigatório');
      return;
    }

    if (form.type === 'BAIXA' && !form.cost_center_id) {
      toast.error('Centro de custos é obrigatório para baixa');
      return;
    }

    if (form.type === 'TRANSFERENCIA' && (!form.from_warehouse_id || !form.to_warehouse_id)) {
      toast.error('Armazéns de origem e destino são obrigatórios para transferência');
      return;
    }

    if (form.type === 'TRANSFERENCIA' && !form.from_location_id) {
      toast.error('Localização de origem é obrigatória para transferência');
      return;
    }

    if (form.type === 'TRANSFERENCIA' && !form.to_location_id) {
      toast.error('Localização de destino é obrigatória para transferência');
      return;
    }

    if (stockError) {
      toast.error('Estoque insuficiente para esta operação');
      return;
    }

    // Validação final: garantir que não resultará em saldo negativo
    if ((form.type === 'SAIDA' || form.type === 'TRANSFERENCIA' || form.type === 'BAIXA') && availableStock !== null) {
      if (availableStock - form.qty < 0) {
        toast.error('Operação não permitida: resultaria em saldo negativo');
        return;
      }
    }

    createMoveMutation.mutate(form);
  };

  const handleGeneratePDF = (download = false) => {
    if (!createdMove) return;

    const product = products?.find(p => p.id === form.product_id);
    const warehouse = warehouses?.find(w => w.id === form.from_warehouse_id);
    const costCenter = costCenters?.find(cc => cc.id === form.cost_center_id);

    const moveWithDetails = {
      ...createdMove,
      ...form
    };

    if (download) {
      downloadBaixaPDF(moveWithDetails, product, warehouse, costCenter, form.manager_signature);
      toast.success('PDF gerado com sucesso');
    } else {
      printBaixaPDF(moveWithDetails, product, warehouse, costCenter, form.manager_signature);
    }
  };

  const handleCloseBaixaDialog = () => {
    setShowBaixaDialog(false);
    toast.success('Baixa registrada com sucesso');
    navigate(createPageUrl('InventoryMoves'));
  };

  const fromLocations = locations?.filter(l => l.warehouse_id === form.from_warehouse_id);
  const toLocations = locations?.filter(l => l.warehouse_id === form.to_warehouse_id);

  const MOVE_TYPES = {
    ENTRADA: 'Entrada',
    SAIDA: 'Saída',
    TRANSFERENCIA: 'Transferência',
    BAIXA: 'Baixa de Estoque'
  };

  const BAIXA_MOTIVOS = [
    'Produto Danificado',
    'Produto Vencido',
    'Perda',
    'Quebra',
    'Uso Interno',
    'Doação',
    'Descarte',
    'Amostra Grátis',
    'Outro'
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('InventoryMoves')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Movimentação de Estoque</h1>
          <p className="text-slate-500">Registre entradas, saídas e transferências</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Dados da Movimentação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo de Movimentação *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MOVE_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Produto */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <ProductSearchSelect
                    label="Produto *"
                    value={form.product_id}
                    onSelect={(v) => setForm({ ...form, product_id: v })}
                    placeholder="Buscar por código ou descrição..."
                    required
                  />
                </div>
                <div className="pt-7">
                  <Dialog open={scanProductOpen} onOpenChange={setScanProductOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="icon">
                        <QrCode className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Escanear Produto</DialogTitle>
                      </DialogHeader>
                      <QRScanner
                        active={scanProductOpen}
                        onScan={(code) => {
                          const product = products?.find(p => p.sku === code);
                          if (product) {
                            setForm({ ...form, product_id: product.id });
                            toast.success(`Produto ${product.sku} selecionado`);
                            setScanProductOpen(false);
                          } else {
                            toast.error('Produto não encontrado');
                          }
                        }}
                        placeholder="Escaneie o código do produto"
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Alerta de Item Extra */}
              {form.related_type === 'OP' && form.product_id && opComponents && !opComponents.some(c => c.consumed_product_id === form.product_id) && (
                <Alert className="bg-amber-50 border-amber-200 text-amber-800 py-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <AlertDescription className="text-xs">
                    <strong>Item Extra:</strong> Este produto não consta na BOM original desta OP. Ele será registrado como um consumo adicional (Extra).
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Quantidade */}
            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: parseFloat(e.target.value) || 0 })}
              />
              {availableStock !== null && (form.type === 'SAIDA' || form.type === 'TRANSFERENCIA' || form.type === 'BAIXA') && (
                <p className={`text-sm ${stockError ? 'text-red-600' : 'text-emerald-600'}`}>
                  Disponível: {availableStock}
                </p>
              )}
            </div>

            {/* Campos específicos para BAIXA */}
            {form.type === 'BAIXA' && (
              <>
                <div className="space-y-2">
                  <Label>Motivo da Baixa *</Label>
                  <Select value={form.baixa_motivo} onValueChange={(v) => setForm({ ...form, baixa_motivo: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o motivo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {BAIXA_MOTIVOS.map(motivo => (
                        <SelectItem key={motivo} value={motivo}>{motivo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Detalhamento do Motivo *</Label>
                  <Textarea
                    value={form.baixa_detalhamento}
                    onChange={(e) => setForm({ ...form, baixa_detalhamento: e.target.value })}
                    rows={4}
                    placeholder="Descreva detalhadamente o motivo desta baixa..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Centro de Custos *</Label>
                  <Select value={form.cost_center_id} onValueChange={(v) => {
                    const cc = costCenters?.find(c => c.id === v);
                    setForm({ ...form, cost_center_id: v, cost_center_name: cc?.name });
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {costCenters?.map(cc => (
                        <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <SignatureCanvas 
                  onSave={(sig) => setForm({ ...form, manager_signature: sig })}
                  initialSignature={form.manager_signature}
                />
              </>
            )}

            {/* Origem (SAIDA, BAIXA e TRANSFERENCIA) */}
            {(form.type === 'SAIDA' || form.type === 'TRANSFERENCIA' || form.type === 'BAIXA') && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Armazém de Origem *</Label>
                    <Select value={form.from_warehouse_id} onValueChange={(v) => setForm({ ...form, from_warehouse_id: v, from_location_id: '' })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses?.map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.code} - {w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Localização de Origem</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Select value={form.from_location_id} onValueChange={(v) => setForm({ ...form, from_location_id: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a localização" />
                          </SelectTrigger>
                          <SelectContent>
                            {fromLocations?.map(l => (
                              <SelectItem key={l.id} value={l.id}>{l.barcode}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Dialog open={scanFromLocationOpen} onOpenChange={setScanFromLocationOpen}>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline" size="icon">
                            <QrCode className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Escanear Localização de Origem</DialogTitle>
                          </DialogHeader>
                          <QRScanner
                            active={scanFromLocationOpen}
                            onScan={(code) => {
                              const location = locations?.find(l => l.barcode === code || l.barcode === code.trim());
                              if (location) {
                                setForm({ ...form, from_location_id: location.id, from_warehouse_id: location.warehouse_id });
                                toast.success(`Localização ${location.barcode} selecionada`);
                                setScanFromLocationOpen(false);
                              } else {
                                toast.error('Localização não encontrada');
                              }
                            }}
                            placeholder="Escaneie o QR da localização de origem"
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Destino (ENTRADA e TRANSFERENCIA) */}
            {(form.type === 'ENTRADA' || form.type === 'TRANSFERENCIA') && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Armazém de Destino *</Label>
                    <Select value={form.to_warehouse_id} onValueChange={(v) => setForm({ ...form, to_warehouse_id: v, to_location_id: '' })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses?.map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.code} - {w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Localização de Destino</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Select value={form.to_location_id} onValueChange={(v) => setForm({ ...form, to_location_id: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a localização" />
                          </SelectTrigger>
                          <SelectContent>
                            {toLocations?.map(l => (
                              <SelectItem key={l.id} value={l.id}>{l.barcode}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Dialog open={scanToLocationOpen} onOpenChange={setScanToLocationOpen}>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline" size="icon">
                            <QrCode className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Escanear Localização de Destino</DialogTitle>
                          </DialogHeader>
                          <QRScanner
                            active={scanToLocationOpen}
                            onScan={(code) => {
                              const location = locations?.find(l => l.barcode === code || l.barcode === code.trim());
                              if (location) {
                                setForm({ ...form, to_location_id: location.id, to_warehouse_id: location.warehouse_id });
                                toast.success(`Localização ${location.barcode} selecionada`);
                                setScanToLocationOpen(false);
                              } else {
                                toast.error('Localização não encontrada');
                              }
                            }}
                            placeholder="Escaneie o QR da localização de destino"
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Custo Unitário (apenas ENTRADA) */}
            {form.type === 'ENTRADA' && (
              <div className="space-y-2">
                <Label>Custo Unitário (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.unit_cost}
                  onChange={(e) => setForm({ ...form, unit_cost: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}

            {/* Documento Relacionado */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select value={form.related_type} onValueChange={(v) => setForm({ ...form, related_type: v, related_id: '' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Nenhum</SelectItem>
                    <SelectItem value="PEDIDO">Pedido de Venda</SelectItem>
                    <SelectItem value="OP">Ordem de Produção</SelectItem>
                    <SelectItem value="COMPRA">Compra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.related_type === 'PEDIDO' && (
                <div className="space-y-2">
                  <Label>Pedido</Label>
                  <Select value={form.related_id} onValueChange={(v) => setForm({ ...form, related_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {salesOrders?.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.order_number} - {o.client_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.related_type === 'OP' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <OPSearchSelect
                      label="OP"
                      value={form.related_id}
                      onSelect={(v) => setForm({ ...form, related_id: v })}
                      placeholder="Buscar OP..."
                      companyId={companyId}
                    />
                  </div>
                  <div className="pt-7">
                    <Dialog open={scanOPOpen} onOpenChange={setScanOPOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="icon">
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Escanear OP</DialogTitle>
                        </DialogHeader>
                        <QRScanner
                          active={scanOPOpen}
                          onScan={(code) => {
                            const op = productionOrders?.find(o => o.numero_op_externo === code || o.op_number === code);
                            if (op) {
                              setForm({ ...form, related_id: op.id });
                              toast.success(`OP ${op.numero_op_externo} selecionada`);
                              setScanOPOpen(false);
                            } else {
                              toast.error('OP não encontrada');
                            }
                          }}
                          placeholder="Escaneie o QR da OP"
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
            </div>

            {/* Lista de Componentes da OP (Se houver) */}
            {form.related_type === 'OP' && form.related_id && (
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Package className="h-4 w-4 text-indigo-600" />
                      Componentes Planejados (BOM)
                    </h3>
                    <Badge variant="outline" className="bg-white">
                      {opComponents?.length || 0} pendentes
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 bg-indigo-50 p-1.5 rounded border border-indigo-100">
                    <strong>Dica:</strong> Se precisar entregar um item que não está nesta lista, basta buscá-lo normalmente no campo <strong>"Produto"</strong> no topo da página. Ele será registrado como um "item extra" para esta OP.
                  </p>
                </div>
                
                {loadingComponents ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Carregando componentes...
                  </div>
                ) : opComponents?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Nenhum componente pendente encontrado para esta OP.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {opComponents.map((comp) => (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => {
                          const remaining = (comp.qty_planned || 0) - (comp.qty_delivered || 0);
                          setForm({
                            ...form,
                            product_id: comp.consumed_product_id,
                            qty: remaining,
                            type: 'SAIDA', // Geralmente é saída/baixa para a produção
                            reason: `Baixa OP ${opComponents[0]?.op_number || ''}`
                          });
                          toast.info(`Selecionado: ${comp.consumed_product_name}`);
                        }}
                        className={`text-left p-3 rounded border transition-all text-xs bg-white hover:border-indigo-300 hover:shadow-sm group ${
                          form.product_id === comp.consumed_product_id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-mono font-bold text-indigo-600">{comp.consumed_product_sku}</span>
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                            Faltam: {(comp.qty_planned || 0) - (comp.qty_delivered || 0)} {comp.unit || 'UN'}
                          </span>
                        </div>
                        <p className="text-slate-700 line-clamp-1 group-hover:text-indigo-900">{comp.consumed_product_name}</p>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-400">Clique em um componente para preencher o formulário automaticamente.</p>
              </div>
            )}

            {/* Motivo */}
            <div className="space-y-2">
              <Label>Motivo / ObservaçÁµes</Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                rows={3}
                placeholder="Descreva o motivo desta Movimentação..."
              />
            </div>

            {/* Alertas */}
            {stockError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{stockError}</AlertDescription>
              </Alert>
            )}

            {/* BotÁµes */}
            <div className="flex justify-end gap-3 pt-4">
              <Link to={createPageUrl('InventoryMoves')}>
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
              <Button 
                type="submit" 
                disabled={createMoveMutation.isPending || !!stockError}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {createMoveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Criar Movimentação
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Dialog de Baixa - Gerar PDF */}
      <Dialog open={showBaixaDialog} onOpenChange={setShowBaixaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              Baixa Registrada com Sucesso
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              A baixa de estoque foi registrada. Deseja gerar o PDF da requisição de baixa?
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleCloseBaixaDialog}
                className="flex-1"
              >
                Não, Continuar
              </Button>
              <Button
                onClick={() => {
                  handleGeneratePDF(true);
                  handleCloseBaixaDialog();
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                <Printer className="h-4 w-4 mr-2" />
                Gerar PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
