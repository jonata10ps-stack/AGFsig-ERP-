/*
 * BACKUP CONTROL
 * Last backup: 2026-02-19 16:01 - Full functional version
 * Layout sections:
 * - Header: back btn, OP title, status badge, action buttons (Pausar, Separar BOM, QR, Registrar Produção, Encerrar, Cancelar)
 * - Two column layout: Info + Rastreamento (left), Progresso (right)
 * - Registrar Consumo section
 * - Etapas de Produção section - NOW WITH EDIT/DELETE CAPABILITIES
 */

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CheckCircle2, Factory, Plus, Loader2, AlertCircle, QrCode, Pause, Package, Check, Trash2, Edit, Save, X, Wand2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';

export default function ProductionOrderDetail() {
  const { companyId } = useCompanyId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const opId = urlParams.get('id');

  // Redirect to Dashboard if no ID provided (e.g. direct URL access)
  useEffect(() => {
    if (!opId) {
      navigate(createPageUrl('Dashboard'), { replace: true });
    }
  }, [opId, navigate]);

  const [consumptionProduct, setConsumptionProduct] = useState(null);
  const [consumptionQty, setConsumptionQty] = useState('');
  const [showAddStepDialog, setShowAddStepDialog] = useState(false);
  const [stepName, setStepName] = useState('');
  const [stepDescription, setStepDescription] = useState('');
  const [editingStepId, setEditingStepId] = useState(null);
  const [editStepStatus, setEditStepStatus] = useState('');
  const [editStepStartDate, setEditStepStartDate] = useState('');
  const [editStepEndDate, setEditStepEndDate] = useState('');
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [closeWarnings, setCloseWarnings] = useState([]);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [editingOpNumber, setEditingOpNumber] = useState(false);
  const [editOpNumberValue, setEditOpNumberValue] = useState('');
  const initializingRef = useRef(false);
  const initializingTimeoutRef = useRef(null);

  const { data: op, isLoading: loadingOP } = useQuery({
    queryKey: ['production-order', opId, companyId],
    queryFn: () => base44.entities.ProductionOrder.filter({ company_id: companyId, id: opId }),
    select: (data) => data?.[0],
    enabled: !!opId && !!companyId,
  });

  const { data: steps = [], refetch: refetchSteps, isLoading: stepsLoading } = useQuery({
    queryKey: ['production-steps', opId, companyId],
    queryFn: () => base44.entities.ProductionStep.filter({ company_id: companyId, op_id: opId }),
    enabled: !!opId && !!companyId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => base44.entities.Warehouse.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => base44.entities.Location.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  // Real-time subscription for step updates - disabled during initialization
  useEffect(() => {
    if (initializingRef.current) return; // Skip subscription during initialization
    
    const unsubscribe = base44.entities.ProductionStep.subscribe((event) => {
      if (event.data?.op_id === opId) {
        queryClient.invalidateQueries({ queryKey: ['production-steps', opId, companyId] });
      }
    });
    return unsubscribe;
  }, [opId, companyId, queryClient, initializingRef]);

  const initializeStepsFromBOM = useMutation({
    mutationFn: async () => {
      if (initializingRef.current) throw new Error('Geração já em andamento');
      initializingRef.current = true;

      // Clear any pending timeout
      if (initializingTimeoutRef.current) {
        clearTimeout(initializingTimeoutRef.current);
      }

      try {
        if (!op?.product_id || !companyId) throw new Error('OP ou produto não encontrado');

        // Double-check existing steps at mutation time
        const existingCheck = await base44.entities.ProductionStep.filter({ company_id: companyId, op_id: opId });
        if (existingCheck.length > 0) throw new Error('Esta OP já possui etapas cadastradas');

        const boms = await base44.entities.BOM.filter({
          company_id: companyId,
          product_id: op.product_id,
          active: true
        });

        if (!boms?.[0]) throw new Error('BOM não encontrado para este produto');

        const bomItems = await base44.entities.BOMItem.filter({
          company_id: companyId,
          bom_version_id: boms[0].current_version_id
        });

        if (!bomItems.length) throw new Error('BOM não possui componentes');

        const stepsToCreate = [];
        let globalSequence = 1;

        for (const bomItem of bomItems) {
          let routeId = null;
          if (bomItem.routes?.length > 0) {
            const sorted = [...bomItem.routes].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
            routeId = sorted[0].route_id;
          } else if (bomItem.route_id) {
            routeId = bomItem.route_id;
          }

          if (!routeId) {
            stepsToCreate.push({
              company_id: companyId,
              op_id: opId,
              sequence: globalSequence++,
              name: bomItem.component_name,
              description: bomItem.component_sku || '',
              component_sku: bomItem.component_sku,
              component_name: bomItem.component_name,
              status: 'PENDENTE'
            });
          } else {
            const routeSteps = await base44.entities.ProductionRouteStep.filter({
              company_id: companyId,
              route_id: routeId
            });

            for (const routeStep of routeSteps) {
              stepsToCreate.push({
                company_id: companyId,
                op_id: opId,
                sequence: globalSequence++,
                name: routeStep.name,
                description: `${bomItem.component_name} - ${routeStep.description || ''}`,
                component_sku: bomItem.component_sku,
                component_name: bomItem.component_name,
                resource_type: routeStep.resource_type,
                resource_id: routeStep.resource_id,
                status: 'PENDENTE',
                estimated_time: routeStep.estimated_time
              });
            }
          }
        }

        if (stepsToCreate.length > 0) {
          await base44.entities.ProductionStep.bulkCreate(stepsToCreate);
          // Wait a bit before clearing the flag to allow queries to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } finally {
        initializingRef.current = false;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-steps', opId, companyId] });
      toast.success('Etapas criadas a partir do BOM');
    },
    onError: (error) => {
      initializingRef.current = false;
      toast.error(error.message || 'Erro ao inicializar etapas');
    }
  });

  const registerConsumptionMutation = useMutation({
    mutationFn: async () => {
      if (!consumptionProduct || !consumptionQty) {
        throw new Error('Produto e quantidade são obrigatórios');
      }

      const qty = parseFloat(consumptionQty);
      if (isNaN(qty) || qty <= 0) {
        throw new Error('Quantidade deve ser um número positivo');
      }

      const user = await base44.auth.me();

      // Buscar saldo de estoque para baixar (qualquer localização com saldo)
      const allBalances = await base44.entities.StockBalance.filter({
        company_id: companyId,
        product_id: consumptionProduct.id,
      });
      const balanceWithStock = allBalances.find(b => (b.qty_available || 0) >= qty);
      if (!balanceWithStock) {
        const totalAvailable = allBalances.reduce((s, b) => s + (b.qty_available || 0), 0);
        throw new Error(`Saldo insuficiente para ${consumptionProduct.name}. Disponível: ${totalAvailable}`);
      }

      // 1. Criar movimento de inventário (SAÍDA no Kardex)
      await base44.entities.InventoryMove.create({
        company_id: companyId,
        type: 'PRODUCAO_CONSUMO',
        product_id: consumptionProduct.id,
        qty: qty,
        from_warehouse_id: balanceWithStock.warehouse_id,
        from_location_id: balanceWithStock.location_id,
        related_type: 'OP',
        related_id: opId,
        reason: `Consumo da OP-${op.op_number}`,
        unit_cost: consumptionProduct.cost_price || 0
      });

      // 2. Baixar saldo de estoque
      await base44.entities.StockBalance.update(balanceWithStock.id, {
        qty_available: (balanceWithStock.qty_available || 0) - qty,
      });

      // 3. Criar registro de consumo de material
      await base44.entities.MaterialConsumption.create({
        company_id: companyId,
        op_id: opId,
        product_id: consumptionProduct.id,
        product_sku: consumptionProduct.sku,
        product_name: consumptionProduct.name,
        qty_consumed: qty,
        warehouse_id: balanceWithStock.warehouse_id,
        location_id: balanceWithStock.location_id,
        registered_by: user.email,
        registered_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-order', opId, companyId] });
      setConsumptionProduct(null);
      setConsumptionQty('');
      toast.success('Consumo registrado com sucesso');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao registrar consumo');
    }
  });

  const pauseOpMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.ProductionOrder.update(opId, { status: 'PAUSADA' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-order', opId, companyId] });
      toast.success('OP pausada');
    }
  });

   const resumeOpMutation = useMutation({
     mutationFn: async () => {
       await base44.entities.ProductionOrder.update(opId, { status: 'EM_ANDAMENTO' });
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['production-order', opId, companyId] });
       toast.success('OP retomada');
     }
   });


  const closeOpMutation = useMutation({
    mutationFn: async () => {
      try {
        // Get warehouse - required
        let warehouseId = op.warehouse_id;
        if (!warehouseId) {
          const warehouses = await base44.entities.Warehouse.filter({
            company_id: companyId,
            active: true
          });
          const defaultWarehouse = warehouses.find(w => w.type === 'ACABADO') || warehouses[0];
          if (!defaultWarehouse) {
            throw new Error('Nenhum armazém ativo encontrado. Configure o armazém de destino na OP.');
          }
          warehouseId = defaultWarehouse.id;
        }

        // 1. Create inventory movement (PRODUCAO_ENTRADA) and update stock balance
        if (op.qty_produced > 0) {
          await base44.entities.InventoryMove.create({
            company_id: companyId,
            type: 'PRODUCAO_ENTRADA',
            product_id: op.product_id,
            qty: op.qty_produced,
            to_warehouse_id: warehouseId,
            to_location_id: op.location_id || undefined,
            related_type: 'OP',
            related_id: opId,
            reason: `Produção finalizada da OP-${op.op_number}`
          });

          // Update or create stock balance
          const stockBalances = await base44.entities.StockBalance.filter({
            company_id: companyId,
            product_id: op.product_id,
            warehouse_id: warehouseId,
            location_id: op.location_id || undefined
          });

          if (stockBalances && stockBalances.length > 0) {
            await base44.entities.StockBalance.update(stockBalances[0].id, {
              qty_available: (stockBalances[0].qty_available || 0) + op.qty_produced
            });
          } else {
            await base44.entities.StockBalance.create({
              company_id: companyId,
              product_id: op.product_id,
              warehouse_id: warehouseId,
              location_id: op.location_id || undefined,
              qty_available: op.qty_produced,
              qty_reserved: 0,
              qty_separated: 0
            });
          }
        }

        // 2. Update OP status to ENCERRADA and save warehouse/location if not already set
        const updateData = { 
          status: 'ENCERRADA',
          closed_at: new Date().toISOString()
        };

        if (!op.warehouse_id) {
          updateData.warehouse_id = warehouseId;
        }

        if (!op.location_id && op.location_id) {
          updateData.location_id = op.location_id;
        }

        await base44.entities.ProductionOrder.update(opId, updateData);

      } catch (error) {
        console.error('Erro ao encerrar OP:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-order', opId, companyId] });
      toast.success('OP encerrada com sucesso');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao encerrar OP');
    }
  });

  const cancelOpMutation = useMutation({
    mutationFn: async () => {
      // Simples: cancelar a OP
      await base44.entities.ProductionOrder.update(opId, { 
        status: 'CANCELADA',
        cancellation_reason: 'Cancelada pelo usuário'
      });
    },
    onSuccess: () => {
      setCancelLoading(false);
      queryClient.invalidateQueries({ queryKey: ['production-order', opId, companyId] });
      toast.success('OP cancelada');
    },
    onError: (error) => {
      setCancelLoading(false);
      toast.error(error.message || 'Erro ao cancelar OP');
    }
  });

  const addStepMutation = useMutation({
    mutationFn: async () => {
      if (!stepName) throw new Error('Nome da etapa é obrigatório');
      
      await base44.entities.ProductionStep.create({
        company_id: companyId,
        op_id: opId,
        sequence: steps.length + 1,
        name: stepName,
        description: stepDescription,
        status: 'PENDENTE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-steps', opId, companyId] });
      toast.success('Etapa adicionada com sucesso');
      setShowAddStepDialog(false);
      setStepName('');
      setStepDescription('');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao adicionar etapa');
    }
  });

  const updateStepMutation = useMutation({
    mutationFn: async (stepId) => {
      const updateData = {};
      if (editStepStatus) updateData.status = editStepStatus;
      if (editStepStartDate) updateData.scheduled_start_date = editStepStartDate;
      if (editStepEndDate) updateData.scheduled_end_date = editStepEndDate;
      
      await base44.entities.ProductionStep.update(stepId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-steps', opId, companyId] });
      toast.success('Etapa atualizada com sucesso');
      setEditingStepId(null);
      setEditStepStatus('');
      setEditStepStartDate('');
      setEditStepEndDate('');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao atualizar etapa');
    }
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (stepId) => {
      await base44.entities.ProductionStep.delete(stepId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-steps', opId, companyId] });
      toast.success('Etapa removida com sucesso');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao remover etapa');
    }
  });

  const handleSepararBOM = () => {
    navigate(createPageUrl('BOMDeliveryPickingList') + `?op_id=${opId}`);
  };

  const handleQRCode = () => {
    toast.info('Gerando QR Code para OP-' + op.op_number);
  };

  const handleCancelar = async () => {
    if (cancelLoading) return;
    setCancelLoading(true);
    
    try {
      // Check consumptions directly
      const [consumptions, bomDeliveries, materialConsumptions, allMoves] = await Promise.all([
        base44.entities.OPConsumptionControl.filter({ company_id: companyId, op_id: opId }),
        base44.entities.BOMDeliveryControl.filter({ op_id: opId }),
        base44.entities.MaterialConsumption.filter({ company_id: companyId, op_id: opId }),
        base44.entities.InventoryMove.filter({ company_id: companyId, related_type: 'OP', related_id: opId }),
      ]);

      if (consumptions?.length > 0) {
        toast.error(`Não é possível cancelar: ${consumptions.length} item(ns) no Controle de Consumo.`);
        setCancelLoading(false);
        return;
      }

      const deliveredBOM = bomDeliveries?.filter(bd => (Number(bd.qty) || 0) > 0) || [];
      if (deliveredBOM.length > 0) {
        toast.error(`Não é possível cancelar: ${deliveredBOM.length} item(ns) do BOM já entregues.`);
        setCancelLoading(false);
        return;
      }

      if (materialConsumptions?.length > 0) {
        toast.error(`Não é possível cancelar: ${materialConsumptions.length} material(is) consumido(s).`);
        setCancelLoading(false);
        return;
      }

      const opMoves = (allMoves || []).filter(m => ['SAIDA', 'PRODUCAO_CONSUMO', 'SEPARACAO'].includes(m.type));
      if (opMoves.length > 0) {
        toast.error(`Não é possível cancelar: ${opMoves.length} movimentação(ões) de consumo registrada(s).`);
        setCancelLoading(false);
        return;
      }

      setCancelLoading(false);
      cancelOpMutation.mutate();
    } catch (error) {
      toast.error('Erro ao validar cancelamento');
      setCancelLoading(false);
    }
  };

  const handleEncerrar = async () => {
    // Verificar se houve produção
    if (!op.qty_produced || op.qty_produced === 0) {
      toast.error('Não é possível encerrar uma OP sem produção registrada. Cancele a OP se não houve produção.');
      return;
    }

    // Verificar se há sub-OPs vinculadas não encerradas (BLOQUEANTE)
    try {
      const childOPs = await base44.entities.ProductionOrder.filter({
        company_id: companyId,
        parent_op_id: opId
      });
      const openChildOPs = (childOPs || []).filter(c => c.status !== 'ENCERRADA' && c.status !== 'CANCELADA');
      if (openChildOPs.length > 0) {
        const numbers = openChildOPs.map(c => c.numero_op_externo || c.op_number).join(', ');
        toast.error(`Não é possível encerrar: há ${openChildOPs.length} OP(s) vinculada(s) ainda não encerrada(s): ${numbers}`);
        return;
      }
    } catch (e) {
      console.error('Erro ao verificar sub-OPs:', e);
    }
    
    // Verificar se há etapas pendentes
    const warnings = [];
    
    // 1. Verificar etapas de cronograma pendentes
    const pendingSteps = steps.filter(s => s.status !== 'CONCLUIDA' && s.status !== 'PULADA');
    if (pendingSteps.length > 0) {
      warnings.push(`${pendingSteps.length} etapa(s) de produção ainda não concluída(s)`);
    }
    
    // 2. Verificar se está vinculada a OP pai não encerrada
    if (op.parent_op_id) {
      try {
        const parentOPs = await base44.entities.ProductionOrder.filter({
          company_id: companyId,
          id: op.parent_op_id
        });
        if (parentOPs?.[0] && parentOPs[0].status !== 'ENCERRADA') {
          warnings.push(`Vinculada à OP pai ${parentOPs[0].numero_op_externo} que ainda não foi encerrada`);
        }
      } catch (e) {
        console.error('Erro ao verificar OP pai:', e);
      }
    }
    
    // 3. Verificar se BOM foi totalmente entregue
    try {
      const boms = await base44.entities.BOM.filter({
        company_id: companyId,
        product_id: op.product_id,
        active: true
      });
      
      if (boms?.[0]) {
        const bomItems = await base44.entities.BOMItem.filter({
          company_id: companyId,
          bom_version_id: boms[0].current_version_id
        });
        
        if (bomItems.length > 0) {
          // Verificar controle de entrega de BOM
          const deliveryControls = await base44.entities.BOMDeliveryControl.filter({
            company_id: companyId,
            op_id: opId
          });
          
          // Calcular quantidade total necessária vs entregue
          for (const bomItem of bomItems) {
            const qtyNeeded = Number(bomItem.quantity || 0) * Number(op.qty_planned || 0);
            
            // Suportar IDs novos e antigos para cruzamento
            const delivered = deliveryControls
              .filter(dc => (dc.consumed_product_id === bomItem.component_id) || (dc.component_id === bomItem.component_id))
              .reduce((sum, dc) => sum + (Number(dc.qty) || 0), 0);
            
            if (delivered < qtyNeeded) {
              warnings.push(`Componente ${bomItem.component_sku || 'da BOM'} - entregues ${delivered} de ${qtyNeeded} un`);
            }
          }
        }
      }
    } catch (e) {
      console.error('Erro ao verificar BOM:', e);
    }
    
    // Se houver avisos, mostrar diálogo
    if (warnings.length > 0) {
      setCloseWarnings(warnings);
      setShowCloseWarning(true);
    } else {
      closeOpMutation.mutate();
    }
  };
  
  const handleForceClose = () => {
    setShowCloseWarning(false);
    setCloseWarnings([]);
    closeOpMutation.mutate();
  };
  
  const handleUnlinkAndClose = async () => {
    try {
      await base44.entities.ProductionOrder.update(opId, { parent_op_id: null });
      setShowCloseWarning(false);
      setCloseWarnings([]);
      closeOpMutation.mutate();
    } catch (e) {
      toast.error('Erro ao desvincular OP');
    }
  };

  const registerProductionMutation = useMutation({
    mutationFn: async () => {
      if (op.qty_produced >= op.qty_planned) {
        throw new Error('Quantidade produzida já atingiu o planejado');
      }
      const newQty = op.qty_produced + 1;
      await base44.entities.ProductionOrder.update(opId, { qty_produced: newQty });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-order', opId, companyId] });
      toast.success('Produção registrada com sucesso');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao registrar produção');
    }
  });

  const handleRegistrarProducao = () => {
    registerProductionMutation.mutate();
  };

  const saveOpNumberMutation = useMutation({
    mutationFn: async () => {
      if (!editOpNumberValue.trim()) throw new Error('Número da OP não pode ser vazio');
      await base44.entities.ProductionOrder.update(opId, { numero_op_externo: editOpNumberValue.trim().toUpperCase() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-order', opId, companyId] });
      setEditingOpNumber(false);
      toast.success('Número da OP atualizado');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao atualizar número da OP');
    }
  });

  if (loadingOP) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!op) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Ordem de Produção não encontrada</p>
      </div>
    );
  }

  const progress = op.qty_planned > 0 ? Math.round((op.qty_produced / op.qty_planned) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-4 mb-4">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              {editingOpNumber ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editOpNumberValue}
                    onChange={(e) => setEditOpNumberValue(e.target.value.toUpperCase())}
                    className="text-xl font-bold font-mono w-48"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveOpNumberMutation.mutate();
                      if (e.key === 'Escape') setEditingOpNumber(false);
                    }}
                  />
                  <Button size="sm" onClick={() => saveOpNumberMutation.mutate()} disabled={saveOpNumberMutation.isPending}>
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingOpNumber(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold text-slate-900">{op.numero_op_externo || `OP-${op.op_number}`}</h1>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-slate-400 hover:text-slate-700"
                    onClick={() => { setEditOpNumberValue(op.numero_op_externo || ''); setEditingOpNumber(true); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <Badge className="mt-2 bg-amber-100 text-amber-800">
              {op.status}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => op.status === 'PAUSADA' ? resumeOpMutation.mutate() : pauseOpMutation.mutate()}
            disabled={pauseOpMutation.isPending || resumeOpMutation.isPending}
            variant="outline" 
            size="sm"
          >
            <Pause className="h-4 w-4 mr-2" />
            {op.status === 'PAUSADA' ? 'Retomar' : 'Pausar'}
          </Button>
          <Button 
            onClick={handleSepararBOM}
            variant="outline" 
            size="sm"
          >
            <Package className="h-4 w-4 mr-2" />
            Separar BOM
          </Button>
          <Button 
            onClick={handleQRCode}
            variant="outline" 
            size="sm"
          >
            <QrCode className="h-4 w-4 mr-2" />
            QR Code
          </Button>
          <Button 
            onClick={handleRegistrarProducao}
            disabled={registerProductionMutation.isPending || op.qty_produced >= op.qty_planned}
            variant="outline" 
            size="sm"
          >
            <Check className="h-4 w-4 mr-2" />
            Registrar Produção
          </Button>
          <Button 
            onClick={handleEncerrar}
            disabled={closeOpMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
            size="sm"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {closeOpMutation.isPending ? 'Encerrando...' : 'Encerrar'}
          </Button>
          <Button 
            onClick={handleCancelar}
            disabled={cancelLoading || cancelOpMutation.isPending}
            variant="destructive" 
            size="sm"
          >
            {cancelLoading || cancelOpMutation.isPending ? 'Cancelando...' : 'Cancelar'}
          </Button>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* OP Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Produto</p>
                  <p className="font-semibold">{op.product_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Quantidade Planejada</p>
                  <p className="font-semibold">{op.qty_planned}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Data Início</p>
                  <p className="font-semibold">{op.start_date ? format(new Date(op.start_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Data Conclusão</p>
                  <p className="font-semibold">{op.due_date ? format(new Date(op.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Prioridade</p>
                  <Badge className="mt-1">{op.priority}</Badge>
                </div>
              </div>

              {/* Warehouse and Location */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Armazém de Destino</p>
                    <p className="font-semibold">{op.warehouse_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Localização</p>
                    <p className="font-semibold">{op.location_barcode || '-'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Registrar Consumo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Registrar Consumo de Materiais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Produto</Label>
                <ProductSearchSelect 
                  value={consumptionProduct?.id || ''}
                  onSelect={(id, product) => setConsumptionProduct(product || null)}
                  placeholder="Selecione um produto para consumo"
                />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input 
                  type="number" 
                  placeholder="0" 
                  value={consumptionQty}
                  onChange={(e) => setConsumptionQty(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => registerConsumptionMutation.mutate()}
                disabled={registerConsumptionMutation.isPending}
                className="w-full"
              >
                {registerConsumptionMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Registrar Consumo
              </Button>
            </CardContent>
          </Card>

          {/* Etapas */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Etapas de Produção</CardTitle>
                <Button 
                  onClick={() => setShowAddStepDialog(true)}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {stepsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : steps.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 mb-4">Nenhuma etapa adicionada</p>
                  <Button 
                    onClick={() => { if (!initializeStepsFromBOM.isPending) initializeStepsFromBOM.mutate(); }}
                    size="sm"
                    disabled={initializeStepsFromBOM.isPending}
                  >
                    {initializeStepsFromBOM.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                    Gerar do BOM
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {steps.map((step) => (
                    <div key={step.id} className="border rounded-lg p-4">
                      {editingStepId === step.id ? (
                        <div className="space-y-3">
                          <div>
                            <Label>Status</Label>
                            <Select value={editStepStatus} onValueChange={setEditStepStatus}>
                              <SelectTrigger>
                                <SelectValue placeholder={step.status} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PENDENTE">Pendente</SelectItem>
                                <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                                <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                                <SelectItem value="PULADA">Pulada</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Data Início</Label>
                            <Input 
                              type="date" 
                              value={editStepStartDate}
                              onChange={(e) => setEditStepStartDate(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Data Conclusão</Label>
                            <Input 
                              type="date" 
                              value={editStepEndDate}
                              onChange={(e) => setEditStepEndDate(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              onClick={() => updateStepMutation.mutate(step.id)}
                              disabled={updateStepMutation.isPending}
                              size="sm"
                              className="flex-1"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              Salvar
                            </Button>
                            <Button 
                              onClick={() => setEditingStepId(null)}
                              size="sm"
                              variant="outline"
                              className="flex-1"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold">{step.sequence}. {step.name}</p>
                            {step.component_sku && (
                              <p className="text-xs font-mono text-indigo-600 mt-0.5">{step.component_sku}</p>
                            )}
                            {step.description && <p className="text-sm text-slate-500">{step.description}</p>}
                            <Badge className="mt-2">{step.status}</Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              onClick={() => setEditingStepId(step.id)}
                              size="sm"
                              variant="outline"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              onClick={() => deleteStepMutation.mutate(step.id)}
                              disabled={deleteStepMutation.isPending}
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Progress Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Progresso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">{progress}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-sm text-slate-500">Produzido</p>
                  <p className="text-2xl font-bold text-green-600">{op.qty_produced}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Planejado</p>
                  <p className="text-2xl font-bold">{op.qty_planned}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rastreamento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rastreamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {op.created_by && (
                <div>
                  <p className="text-slate-500">Criada por</p>
                  <p className="font-semibold">{op.created_by}</p>
                </div>
              )}
              {op.start_date && (
                <div>
                  <p className="text-slate-500">Iniciada em</p>
                  <p className="font-semibold">{format(new Date(op.start_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                </div>
              )}
              {op.closed_at && (
                <div>
                  <p className="text-slate-500">Finalizada em</p>
                  <p className="font-semibold">{format(new Date(op.closed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Step Dialog */}
      <Dialog open={showAddStepDialog} onOpenChange={setShowAddStepDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Etapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Etapa</Label>
              <Input 
                value={stepName}
                onChange={(e) => setStepName(e.target.value)}
                placeholder="Ex: Corte, Montagem..."
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input 
                value={stepDescription}
                onChange={(e) => setStepDescription(e.target.value)}
                placeholder="Descrição (opcional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStepDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => addStepMutation.mutate()}
              disabled={addStepMutation.isPending}
            >
              {addStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Warning Dialog */}
      <Dialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Atenção: Pendências Identificadas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-600">
              Foram identificadas as seguintes pendências para esta OP:
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              {closeWarnings.map((warning, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-900">{warning}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-600">
              Deseja encerrar a OP mesmo assim?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseWarning(false)}>
              Cancelar
            </Button>
            {op?.parent_op_id && closeWarnings.some(w => w.includes('OP pai')) && (
              <Button 
                onClick={handleUnlinkAndClose}
                disabled={closeOpMutation.isPending}
                variant="outline"
              >
                Desvincular e Encerrar
              </Button>
            )}
            <Button 
              onClick={handleForceClose}
              disabled={closeOpMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {closeOpMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Encerrar Mesmo Assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}