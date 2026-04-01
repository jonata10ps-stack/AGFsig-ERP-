import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Search, X, Package, FileText, ExternalLink, Eye,
  History, AlertTriangle, Edit2, CheckCircle2, Clock,
  User, Calendar, ChevronDown, ChevronUp, GitBranch
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const FILE_TYPE_COLORS = {
  PDF: 'bg-red-100 text-red-700',
  DXF: 'bg-blue-100 text-blue-700',
  DWG: 'bg-amber-100 text-amber-700',
  OUTRO: 'bg-slate-100 text-slate-700',
};

const EVENT_TYPE_CONFIG = {
  created: { label: 'Criado', color: 'bg-emerald-100 text-emerald-700', icon: Package },
  drawing_added: { label: 'Desenho Adicionado', color: 'bg-blue-100 text-blue-700', icon: FileText },
  description_changed: { label: 'Descrição Alterada', color: 'bg-amber-100 text-amber-700', icon: Edit2 },
  obsoleted: { label: 'Tornado Obsoleto', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  project_update: { label: 'Atualização de Projeto', color: 'bg-indigo-100 text-indigo-700', icon: History },
};

function buildComponentTimeline(item, projectUpdates) {
  const events = [];

  // Creation event
  events.push({
    id: `created-${item.id}`,
    type: 'created',
    date: item.created_date,
    user: item.created_by || '—',
    description: `Componente criado: ${item.description}`,
    detail: `Código: ${item.code} | Qtd: ${item.quantity} ${item.unit}${item.material ? ` | Material: ${item.material}` : ''}`,
  });

  // Drawing events — each drawing has uploaded_at
  (item.drawings || []).forEach((d, idx) => {
    if (d.uploaded_at) {
      events.push({
        id: `drawing-${item.id}-${idx}`,
        type: 'drawing_added',
        date: d.uploaded_at,
        user: '—',
        description: `Desenho adicionado: ${d.name}`,
        detail: `Tipo: ${d.file_type} | Revisão: ${d.revision || idx + 1}`,
        drawingUrl: d.url,
        drawingFileType: d.file_type,
        drawingName: d.name,
      });
    }
  });

  // Obsolescence event
  if (item.obsolete && item.updated_date) {
    events.push({
      id: `obsolete-${item.id}`,
      type: 'obsoleted',
      date: item.updated_date,
      user: '—',
      description: 'Componente marcado como obsoleto',
      detail: item.obsolete_reason ? `Motivo: ${item.obsolete_reason}` : 'Sem motivo registrado',
    });
  }

  // Project update events that mention this component's code
  projectUpdates.forEach(u => {
    const content = (u.content || '').toLowerCase();
    const code = (item.code || '').toLowerCase();
    if (code && content.includes(`[${code}]`)) {
      events.push({
        id: `update-${u.id}`,
        type: 'project_update',
        date: u.created_date,
        user: u.author_name || u.author_email || '—',
        description: u.title,
        detail: u.content,
        updateType: u.type,
      });
    }
  });

  // Sort by date descending
  events.sort((a, b) => new Date(b.date) - new Date(a.date));
  return events;
}

function ComponentCard({ item, project, allUpdates, previewPdf }) {
  const [expanded, setExpanded] = useState(false);

  const projectUpdates = allUpdates.filter(u => u.project_id === item.project_id);
  const timeline = useMemo(() => buildComponentTimeline(item, projectUpdates), [item, projectUpdates]);

  const latestDrawing = (item.drawings || []).slice(-1)[0];

  return (
    <Card className={`transition-shadow hover:shadow-md ${item.obsolete ? 'border-red-200 bg-red-50/30' : ''}`}>
      <CardContent className="pt-4 pb-0">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`font-mono font-bold text-sm ${item.obsolete ? 'text-slate-400 line-through' : 'text-indigo-700'}`}>
                {item.code}
              </span>
              <span className={`font-medium ${item.obsolete ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                {item.description}
              </span>
              {item.obsolete && (
                <Badge className="bg-red-100 text-red-600 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />OBSOLETO
                </Badge>
              )}
              {item.material && !item.obsolete && (
                <Badge variant="outline" className="text-xs">{item.material}</Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                Qtd: {item.quantity} {item.unit}
              </span>
              {project && (
                <Link
                  to={createPageUrl(`EngineeringProjectDetail?id=${project.id}`)}
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                >
                  <GitBranch className="h-3 w-3" />
                  {project.name}
                </Link>
              )}
              <span className="flex items-center gap-1">
                <History className="h-3 w-3" />
                {timeline.length} evento{timeline.length !== 1 ? 's' : ''}
              </span>
              {latestDrawing && (
                <span className="flex items-center gap-1 text-slate-400">
                  <FileText className="h-3 w-3" />
                  Último desenho: {latestDrawing.name}
                </span>
              )}
            </div>

            {item.obsolete && item.obsolete_reason && (
              <p className="text-xs text-red-500 italic">Motivo obsolescência: {item.obsolete_reason}</p>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-slate-500 hover:text-indigo-600"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="ml-1 text-xs">{expanded ? 'Ocultar' : 'Ver histórico'}</span>
          </Button>
        </div>

        {/* Timeline */}
        {expanded && (
          <div className="mt-4 pb-4">
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                <History className="h-3 w-3" /> Linha do Tempo
              </p>
              {timeline.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhum evento registrado</p>
              ) : (
                <div className="relative space-y-0">
                  {timeline.map((event, idx) => {
                    const cfg = EVENT_TYPE_CONFIG[event.type] || EVENT_TYPE_CONFIG.project_update;
                    const Icon = cfg.icon;
                    const isLast = idx === timeline.length - 1;

                    return (
                      <div key={event.id} className="flex gap-3">
                        {/* Timeline line + dot */}
                        <div className="flex flex-col items-center">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${cfg.color}`}>
                            <Icon className="h-3 w-3" />
                          </div>
                          {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
                        </div>

                        {/* Content */}
                        <div className={`flex-1 ${isLast ? '' : 'pb-4'}`}>
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                                <span className="text-sm font-medium text-slate-800">{event.description}</span>
                              </div>
                              {event.detail && (
                                <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">{event.detail}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(event.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                                {event.user && event.user !== '—' && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {event.user}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Drawing preview button */}
                            {event.drawingUrl && (
                              <div className="shrink-0">
                                {event.drawingFileType === 'PDF' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => previewPdf(event.drawingUrl, event.drawingName)}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />Visualizar PDF
                                  </Button>
                                ) : (
                                  <a href={event.drawingUrl} target="_blank" rel="noreferrer">
                                    <Button size="sm" variant="outline" className="h-7 text-xs">
                                      <ExternalLink className="h-3 w-3 mr-1" />Abrir
                                    </Button>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EngineeringComponentHistory() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [filterObsolete, setFilterObsolete] = useState('all'); // 'all' | 'active' | 'obsolete'
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewName, setPreviewName] = useState('');

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['eng-all-items', companyId],
    queryFn: () => base44.entities.EngineeringProjectItem.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['engineering-projects', companyId],
    queryFn: () => base44.entities.EngineeringProject.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: allUpdates = [] } = useQuery({
    queryKey: ['eng-all-updates', companyId],
    queryFn: () => base44.entities.EngineeringProjectUpdate.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const projectMap = useMemo(() => {
    const m = {};
    projects.forEach(p => { m[p.id] = p; });
    return m;
  }, [projects]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      // text search
      if (search) {
        const q = search.toLowerCase();
        const match = item.code?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
        if (!match) return false;
      }
      // obsolete filter
      if (filterObsolete === 'active' && item.obsolete) return false;
      if (filterObsolete === 'obsolete' && !item.obsolete) return false;
      return true;
    });
  }, [items, search, filterObsolete]);

  const openPreview = (url, name) => {
    setPreviewUrl(url);
    setPreviewName(name);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <History className="h-8 w-8 text-indigo-600" />
          Histórico de Componentes
        </h1>
        <p className="text-slate-500 mt-1">
          Linha do tempo completa de modificações, desenhos e obsolescências por componente
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por código ou descrição..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'active', label: '✅ Ativos' },
            { value: 'obsolete', label: '🚫 Obsoletos' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterObsolete(opt.value)}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                filterObsolete === opt.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {!loadingItems && (
        <div className="flex gap-4 text-sm text-slate-500">
          <span>{filtered.length} componente{filtered.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{items.filter(i => i.obsolete).length} obsoleto{items.filter(i => i.obsolete).length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{items.filter(i => !i.obsolete).length} ativo{items.filter(i => !i.obsolete).length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* List */}
      {loadingItems ? (
        <p className="text-center text-slate-500 py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum componente encontrado</p>
          {search && <p className="text-sm mt-1">Tente buscar por outro código ou descrição</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <ComponentCard
              key={item.id}
              item={item}
              project={projectMap[item.project_id]}
              allUpdates={allUpdates}
              previewPdf={openPreview}
            />
          ))}
        </div>
      )}

      {/* PDF Preview */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-2 text-slate-800 font-medium">
                <FileText className="h-5 w-5 text-red-500" />
                {previewName}
              </div>
              <div className="flex gap-2">
                <a href={previewUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />Abrir em nova aba
                  </Button>
                </a>
                <Button variant="ghost" size="sm" onClick={() => setPreviewUrl(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-2">
              <iframe
                src={previewUrl}
                className="w-full h-[75vh] rounded border"
                title={previewName}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}