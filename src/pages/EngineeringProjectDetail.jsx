import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, Edit2, Save, X, Plus, Upload, FileText, Cpu, Zap, Layers,
  Clock, Calendar, User, Paperclip, MessageSquare, Package, Trash2, Eye,
  CheckCircle2, AlertTriangle, ExternalLink, GitBranch, History
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_OPTIONS = [
  { value: 'PLANEJAMENTO', label: 'Planejamento', color: 'bg-slate-100 text-slate-700' },
  { value: 'EM_ANDAMENTO', label: 'Em Andamento', color: 'bg-blue-100 text-blue-700' },
  { value: 'REVISAO',      label: 'Em Revisão',   color: 'bg-amber-100 text-amber-700' },
  { value: 'APROVADO',     label: 'Aprovado',     color: 'bg-emerald-100 text-emerald-700' },
  { value: 'CONCLUIDO',    label: 'Concluído',    color: 'bg-purple-100 text-purple-700' },
  { value: 'CANCELADO',    label: 'Cancelado',    color: 'bg-red-100 text-red-700' },
];

const UPDATE_TYPES = [
  { value: 'PROGRESSO',   label: 'Progresso' },
  { value: 'REVISAO',     label: 'Revisão' },
  { value: 'PROBLEMA',    label: 'Problema' },
  { value: 'APROVACAO',   label: 'Aprovação' },
  { value: 'COMENTARIO',  label: 'Comentário' },
];

const PHASE_OPTIONS = [
  { value: 'PROJETANDO',      label: 'Projetando',        color: 'bg-blue-100 text-blue-700' },
  { value: 'DESENHANDO',      label: 'Desenhando',        color: 'bg-indigo-100 text-indigo-700' },
  { value: 'DETALHAMENTO',    label: 'Detalhamento',      color: 'bg-amber-100 text-amber-700' },
  { value: 'CRIACAO_BOM',     label: 'Criação de BOM',    color: 'bg-purple-100 text-purple-700' },
  { value: 'REVISAO_TECNICA', label: 'Revisão Técnica',   color: 'bg-orange-100 text-orange-700' },
  { value: 'APROVACAO_FINAL', label: 'Aprovação Final',   color: 'bg-emerald-100 text-emerald-700' },
];

const UPDATE_TYPE_COLORS = {
  PROGRESSO:  'bg-blue-100 text-blue-700',
  REVISAO:    'bg-amber-100 text-amber-700',
  PROBLEMA:   'bg-red-100 text-red-700',
  APROVACAO:  'bg-emerald-100 text-emerald-700',
  COMENTARIO: 'bg-slate-100 text-slate-700',
};

export default function EngineeringProjectDetail() {
  const { companyId } = useCompanyId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addUpdateOpen, setAddUpdateOpen] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [itemForm, setItemForm] = useState({ 
    code: '', 
    description: '', 
    quantity: 1, 
    unit: 'UN', 
    material: '', 
    notes: '',
    category: '',
    cost_price: '',
    sale_price: '',
    min_stock: '',
    max_stock: ''
  });
  const [updateForm, setUpdateForm] = useState({ type: 'PROGRESSO', title: '', content: '', hours_logged: '', progress_percent: '' });
  const [editingUpdate, setEditingUpdate] = useState(null); // update being edited

  // Update dialog component action
  const [componentAction, setComponentAction] = useState('none'); // 'none' | 'modify' | 'delete'
  const [componentSearch, setComponentSearch] = useState('');
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [newDrawingFile, setNewDrawingFile] = useState(null);
  const [newDrawingName, setNewDrawingName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [obsoleteReason, setObsoleteReason] = useState('');
  const [uploadingDrawing, setUploadingDrawing] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['eng-project', projectId],
    queryFn: async () => {
      const res = await base44.entities.EngineeringProject.filter({ company_id: companyId, id: projectId });
      return res?.[0];
    },
    enabled: !!projectId && !!companyId,
  });

  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ['eng-project-items', projectId],
    queryFn: () => base44.entities.EngineeringProjectItem.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: updates = [], refetch: refetchUpdates } = useQuery({
    queryKey: ['eng-project-updates', projectId],
    queryFn: () => base44.entities.EngineeringProjectUpdate.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data) => {
      const historyEntries = [...(project.responsible_history || [])];
      const changedBy = currentUser?.full_name || currentUser?.email || 'Usuário';
      const changedByEmail = currentUser?.email || '';
      const now = new Date().toISOString();

      // Detect responsible change
      if (data.responsible_name !== project.responsible_name) {
        historyEntries.push({
          date: now,
          changed_by: changedBy,
          changed_by_email: changedByEmail,
          field: 'responsible',
          from: project.responsible_name || '—',
          to: data.responsible_name || '—',
          note: 'Responsável alterado',
        });
      }

      // Detect phase change
      if (data.phase !== project.phase) {
        const phaseLabel = (v) => PHASE_OPTIONS.find(p => p.value === v)?.label || v || '—';
        historyEntries.push({
          date: now,
          changed_by: changedBy,
          changed_by_email: changedByEmail,
          field: 'phase',
          from: project.phase || '—',
          to: data.phase || '—',
          note: `Fase alterada: ${phaseLabel(project.phase)} → ${phaseLabel(data.phase)}`,
        });
      }

      await base44.entities.EngineeringProject.update(projectId, {
        ...data,
        responsible_history: historyEntries,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eng-project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['engineering-projects', companyId] });
      toast.success('Projeto atualizado!');
      setEditing(false);
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!itemForm.code || !itemForm.description) throw new Error('Código e descrição são obrigatórios');
      
      // 1. Garantir que o produto exista no cadastro geral
      const existingProduct = (await base44.entities.Product.filter({ company_id: companyId, sku: itemForm.code }))?.[0];
      
      if (!existingProduct) {
        // Criar produto se não existir
        await base44.entities.Product.create({
          company_id: companyId,
          sku: itemForm.code,
          name: itemForm.description,
          unit: itemForm.unit || 'UN',
          category: itemForm.category || 'ENGENHARIA',
          cost_price: parseFloat(itemForm.cost_price) || 0,
          sale_price: parseFloat(itemForm.sale_price) || 0,
          min_stock: parseFloat(itemForm.min_stock) || 0,
          max_stock: parseFloat(itemForm.max_stock) || 0,
          active: true
        });
        toast.info('Novo produto cadastrado automaticamente');
      }

      // 2. Adicionar o item ao projeto de engenharia
      await base44.entities.EngineeringProjectItem.create({
        code: itemForm.code,
        description: itemForm.description,
        company_id: companyId,
        project_id: projectId,
        quantity: parseFloat(itemForm.quantity) || 1,
        unit: itemForm.unit,
        material: itemForm.material,
        notes: itemForm.notes,
        drawings: [],
      });
    },
    onSuccess: () => {
      refetchItems();
      toast.success('Item e Produto vinculados com sucesso!');
      setAddItemOpen(false);
      setItemForm({ 
        code: '', description: '', quantity: 1, unit: 'UN', material: '', notes: '',
        category: '', cost_price: '', sale_price: '', min_stock: '', max_stock: ''
      });
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  // Função para buscar produto ao sair do campo código
  const handleLookupProduct = async (code) => {
    if (!code) return;
    try {
      const resp = await base44.entities.Product.filter({ company_id: companyId, sku: code });
      const prod = resp?.[0];
      if (prod) {
        setItemForm(prev => ({
          ...prev,
          description: prod.name || prev.description,
          unit: prod.unit || prev.unit,
          category: prod.category || prev.category,
          cost_price: String(prod.cost_price || ''),
          sale_price: String(prod.sale_price || ''),
          min_stock: String(prod.min_stock || ''),
          max_stock: String(prod.max_stock || '')
        }));
        toast.info('Dados carregados do cadastro de produtos');
      }
    } catch (err) {
      console.error('Erro ao buscar produto:', err);
    }
  };

  // Validation: when changing status to CONCLUIDO, non-obsolete items must have a drawing
  const itemsMissingDrawings = items.filter(item => !item.obsolete && (!item.drawings || item.drawings.length === 0));
  const isSettingConcluido = updateForm.progress_percent === '100' || editForm.status === 'CONCLUIDO';

  const addUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!updateForm.title || !updateForm.content) throw new Error('Título e conteúdo são obrigatórios');

      let componentNote = '';

      // Handle component action
      if (componentAction === 'modify' && selectedComponent) {
        // Upload new drawing if provided
        if (newDrawingFile) {
          setUploadingDrawing(true);
          const { file_url } = await base44.integrations.Core.UploadFile({ file: newDrawingFile });
          setUploadingDrawing(false);
          const ext = newDrawingFile.name.split('.').pop().toUpperCase();
          const fileType = ['PDF', 'DXF', 'DWG'].includes(ext) ? ext : 'OUTRO';
          const drawing = { name: newDrawingFile.name, url: file_url, file_type: fileType, revision: String((selectedComponent.drawings?.length || 0) + 1), uploaded_at: new Date().toISOString() };
          const newDrawings = [...(selectedComponent.drawings || []), drawing];
          const updates = { drawings: newDrawings };
          if (newDescription) updates.description = newDescription;
          await base44.entities.EngineeringProjectItem.update(selectedComponent.id, updates);
        } else if (newDescription) {
          await base44.entities.EngineeringProjectItem.update(selectedComponent.id, { description: newDescription });
        }
        componentNote = `\n\n📝 Componente modificado: [${selectedComponent.code}] ${newDescription || selectedComponent.description}${newDrawingFile ? ` — novo desenho: ${newDrawingFile.name}` : ''}`;
      } else if (componentAction === 'delete' && selectedComponent) {
        await base44.entities.EngineeringProjectItem.update(selectedComponent.id, {
          obsolete: true,
          obsolete_reason: obsoleteReason || 'Inutilizado via atualização de projeto',
        });
        componentNote = `\n\n🚫 Componente obsoleto: [${selectedComponent.code}] ${selectedComponent.description}. Motivo: ${obsoleteReason || 'Inutilizado'}`;
      }

      const updateData = {
        ...updateForm,
        company_id: companyId,
        project_id: projectId,
        author_name: currentUser?.full_name || 'Usuário',
        author_email: currentUser?.email,
        hours_logged: parseFloat(updateForm.hours_logged) || 0,
        content: updateForm.content + componentNote,
        attachments: [],
      };
      await base44.entities.EngineeringProjectUpdate.create(updateData);
      // Update project hours and progress if provided
      const updateProjectData = {};
      if (updateForm.hours_logged) {
        updateProjectData.actual_hours = (project?.actual_hours || 0) + parseFloat(updateForm.hours_logged);
      }
      if (updateForm.progress_percent) {
        updateProjectData.progress_percent = parseFloat(updateForm.progress_percent);
      }
      if (Object.keys(updateProjectData).length > 0) {
        await base44.entities.EngineeringProject.update(projectId, updateProjectData);
      }
    },
    onSuccess: () => {
      refetchUpdates();
      refetchItems();
      queryClient.invalidateQueries({ queryKey: ['eng-project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['eng-all-items', companyId] });
      toast.success('Atualização registrada!');
      setAddUpdateOpen(false);
      setUpdateForm({ type: 'PROGRESSO', title: '', content: '', hours_logged: '', progress_percent: '' });
      setComponentAction('none');
      setComponentSearch('');
      setSelectedComponent(null);
      setNewDrawingFile(null);
      setNewDrawingName('');
      setNewDescription('');
      setObsoleteReason('');
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const editUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!editingUpdate) return;
      await base44.entities.EngineeringProjectUpdate.update(editingUpdate.id, {
        type: editingUpdate.type,
        title: editingUpdate.title,
        content: editingUpdate.content,
        hours_logged: parseFloat(editingUpdate.hours_logged) || 0,
        progress_percent: editingUpdate.progress_percent ? parseFloat(editingUpdate.progress_percent) : undefined,
      });
    },
    onSuccess: () => {
      refetchUpdates();
      toast.success('Atualização editada!');
      setEditingUpdate(null);
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const filteredComponents = items.filter(item => {
    if (!componentSearch) return false;
    const q = componentSearch.toLowerCase();
    return item.code?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
  });

  const uploadAttachment = async (file, targetType, targetId) => {
    setUploadingAttachment(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploadingAttachment(false);
    return { name: file.name, url: file_url, type: file.name.split('.').pop().toUpperCase(), uploaded_at: new Date().toISOString() };
  };

  const handleProjectAttachment = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const att = await uploadAttachment(file);
    const newAtts = [...(project.attachments || []), att];
    await base44.entities.EngineeringProject.update(projectId, { attachments: newAtts });
    queryClient.invalidateQueries({ queryKey: ['eng-project', projectId] });
    toast.success('Anexo adicionado!');
  };

  const handleItemDrawing = async (e, item) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const ext = file.name.split('.').pop().toUpperCase();
      const fileType = ['PDF', 'DXF', 'DWG'].includes(ext) ? ext : 'OUTRO';
      const drawing = { 
        name: file.name, 
        url: file_url, 
        file_type: fileType, 
        revision: String((item.drawings?.length || 0) + 1), 
        uploaded_at: new Date().toISOString() 
      };
      const newDrawings = [...(item.drawings || []), drawing];
      await base44.entities.EngineeringProjectItem.update(item.id, { drawings: newDrawings });
      await refetchItems();
      toast.success('Desenho salvo com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar desenho:', err);
      toast.error('Erro ao salvar desenho: ' + err.message);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const deleteItem = async (itemId) => {
    await base44.entities.EngineeringProjectItem.delete(itemId);
    refetchItems();
    toast.success('Item removido');
  };

  const removeAttachment = async (idx) => {
    const newAtts = project.attachments.filter((_, i) => i !== idx);
    await base44.entities.EngineeringProject.update(projectId, { attachments: newAtts });
    queryClient.invalidateQueries({ queryKey: ['eng-project', projectId] });
    toast.success('Anexo removido');
  };

  if (isLoading) return <div className="text-center py-12 text-slate-500">Carregando...</div>;
  if (!project) return <div className="text-center py-12 text-slate-500">Projeto não encontrado</div>;

  const statusCfg = STATUS_OPTIONS.find(s => s.value === project.status) || STATUS_OPTIONS[0];
  const isDelayed = project.estimated_end_date &&
    project.status !== 'CONCLUIDO' && project.status !== 'CANCELADO' &&
    differenceInDays(new Date(), new Date(project.estimated_end_date)) > 0;

  const sortedUpdates = [...updates].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-2 text-sm">
            <ArrowLeft className="h-4 w-4" />Voltar
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
            {isDelayed && <Badge className="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" />Atrasado</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-sm font-mono text-slate-500">{project.code}</span>
            <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
            {project.phase && (() => {
              const phaseCfg = PHASE_OPTIONS.find(p => p.value === project.phase);
              return phaseCfg ? (
                <Badge className={`${phaseCfg.color} flex items-center gap-1`}>
                  <GitBranch className="h-3 w-3" />{phaseCfg.label}
                </Badge>
              ) : null;
            })()}
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button
                onClick={() => {
                  if (editForm.status === 'CONCLUIDO' && itemsMissingDrawings.length > 0) {
                    toast.error(`Não é possível concluir: ${itemsMissingDrawings.length} componente(s) sem desenho anexado.`);
                    return;
                  }
                  updateProjectMutation.mutate(editForm);
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="h-4 w-4 mr-2" />Salvar
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => { setEditForm({ ...project }); setEditing(true); }}>
              <Edit2 className="h-4 w-4 mr-2" />Editar
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Progresso Geral</span>
            <span className="text-sm font-bold text-indigo-700">{project.progress_percent || 0}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3">
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all" style={{ width: `${project.progress_percent || 0}%` }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <div className="text-center">
              <p className="text-xs text-slate-500">Responsável</p>
              <p className="text-sm font-medium">{project.responsible_name || '—'}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Fase Atual</p>
              <p className="text-sm font-medium">{PHASE_OPTIONS.find(p => p.value === project.phase)?.label || '—'}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Início</p>
              <p className="text-sm font-medium">{project.start_date ? format(new Date(project.start_date), 'dd/MM/yyyy') : '—'}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Previsão de Fim</p>
              <p className={`text-sm font-medium ${isDelayed ? 'text-red-600' : ''}`}>
                {project.estimated_end_date ? format(new Date(project.estimated_end_date), 'dd/MM/yyyy') : '—'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Horas</p>
              <p className="text-sm font-medium">{project.actual_hours || 0} / {project.estimated_hours || '—'}h</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="info">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="items">Peças / Componentes</TabsTrigger>
          <TabsTrigger value="attachments">Anexos</TabsTrigger>
          <TabsTrigger value="updates">Atualizações</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* INFO TAB */}
        <TabsContent value="info">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Nome</Label><Input value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                    <div><Label>Código</Label><Input value={editForm.code || ''} onChange={e => setEditForm({...editForm, code: e.target.value})} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                   <div>
                     <Label>Status</Label>
                     <select value={editForm.status || ''} onChange={e => setEditForm({...editForm, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                       {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                     </select>
                   </div>
                   <div>
                     <Label>Fase</Label>
                     <select value={editForm.phase || ''} onChange={e => setEditForm({...editForm, phase: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                       <option value="">— Sem fase —</option>
                       {PHASE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                     </select>
                   </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                   <div><Label>Responsável</Label><Input value={editForm.responsible_name || ''} onChange={e => setEditForm({...editForm, responsible_name: e.target.value})} /></div>
                   <div><Label>Progresso (%)</Label><Input type="number" min="0" max="100" value={editForm.progress_percent || 0} onChange={e => setEditForm({...editForm, progress_percent: parseFloat(e.target.value)})} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>Data de Início</Label><Input type="date" value={editForm.start_date || ''} onChange={e => setEditForm({...editForm, start_date: e.target.value})} /></div>
                    <div><Label>Previsão de Fim</Label><Input type="date" value={editForm.estimated_end_date || ''} onChange={e => setEditForm({...editForm, estimated_end_date: e.target.value})} /></div>
                    <div><Label>Horas Estimadas</Label><Input type="number" value={editForm.estimated_hours || ''} onChange={e => setEditForm({...editForm, estimated_hours: parseFloat(e.target.value)})} /></div>
                  </div>
                  <div><Label>Produto/Máquina</Label><Input value={editForm.product_name || ''} onChange={e => setEditForm({...editForm, product_name: e.target.value})} /></div>
                  <div><Label>Descrição do Produto</Label><Textarea value={editForm.product_description || ''} onChange={e => setEditForm({...editForm, product_description: e.target.value})} rows={3} /></div>
                  <div><Label>Descrição Geral</Label><Textarea value={editForm.description || ''} onChange={e => setEditForm({...editForm, description: e.target.value})} rows={3} /></div>
                  <div><Label>Observações</Label><Textarea value={editForm.notes || ''} onChange={e => setEditForm({...editForm, notes: e.target.value})} rows={2} /></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {project.product_name && (
                    <div>
                      <p className="text-sm font-medium text-slate-500">Produto / Máquina</p>
                      <p className="text-slate-900 font-medium">{project.product_name}</p>
                    </div>
                  )}
                  {project.product_description && (
                    <div>
                      <p className="text-sm font-medium text-slate-500">Descrição do Produto</p>
                      <p className="text-slate-700 whitespace-pre-wrap">{project.product_description}</p>
                    </div>
                  )}
                  {project.description && (
                    <div>
                      <p className="text-sm font-medium text-slate-500">Descrição Geral</p>
                      <p className="text-slate-700 whitespace-pre-wrap">{project.description}</p>
                    </div>
                  )}
                  {project.notes && (
                    <div>
                      <p className="text-sm font-medium text-slate-500">Observações</p>
                      <p className="text-slate-700 whitespace-pre-wrap">{project.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ITEMS TAB */}
        <TabsContent value="items">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Peças e Componentes</CardTitle>
              <Button onClick={() => setAddItemOpen(true)} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4 mr-2" />Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Nenhuma peça cadastrada</p>
              ) : (
                <div className="space-y-3">
                  {items.map(item => (
                    <div key={item.id} className={`border rounded-lg p-4 space-y-3 ${item.obsolete ? 'opacity-60 bg-slate-50' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className={`font-mono text-sm font-bold ${item.obsolete ? 'text-slate-400 line-through' : 'text-indigo-700'}`}>{item.code}</span>
                            <span className={`font-medium ${item.obsolete ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{item.description}</span>
                            {item.obsolete && <Badge className="bg-red-100 text-red-600 text-xs">OBSOLETO</Badge>}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                            <span>Qtd: {item.quantity} {item.unit}</span>
                            {item.material && <span>Material: {item.material}</span>}
                          </div>
                          {item.notes && <p className="text-xs text-slate-500 mt-1">{item.notes}</p>}
                        </div>
                        <div className="flex gap-2">
                          <label className="cursor-pointer">
                            <input type="file" accept=".pdf,.dxf,.dwg" className="hidden" onChange={e => handleItemDrawing(e, item)} />
                            <Button size="sm" variant="outline" asChild>
                              <span><Upload className="h-3 w-3 mr-1" />Desenho</span>
                            </Button>
                          </label>
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteItem(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {Array.isArray(item.drawings) && item.drawings.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          {item.drawings.map((d, idx) => (
                            <a key={idx} href={d.url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 hover:bg-indigo-100 rounded text-xs text-slate-700 hover:text-indigo-700 transition-colors">
                              <FileText className="h-3 w-3" />
                              <span>{d.name}</span>
                              <Badge className="text-xs px-1 py-0 h-4">{d.file_type}</Badge>
                              <ExternalLink className="h-3 w-3 opacity-50" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ATTACHMENTS TAB */}
        <TabsContent value="attachments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Anexos do Projeto</CardTitle>
              <label className="cursor-pointer">
                <input type="file" className="hidden" onChange={handleProjectAttachment} />
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" asChild disabled={uploadingAttachment}>
                  <span><Upload className="h-4 w-4 mr-2" />{uploadingAttachment ? 'Enviando...' : 'Anexar Arquivo'}</span>
                </Button>
              </label>
            </CardHeader>
            <CardContent>
              {!Array.isArray(project.attachments) || project.attachments.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Nenhum anexo adicionado</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {project.attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-indigo-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">{att.name}</p>
                          <p className="text-xs text-slate-500">{att.type} · {att.uploaded_at ? format(new Date(att.uploaded_at), 'dd/MM/yyyy HH:mm') : ''}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a href={att.url} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline"><Eye className="h-4 w-4" /></Button>
                        </a>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => removeAttachment(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* UPDATES TAB */}
        <TabsContent value="updates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Histórico de Atualizações</CardTitle>
              <Button onClick={() => setAddUpdateOpen(true)} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4 mr-2" />Nova Atualização
              </Button>
            </CardHeader>
            <CardContent>
              {sortedUpdates.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Nenhuma atualização registrada</p>
              ) : (
                <div className="space-y-4">
                  {sortedUpdates.map(u => (
                    <div key={u.id} className="border-l-4 border-indigo-300 pl-4 py-2">
                      {editingUpdate?.id === u.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Tipo</Label>
                              <select value={editingUpdate.type} onChange={e => setEditingUpdate({...editingUpdate, type: e.target.value})} className="w-full px-2 py-1.5 border rounded text-sm">
                                {UPDATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs">Horas</Label>
                              <Input type="number" value={editingUpdate.hours_logged || ''} onChange={e => setEditingUpdate({...editingUpdate, hours_logged: e.target.value})} className="h-8 text-sm" />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Título</Label>
                            <Input value={editingUpdate.title} onChange={e => setEditingUpdate({...editingUpdate, title: e.target.value})} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Conteúdo</Label>
                            <Textarea value={editingUpdate.content} onChange={e => setEditingUpdate({...editingUpdate, content: e.target.value})} rows={3} className="text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Progresso (%)</Label>
                            <Input type="number" min="0" max="100" value={editingUpdate.progress_percent || ''} onChange={e => setEditingUpdate({...editingUpdate, progress_percent: e.target.value})} className="h-8 text-sm" placeholder="Deixe vazio para não alterar" />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => editUpdateMutation.mutate()} disabled={editUpdateMutation.isPending}>
                              <Save className="h-3 w-3 mr-1" />Salvar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingUpdate(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={UPDATE_TYPE_COLORS[u.type] || 'bg-slate-100 text-slate-700'}>
                                {UPDATE_TYPES.find(t => t.value === u.type)?.label || u.type}
                              </Badge>
                              <span className="font-medium text-slate-900">{u.title}</span>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{u.content}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                              <span>{u.author_name}</span>
                              <span>{format(new Date(u.created_date), 'dd/MM/yyyy HH:mm')}</span>
                              {u.hours_logged > 0 && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{u.hours_logged}h</span>}
                              {u.progress_percent && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{u.progress_percent}%</span>}
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => setEditingUpdate({ ...u })} className="shrink-0 h-7 w-7 p-0 text-slate-400 hover:text-indigo-600">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-500" />
                Histórico de Responsável e Fases
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!project.responsible_history?.length ? (
                <p className="text-center text-slate-500 py-8">Nenhuma alteração registrada ainda.<br/><span className="text-xs">As mudanças de responsável e fase serão registradas automaticamente ao editar o projeto.</span></p>
              ) : (
                <div className="space-y-0">
                  {[...(project.responsible_history || [])]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((entry, idx, arr) => {
                      const isLast = idx === arr.length - 1;
                      const isPhase = entry.field === 'phase';
                      const isResponsible = entry.field === 'responsible';
                      const fromLabel = isPhase ? (PHASE_OPTIONS.find(p => p.value === entry.from)?.label || entry.from) : entry.from;
                      const toLabel = isPhase ? (PHASE_OPTIONS.find(p => p.value === entry.to)?.label || entry.to) : entry.to;
                      return (
                        <div key={idx} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isPhase ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                              {isPhase ? <GitBranch className="h-4 w-4" /> : <User className="h-4 w-4" />}
                            </div>
                            {!isLast && <div className="w-px flex-1 bg-slate-200 my-1 min-h-4" />}
                          </div>
                          <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={isPhase ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}>
                                {isPhase ? 'Fase' : 'Responsável'}
                              </Badge>
                              <span className="text-sm text-slate-700">
                                <span className="text-slate-400 line-through">{fromLabel}</span>
                                {' → '}
                                <span className="font-semibold text-slate-900">{toLabel}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                              <span className="flex items-center gap-1"><User className="h-3 w-3" />{entry.changed_by}</span>
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(entry.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* Add Item Dialog */}
       <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Adicionar Peça / Componente</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código / SKU *</Label>
                <Input 
                  value={itemForm.code} 
                  onChange={e => setItemForm({...itemForm, code: e.target.value})} 
                  onBlur={() => handleLookupProduct(itemForm.code)}
                  placeholder="Ex: AMPH04" 
                />
              </div>
              <div><Label>Unidade</Label><Input value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} /></div>
            </div>
            <div><Label>Descrição *</Label><Input value={itemForm.description} onChange={e => setItemForm({...itemForm, description: e.target.value})} placeholder="Descrição da peça" /></div>
            
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Quantidade</Label><Input type="number" value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} /></div>
              <div><Label>Categoria do Produto</Label><Input value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})} placeholder="Ex: Fabricação" /></div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
               <div className="col-span-2 text-xs font-semibold text-slate-500 mb-1">DADOS DE CUSTO E ESTOQUE (PRODUTO)</div>
               <div><Label>Preço de Custo</Label><Input type="number" step="0.01" value={itemForm.cost_price} onChange={e => setItemForm({...itemForm, cost_price: e.target.value})} /></div>
               <div><Label>Preço de Venda</Label><Input type="number" step="0.01" value={itemForm.sale_price} onChange={e => setItemForm({...itemForm, sale_price: e.target.value})} /></div>
               <div><Label>Estoque Mín.</Label><Input type="number" value={itemForm.min_stock} onChange={e => setItemForm({...itemForm, min_stock: e.target.value})} /></div>
               <div><Label>Estoque Máx.</Label><Input type="number" value={itemForm.max_stock} onChange={e => setItemForm({...itemForm, max_stock: e.target.value})} /></div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div><Label>Material / Especificação</Label><Input value={itemForm.material} onChange={e => setItemForm({...itemForm, material: e.target.value})} /></div>
              <div><Label>Observações</Label><Textarea value={itemForm.notes} onChange={e => setItemForm({...itemForm, notes: e.target.value})} rows={2} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancelar</Button>
            <Button onClick={() => addItemMutation.mutate()} className="bg-indigo-600 hover:bg-indigo-700" disabled={addItemMutation.isPending}>
              {addItemMutation.isPending ? 'Salvando...' : 'Adicionar e Víncular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Update Dialog */}
      <Dialog open={addUpdateOpen} onOpenChange={(open) => {
        setAddUpdateOpen(open);
        if (!open) {
          setComponentAction('none');
          setComponentSearch('');
          setSelectedComponent(null);
          setNewDrawingFile(null);
          setNewDescription('');
          setObsoleteReason('');
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar Atualização</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <select value={updateForm.type} onChange={e => setUpdateForm({...updateForm, type: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {UPDATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><Label>Horas Registradas</Label><Input type="number" value={updateForm.hours_logged} onChange={e => setUpdateForm({...updateForm, hours_logged: e.target.value})} placeholder="0" /></div>
            </div>
            <div><Label>Título *</Label><Input value={updateForm.title} onChange={e => setUpdateForm({...updateForm, title: e.target.value})} placeholder="Título da atualização" /></div>
            <div><Label>Conteúdo *</Label><Textarea value={updateForm.content} onChange={e => setUpdateForm({...updateForm, content: e.target.value})} rows={3} placeholder="Descreva a atualização..." /></div>
            <div><Label>Atualizar Progresso (%)</Label><Input type="number" min="0" max="100" value={updateForm.progress_percent} onChange={e => setUpdateForm({...updateForm, progress_percent: e.target.value})} placeholder="Deixe vazio para não alterar" /></div>

            {/* Component action section */}
            <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
              <Label className="text-sm font-semibold text-slate-700">Ação sobre componente (opcional)</Label>
              <div className="flex gap-2">
                {[
                  { value: 'none', label: 'Nenhuma' },
                  { value: 'modify', label: '✏️ Modificar componente' },
                  { value: 'delete', label: '🚫 Tornar obsoleto' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setComponentAction(opt.value); setSelectedComponent(null); setComponentSearch(''); }}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${componentAction === opt.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {(componentAction === 'modify' || componentAction === 'delete') && (
                <div className="space-y-3">
                  <div>
                    <Label>Buscar componente por código</Label>
                    <div className="relative">
                      <Input
                        value={componentSearch}
                        onChange={e => { setComponentSearch(e.target.value); setSelectedComponent(null); }}
                        placeholder="Digite o código ou descrição..."
                        className="pr-8"
                      />
                      {componentSearch && (
                        <button onClick={() => { setComponentSearch(''); setSelectedComponent(null); }} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {componentSearch && !selectedComponent && filteredComponents.length > 0 && (
                      <div className="border rounded-lg mt-1 divide-y bg-white shadow-lg max-h-40 overflow-y-auto">
                        {filteredComponents.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setSelectedComponent(c); setComponentSearch(c.code + ' — ' + c.description); setNewDescription(c.description); }}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm flex items-center gap-2"
                          >
                            <span className="font-mono font-bold text-indigo-700">{c.code}</span>
                            <span className="text-slate-700">{c.description}</span>
                            {c.obsolete && <Badge className="bg-red-100 text-red-600 text-xs ml-auto">OBSOLETO</Badge>}
                          </button>
                        ))}
                      </div>
                    )}
                    {componentSearch && !selectedComponent && filteredComponents.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">Nenhum componente encontrado</p>
                    )}
                  </div>

                  {selectedComponent && componentAction === 'modify' && (
                    <div className="space-y-3 border rounded-lg p-3 bg-white">
                      <p className="text-xs text-slate-500 font-medium">Componente selecionado: <span className="font-mono text-indigo-700">{selectedComponent.code}</span></p>
                      <div>
                        <Label>Nova descrição (opcional)</Label>
                        <Input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Deixe vazio para manter a atual" />
                      </div>
                      <div>
                        <Label>Novo desenho (PDF / DXF / DWG)</Label>
                        <label className="cursor-pointer block">
                          <input type="file" accept=".pdf,.dxf,.dwg" className="hidden" onChange={e => { setNewDrawingFile(e.target.files[0]); setNewDrawingName(e.target.files[0]?.name || ''); }} />
                          <div className={`border-2 border-dashed rounded-lg p-3 text-center text-sm transition-colors ${newDrawingFile ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-400 hover:border-indigo-300'}`}>
                            {newDrawingFile ? (
                              <span className="flex items-center justify-center gap-2"><FileText className="h-4 w-4" />{newDrawingName}</span>
                            ) : (
                              <span className="flex items-center justify-center gap-2"><Upload className="h-4 w-4" />Clique para selecionar arquivo</span>
                            )}
                          </div>
                        </label>
                        {newDrawingFile && (
                          <button type="button" onClick={() => { setNewDrawingFile(null); setNewDrawingName(''); }} className="text-xs text-red-500 mt-1 hover:underline">Remover arquivo</button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedComponent && componentAction === 'delete' && (
                    <div className="space-y-2 border rounded-lg p-3 bg-white">
                      <p className="text-xs text-slate-500 font-medium">Componente a tornar obsoleto: <span className="font-mono text-red-600">{selectedComponent.code}</span> — {selectedComponent.description}</p>
                      <div>
                        <Label>Motivo da obsolescência</Label>
                        <Input value={obsoleteReason} onChange={e => setObsoleteReason(e.target.value)} placeholder="Ex: Substituído por novo modelo, descontinuado..." />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {updateForm.progress_percent === '100' && itemsMissingDrawings.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Atenção: projeto sendo marcado como 100% concluído</p>
                <p>Os seguintes componentes ainda não possuem desenho anexado:</p>
                <ul className="mt-1 ml-3 list-disc">
                  {itemsMissingDrawings.map(i => <li key={i.id}><span className="font-mono">{i.code}</span> — {i.description}</li>)}
                </ul>
                <p className="mt-1">É obrigatório anexar o desenho de todos os componentes antes de concluir.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUpdateOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => addUpdateMutation.mutate()}
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={
                addUpdateMutation.isPending || uploadingDrawing ||
                (updateForm.progress_percent === '100' && itemsMissingDrawings.length > 0)
              }
            >
              {(addUpdateMutation.isPending || uploadingDrawing) ? 'Salvando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}