import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Edit2, ArrowLeft, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const REPORT_TYPES = {
  VENDAS_POR_VENDEDOR: 'Vendas por Vendedor',
  ITENS_MAIS_VENDIDOS: 'Itens Mais Vendidos',
  ORCAMENTOS_CONVERTIDOS: 'Orçamentos Convertidos',
  DESEMPENHO_POS_VENDAS: 'Desempenho Pós-Vendas',
  RECEITA_MENSAL: 'Receita Mensal',
  ANALISE_CUSTOMIZADA: 'Análise Customizada',
};

function TemplateForm({ template, onSave, onCancel, loading }) {
  const [form, setForm] = useState(template || {
    name: '',
    description: '',
    type: '',
    format: 'PDF',
    include_ai_insights: true,
    schedule_enabled: false,
    schedule_frequency: 'SEMANAL',
    schedule_time: '09:00',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.type) {
      toast.error('Nome e tipo são obrigatórios');
      return;
    }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do Relatório *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Vendas Semanais"
        />
      </div>

      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Descreva o propósito deste relatório"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Relatório *</Label>
          <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(REPORT_TYPES).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Formato</Label>
          <Select value={form.format} onValueChange={(value) => setForm({ ...form, format: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PDF">PDF</SelectItem>
              <SelectItem value="CSV">CSV</SelectItem>
              <SelectItem value="AMBOS">Ambos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="ai-insights"
            checked={form.include_ai_insights}
            onCheckedChange={(checked) => setForm({ ...form, include_ai_insights: checked })}
          />
          <Label htmlFor="ai-insights" className="cursor-pointer">
            Incluir análise de IA e insights automáticos
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="schedule"
            checked={form.schedule_enabled}
            onCheckedChange={(checked) => setForm({ ...form, schedule_enabled: checked })}
          />
          <Label htmlFor="schedule" className="cursor-pointer">
            Gerar automaticamente em horário específico
          </Label>
        </div>
      </div>

      {form.schedule_enabled && (
        <div className="grid grid-cols-3 gap-4 p-3 bg-slate-50 rounded-lg">
          <div className="space-y-2">
            <Label className="text-sm">Frequência</Label>
            <Select value={form.schedule_frequency} onValueChange={(value) => setForm({ ...form, schedule_frequency: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DIARIA">Diária</SelectItem>
                <SelectItem value="SEMANAL">Semanal</SelectItem>
                <SelectItem value="MENSAL">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.schedule_frequency === 'SEMANAL' && (
            <div className="space-y-2">
              <Label className="text-sm">Dia da Semana</Label>
              <Select value={form.schedule_day_of_week?.toString() || '1'} onValueChange={(value) => setForm({ ...form, schedule_day_of_week: parseInt(value) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Domingo</SelectItem>
                  <SelectItem value="1">Segunda</SelectItem>
                  <SelectItem value="2">Terça</SelectItem>
                  <SelectItem value="3">Quarta</SelectItem>
                  <SelectItem value="4">Quinta</SelectItem>
                  <SelectItem value="5">Sexta</SelectItem>
                  <SelectItem value="6">Sábado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm">Hora</Label>
            <Input
              type="time"
              value={form.schedule_time}
              onChange={(e) => setForm({ ...form, schedule_time: e.target.value })}
            />
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : template ? 'Atualizar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function ReportTemplates() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['report-templates', companyId],
    queryFn: () => companyId ? base44.entities.ReportTemplate.filter({ company_id: companyId }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ReportTemplate.create({
      company_id: companyId,
      ...data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates', companyId] });
      setDialogOpen(false);
      toast.success('Template criado');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ReportTemplate.update(editingTemplate.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates', companyId] });
      setDialogOpen(false);
      setEditingTemplate(null);
      toast.success('Template atualizado');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ReportTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates', companyId] });
      toast.success('Template removido');
    },
  });

  const handleSave = (data) => {
    if (editingTemplate) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleOpenDialog = (template = null) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Templates de Relatórios</h1>
          <p className="text-slate-500 mt-1">Configure tipos de relatórios para gerar automaticamente</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-indigo-600">
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {templates?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-slate-500 mb-4">Nenhum template de relatório criado</p>
            <Button onClick={() => handleOpenDialog()} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">{template.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(template)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(template.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Tipo</p>
                    <p className="font-medium">{REPORT_TYPES[template.type]}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Formato</p>
                    <p className="font-medium">{template.format}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">IA Insights</p>
                    <Badge className={template.include_ai_insights ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                      {template.include_ai_insights ? 'Sim' : 'Não'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-slate-500">Agendamento</p>
                    <Badge className={template.schedule_enabled ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}>
                      {template.schedule_enabled ? `${template.schedule_frequency}` : 'Manual'}
                    </Badge>
                  </div>
                </div>
                <div className="mt-4">
                  <Link to={createPageUrl(`ReportGenerator?template_id=${template.id}`)}>
                    <Button className="w-full">Gerar Relatório</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Template' : 'Novo Template de Relatório'}
            </DialogTitle>
          </DialogHeader>
          <TemplateForm
            template={editingTemplate}
            onSave={handleSave}
            onCancel={() => {
              setDialogOpen(false);
              setEditingTemplate(null);
            }}
            loading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}