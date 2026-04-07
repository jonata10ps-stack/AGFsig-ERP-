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
import ClientSearchSelect from '@/components/clients/ClientSearchSelect';
import { executeInventoryTransaction } from '@/utils/inventoryTransactionUtils';
import { processProductionOrderControls } from '@/utils/productionControlUtils';

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
  const [consumptionWarehouseId, setConsumptionWarehouseId] = useState('');
  const [consumptionLocationId, setConsumptionLocationId] = useState('');
  const [showAddStepDialog, setShowAddStepDialog] = useState(false);
  const [stepName, setStepName] = useState('');
  const [stepDescription, setStepDescription] = useState('');
  const [stepResourceId, setStepResourceId] = useState('');
  const [editingStepId, setEditingStepId] = useState(null);
  const [editStepStatus, setEditStepStatus] = useState('');
  const [editStepStartDate, setEditStepStartDate] = useState('');
  const [editStepEndDate, setEditStepEndDate] = useState('');
  const [editStepResourceId, setEditStepResourceId] = useState('');
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [closeWarnings, setCloseWarnings] = useState([]);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [editingOpNumber, setEditingOpNumber] = useState(false);
  const [editOpNumberValue, setEditOpNumberValue] = useState('');
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [tempClientId, setTempClientId] = useState('');
  const [tempClientName, setTempClientName] = useState('');
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

  const { data: resources = [] } = useQuery({
    queryKey: ['resources-detail', companyId],
    queryFn: () => base44.entities.Resource.filter({ company_id: companyId }, 'name', 1000),
    enabled: !!companyId,
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

  const { data: bomDeliveries = [] } = useQuery({
    queryKey: ['bom-deliveries-op', opId, companyId],
    queryFn: () => base44.entities.BOMDeliveryControl.filter({ op_id: opId }),
    enabled: !!opId && !!companyId,
  });

  const { data: materialConsumptions = [] } = useQuery({
    queryKey: ['material-consumptions-op', opId, companyId],
    queryFn: () => base44.entities.MaterialConsumption.filter({ company_id: companyId, op_id: opId }),
    enabled: !!opId && !!companyId,
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

        console.log('🏭 Iniciando geração de etapas para OP:', opId);
        
        // 1. Buscar a BOM e sua versão ativa
        const boms = await base44.entities.BOM.filter({ company_id: companyId, product_id: op.product_id });
        const bom = boms?.find(b => b.is_active) || boms?.[0];
        
        if (!bom) throw new Error('BOM ativa não encontrada para este produto.');

        const versions = await base44.entities.BOMVersion.filter({ bom_id: bom.id }, '-version_number');
        const activeVersion = versions.find(v => v.id === bom.current_version_id) || 
                             versions.find(v => v.is_active === true || v.is_active === 'true' || v.is_active === 'TRUE') || 
                             versions[0];
        
        if (!activeVersion) throw new Error('Nenhuma versão encontrada para este BOM.');

        // 2. Buscar ITENS (componentes) do BOM
        const bomItems = await base44.entities.BOMItem.filter({ bom_version_id: activeVersion.id });
        console.log(`📎 Encontrados ${bomItems.length} itens na BOM para versão ${activeVersion.version_number}`);

        const stepsToCreate = [];
        let globalSequence = 1;

        // --- ETAPA A: Roteiros dos Componentes ---
        for (const bomItem of (bomItems || []).sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0))) {
          let itemRoutes = [];
          try {
            const routesData = bomItem.routes;
            if (typeof routesData === 'string' && (routesData.startsWith('[') || routesData.startsWith('{'))) {
              itemRoutes = JSON.parse(routesData);
            } else if (Array.isArray(routesData)) {
              itemRoutes = routesData;
            } else if (bomItem.route_id) {
              itemRoutes = [{ route_id: bomItem.route_id, route_name: bomItem.route_name, sequence: 1 }];
            }
            if (!Array.isArray(itemRoutes)) {
              itemRoutes = itemRoutes ? [itemRoutes] : [];
            }
          } catch (e) {
            console.warn(`Erro ao ler roteiros do item ${bomItem.component_name}`);
          }

          for (const routeRef of itemRoutes) {
            const routeId = routeRef.route_id || routeRef.id;
            if (!routeId) continue;

            const routeSteps = await base44.entities.ProductionRouteStep.filter({ route_id: routeId });
            for (const rs of (routeSteps || []).sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0))) {
              stepsToCreate.push({
                company_id: companyId,
                op_id: opId,
                sequence: globalSequence++,
                name: `${bomItem.component_name}: ${rs.name}`,
                description: rs.description || '',
                status: 'PENDENTE',
                resource_type: rs.resource_type,
                resource_id: rs.resource_id,
              });
            }
          }
        }

        // --- ETAPA B: Roteiros do Produto Principal (Montagem Final) ---
        let versionRoutes = [];
        try {
          if (activeVersion?.routes) {
            versionRoutes = typeof activeVersion.routes === 'string' 
              ? JSON.parse(activeVersion.routes) 
              : activeVersion.routes;
          }
          if (!Array.isArray(versionRoutes)) versionRoutes = [];
        } catch (e) {
          console.warn('Erro ao ler roteiros da versão');
        }

        if (versionRoutes.length > 0) {
          console.log(`🏭 Gerando ${versionRoutes.length} roteiros de MONTAGEM FINAL`);
          for (const routeRef of versionRoutes) {
            const routeId = routeRef.route_id || routeRef.id;
            if (!routeId) continue;

            const routeSteps = await base44.entities.ProductionRouteStep.filter({ route_id: routeId });
            for (const rs of (routeSteps || []).sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0))) {
              stepsToCreate.push({
                company_id: companyId,
                op_id: opId,
                sequence: globalSequence++,
                name: `${op.product_name}: ${rs.name}`,
                description: `Montagem Final - ${rs.description || ''}`,
                status: 'PENDENTE',
                resource_type: rs.resource_type,
                resource_id: rs.resource_id,
              });
            }
          }
        }

        if (stepsToCreate.length === 0) {
          throw new Error('Nenhum roteiro encontrado na BOM ou nos componentes.');
        }

        await base44.entities.ProductionStep.bulkCreate(stepsToCreate);
        toast.success(`${stepsToCreate.length} etapas geradas do BOM (Componentes + Montagem Principal)`);
      } catch (err) {
        console.error('Erro na inicialização:', err);
        toast.error(err.message || 'Erro ao gerar etapas');
      } finally {
        initializingRef.current = false;
        queryClient.invalidateQueries({ queryKey: ['production-steps', opId, companyId] });
      }
    },
    onSuccess: () => {
      // Já invalidado no finally para garantir
    }
  });

  const registerConsumptionMutation = useMutation({
    mutationFn: async () => {
      if (!consumptionProduct || !consumptionQty || !consumptionWarehouseId || !consumptionLocationId) {
        throw new Error('Preencha produto, quantidade, armazém e localização');
      }

      const qty = parseFloat(consumptionQty);
      if (isNaN(qty) || qty <= 0) {
        throw new Error('Quantidade deve ser um número positivo');
      }

      const user = await base44.auth.me();

      // Buscar saldo especificamente na localização selecionada
      const balanceWithStock = await base44.entities.StockBalance.filter({
        company_id: companyId,
        product_id: consumptionProduct.id,
        warehouse_id: consumptionWarehouseId,
        location_id: consumptionLocationId
      }).then(d => d?.[0]);

      if (!balanceWithStock || (balanceWithStock.qty_available || 0) < qty) {
        const available = balanceWithStock?.qty_available || 0;
        throw new Error(`Saldo insuficiente na localização selecionada. Disponível: ${available} ${consumptionProduct.unit || 'UN'}`);
      }

      // 1. Criar movimento de inventário e baixar saldo (Centralizado)
      const moveData = {
        company_id: companyId,
        type: 'PRODUCAO_CONSUMO',
        product_id: consumptionProduct.id,
        qty: qty,
        from_warehouse_id: consumptionWarehouseId,
        from_location_id: consumptionLocationId,
        related_type: 'OP',
        related_id: opId,
        reason: `Consumo da OP-${op.op_number}`,
        unit_cost: consumptionProduct.cost_price || 0
      };

      const move = await executeInventoryTransaction(moveData, companyId);

      // 2. Atualizar controles de OP (BOM e Consumo Centralizado)
      await processProductionOrderControls(moveData, companyId, move.id);

      // 3. Criar registro de material (Rastreabilidade adicional)
      await base44.entities.MaterialConsumption.create({
        company_id: companyId,
        op_id: opId,
        product_id: consumptionProduct.id,
        product_sku: consumptionProduct.sku,
        product_name: consumptionProduct.name,
        qty_consumed: qty,
        warehouse_id: consumptionWarehouseId,
        location_id: consumptionLocationId,
        registered_by: user.email,
        registered_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-order', opId, companyId] });
      queryClient.invalidateQueries({ queryKey: ['op-consumption-controls', companyId] });
      setConsumptionProduct(null);
      setConsumptionQty('');
      setConsumptionWarehouseId('');
      setConsumptionLocationId('');
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
        // Bloqueio de segurança contra encerramento duplo
        const currentOP = await base44.entities.ProductionOrder.filter({ company_id: companyId, id: opId }).then(d => d?.[0]);
        if (currentOP?.status === 'ENCERRADA') {
          throw new Error('Esta OP já foi encerrada anteriormente.');
        }
        if (currentOP?.status === 'CANCELADA') {
          throw new Error('Não é possível encerrar uma OP cancelada.');
        }

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

        // 1. Centralizado: Criar entrada de produção no estoque
        if (op.qty_produced > 0) {
          await executeInventoryTransaction({
            company_id: companyId,
            type: 'PRODUCAO_ENTRADA',
            product_id: op.product_id,
            qty: op.qty_produced,
            to_warehouse_id: warehouseId,
            to_location_id: op.location_id || undefined,
            related_type: 'OP',
            related_id: opId,
            reason: `Produção finalizada da OP-${op.op_number}`
          }, companyId);
        }

        // 2. Update OP status to ENCERRADA and save warehouse/location if not already set
        const updateData = { 
          status: 'ENCERRADA'
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
        status: 'PENDENTE',
        resource_id: stepResourceId || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-steps', opId, companyId] });
      queryClient.invalidateQueries({ queryKey: ['productionSteps', companyId] });
      queryClient.invalidateQueries({ queryKey: ['productionOrders', companyId] });
      toast.success('Etapa adicionada com sucesso');
      setShowAddStepDialog(false);
      setStepName('');
      setStepDescription('');
      setStepResourceId('');
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
      if (editStepResourceId) updateData.resource_id = editStepResourceId;
      
      // Se estiver iniciando (EM_ANDAMENTO), garante que a OP também mude para EM_ANDAMENTO
      if (editStepStatus === 'EM_ANDAMENTO') {
        updateData.started_at = new Date().toISOString();
      } else if (editStepStatus === 'CONCLUIDA') {
        updateData.completed_at = new Date().toISOString();
      }
      
      await base44.entities.ProductionStep.update(stepId, updateData);

      // Sincroniza o status da OP se uma etapa iniciar
      if (editStepStatus === 'EM_ANDAMENTO' && op && op.status !== 'EM_ANDAMENTO' && op.status !== 'CONCLUIDA' && op.status !== 'ENCERRADA') {
        await base44.entities.ProductionOrder.update(opId, { status: 'EM_ANDAMENTO' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-order', opId, companyId] });
      queryClient.invalidateQueries({ queryKey: ['production-steps', opId, companyId] });
      queryClient.invalidateQueries({ queryKey: ['productionSteps', companyId] });
      queryClient.invalidateQueries({ queryKey: ['productionOrders', companyId] });
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
      queryClient.invalidateQueries({ queryKey: ['productionSteps', companyId] });
      queryClient.invalidateQueries({ queryKey: ['productionOrders', companyId] });
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
    if (op.status === 'ENCERRADA') {
      toast.error('Esta OP já está encerrada.');
      return;
    }
    if (op.status === 'CANCELADA') {
      toast.error('Esta OP está cancelada e não pode ser encerrada.');
      return;
    }

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
      console.log('🔍 Verificando BOM para encerramento...', { productId: op?.product_id, opId });
      
      // Buscar BOM vinculada ao produto.
      let boms = await base44.entities.BOM.filter({ company_id: companyId, product_id: op.product_id });
      
      const targetBOM = boms?.find(b => b.is_active) || boms?.[0];
      
      if (targetBOM) {
        const versionId = targetBOM.current_version_id || targetBOM.id;
        const bomItems = await base44.entities.BOMItem.filter({ company_id: companyId, bom_version_id: versionId });
        
        console.log(`📦 Encontrados ${bomItems.length} itens na BOM para versão ${versionId}`);
        
        if (bomItems.length > 0) {
          const deliveryControls = await base44.entities.BOMDeliveryControl.filter({ op_id: opId });
          
          for (const bomItem of bomItems) {
            const qtyPerUnit = Number(bomItem.qty || bomItem.quantity || 0);
            if (qtyPerUnit <= 0) continue;

            const qtyNeeded = qtyPerUnit * Number(op.qty_planned || 0);
            const delivered = deliveryControls
              .filter(dc => (dc.component_id === bomItem.component_id) || (dc.consumed_product_id === bomItem.component_id))
              .reduce((sum, dc) => sum + (Number(dc.qty) || 0), 0);
            
            if (delivered < (qtyNeeded - 0.001)) {
              warnings.push(`Componente ${bomItem.component_sku || bomItem.component_name || 'Material'} - entregues ${delivered} de ${qtyNeeded} ${bomItem.unit || 'un'}`);
            }
          }
        } else {
           console.log('⚠️ Itens da BOM não encontrados para a versão.');
        }
      } else {
         console.log('⚠️ Nenhuma BOM ativa ou disponível encontrada para o produto:', op.product_id);
         // Fallback: Se não encontrou BOM, verificar se houve QUALQUER consumo registrado na OP
         const consumptions = await base44.entities.OPConsumptionControl.filter({ company_id: companyId, op_id: opId });
         if (!consumptions || consumptions.length === 0) {
           warnings.push("Atenção: Nenhum consumo de material registrado para esta OP no Controle de Produção.");
         }
      }
    } catch (e) {
      console.error('❌ Erro detalhado ao verificar BOM:', e);
      warnings.push("Erro ao validar itens da BOM. Verifique manualmente se todos os componentes foram entregues.");
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

  const updateClientMutation = useMutation({
    mutationFn: async ({ clientId, clientName }) => {
      return base44.entities.ProductionOrder.update(opId, { 
        client_id: clientId,
        client_name: clientName
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-order', opId] });
      setIsEditingClient(false);
      toast.success('Cliente atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar cliente: ' + error.message);
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
            disabled={pauseOpMutation.isPending || resumeOpMutation.isPending || op.status === 'ENCERRADA' || op.status === 'CANCELADA'}
            variant="outline" 
            size="sm"
          >
            <Pause className="h-4 w-4 mr-2" />
            {op.status === 'PAUSADA' ? 'Retomar' : 'Pausar'}
          </Button>
          <Button 
            onClick={handleSepararBOM}
            disabled={op.status === 'ENCERRADA' || op.status === 'CANCELADA'}
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
            disabled={registerProductionMutation.isPending || op.qty_produced >= op.qty_planned || op.status === 'ENCERRADA' || op.status === 'CANCELADA'}
            variant="outline" 
            size="sm"
          >
            <Check className="h-4 w-4 mr-2" />
            Registrar Produção
          </Button>
          <Button 
            onClick={handleEncerrar}
            disabled={closeOpMutation.isPending || op.status === 'ENCERRADA' || op.status === 'CANCELADA'}
            className={op.status === 'ENCERRADA' ? "bg-slate-400" : "bg-green-600 hover:bg-green-700"}
            size="sm"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {closeOpMutation.isPending ? 'Encerrando...' : 'Encerrar'}
          </Button>
          <Button 
            onClick={handleCancelar}
            disabled={cancelLoading || cancelOpMutation.isPending || op.status === 'ENCERRADA' || op.status === 'CANCELADA'}
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
                 <div className="col-span-2 border-t pt-4">
                   <div className="flex items-center justify-between">
                     <p className="text-sm text-slate-500 italic block">Vinculado ao Cliente</p>
                     {!isEditingClient && (
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="h-6 w-6 p-0 hover:bg-slate-100"
                         onClick={() => {
                           setTempClientId(op.client_id || '');
                           setTempClientName(op.client_name || '');
                           setIsEditingClient(true);
                         }}
                         disabled={op.status === 'ENCERRADA' || op.status === 'CANCELADA'}
                       >
                         <Pencil className="h-3 w-3 text-slate-400" />
                       </Button>
                     )}
                   </div>
                   
                   {isEditingClient ? (
                     <div className="mt-2 space-y-2">
                       <ClientSearchSelect 
                         value={tempClientId}
                         onSelect={(id, client) => {
                           setTempClientId(id);
                           setTempClientName(client?.name || '');
                         }}
                         placeholder="Buscar cliente..."
                       />
                       <div className="flex justify-end gap-2">
                         <Button 
                           size="sm" 
                           variant="outline" 
                           onClick={() => setIsEditingClient(false)}
                         >
                           Cancelar
                         </Button>
                         <Button 
                           size="sm" 
                           onClick={() => updateClientMutation.mutate({ clientId: tempClientId, clientName: tempClientName })}
                           disabled={updateClientMutation.isPending}
                         >
                           {updateClientMutation.isPending ? 'Salvando...' : 'Salvar'}
                         </Button>
                       </div>
                     </div>
                   ) : (
                     <p className="font-semibold text-indigo-600">
                       {op.client_name || (op.client_id ? 'Carregando...' : 'Não vinculado')}
                     </p>
                   )}
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
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Armazém Origem</Label>
                  <Select 
                    value={consumptionWarehouseId} 
                    onValueChange={(val) => {
                      setConsumptionWarehouseId(val);
                      setConsumptionLocationId('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o armazém" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.code} - {w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Localização Origem</Label>
                  <Select 
                    value={consumptionLocationId} 
                    onValueChange={setConsumptionLocationId}
                    disabled={!consumptionWarehouseId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a localização" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.filter(l => l.warehouse_id === consumptionWarehouseId).map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.barcode} ({l.name || 'S/N'})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={() => registerConsumptionMutation.mutate()}
                disabled={registerConsumptionMutation.isPending}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {registerConsumptionMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Registrar Consumo
              </Button>
            </CardContent>
          </Card>

          {/* Consumos Registrados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Materiais Entregues / Consumidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(bomDeliveries?.filter(bd => Number(bd.qty) > 0).length === 0) && (materialConsumptions?.filter(mc => Number(mc.qty_consumed) > 0).length === 0) ? (
                  <p className="text-sm text-slate-500 text-center py-4">Nenhum consumo ou entrega registrado para esta OP.</p>
                ) : (
                  <>
                    {bomDeliveries?.filter(bd => Number(bd.qty) > 0).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 text-slate-700">Entregas do BOM</h4>
                        <div className="space-y-2">
                          {bomDeliveries.filter(bd => Number(bd.qty) > 0).map(bd => (
                            <div key={bd.id} className="flex justify-between items-center p-2 rounded border bg-slate-50 text-sm">
                              <div>
                                <p className="font-medium">{bd.component_name || bd.consumed_product_name}</p>
                                <p className="text-xs text-slate-500">[{bd.component_sku || bd.consumed_product_sku}]</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className={`${bd.status === 'ENTREGUE' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                  {bd.status}
                                </Badge>
                                <span className="font-bold">{Number(bd.qty || 0).toLocaleString('pt-BR')} un</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {materialConsumptions?.filter(mc => Number(mc.qty_consumed) > 0).length > 0 && (
                      <div className="pt-2">
                        <h4 className="text-sm font-semibold mb-2 text-slate-700">Consumos Manuais</h4>
                        <div className="space-y-2">
                          {materialConsumptions.filter(mc => Number(mc.qty_consumed) > 0).map(mc => (
                            <div key={mc.id} className="flex justify-between items-center p-2 rounded border bg-slate-50 text-sm">
                              <div>
                                <p className="font-medium">{mc.product_name}</p>
                                <p className="text-xs text-slate-500">[{mc.product_sku}]</p>
                              </div>
                              <span className="font-bold text-indigo-600">{Number(mc.qty_consumed || 0).toLocaleString('pt-BR')} un</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
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
                          <div className="grid grid-cols-2 gap-3">
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
                          </div>
                          <div className="md:col-span-2">
                            <Label>Recurso de Produção</Label>
                            <Select value={editStepResourceId} onValueChange={setEditStepResourceId}>
                              <SelectTrigger className="h-9 mt-1">
                                <SelectValue placeholder="Selecione o recurso" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhum recurso</SelectItem>
                                {resources.map(r => (
                                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
            <div>
              <Label>Recurso de Produção</Label>
              <Select value={stepResourceId} onValueChange={setStepResourceId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o recurso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum recurso</SelectItem>
                  {resources.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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