import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Search, FileText, ExternalLink, Package, Eye, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const FILE_TYPE_COLORS = {
  PDF: 'bg-red-100 text-red-700',
  DXF: 'bg-blue-100 text-blue-700',
  DWG: 'bg-amber-100 text-amber-700',
  OUTRO: 'bg-slate-100 text-slate-700',
};

export default function EngineeringComponents() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewName, setPreviewName] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['eng-all-items', companyId],
    queryFn: () => base44.entities.EngineeringProjectItem.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['engineering-projects', companyId],
    queryFn: () => base44.entities.EngineeringProject.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const filtered = items.filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.code?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.material?.toLowerCase().includes(q)
    );
  });

  const getProject = (projectId) => projects.find(p => p.id === projectId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Componentes</h1>
        <p className="text-slate-500 mt-1">Busque peças e componentes de todos os projetos</p>
      </div>

      {/* Search */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por código, descrição ou material..."
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

      {isLoading ? (
        <p className="text-center text-slate-500 py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{search ? 'Nenhum componente encontrado para esta busca' : 'Nenhum componente cadastrado'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{filtered.length} componente{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</p>
          {filtered.map(item => {
            const project = getProject(item.project_id);
            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`font-mono font-bold text-sm ${item.obsolete ? 'text-slate-400 line-through' : 'text-indigo-700'}`}>{item.code}</span>
                        <span className={`font-medium ${item.obsolete ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{item.description}</span>
                        {item.obsolete && <Badge className="bg-red-100 text-red-600 text-xs">OBSOLETO</Badge>}
                        {item.material && !item.obsolete && (
                          <Badge variant="outline" className="text-xs">{item.material}</Badge>
                        )}
                      </div>
                      {item.obsolete && item.obsolete_reason && (
                        <p className="text-xs text-red-400 italic">Motivo: {item.obsolete_reason}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Qtd: {item.quantity} {item.unit}</span>
                        {project && (
                          <Link
                            to={createPageUrl(`EngineeringProjectDetail?id=${project.id}`)}
                            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                          >
                            <Package className="h-3 w-3" />
                            Projeto: {project.name}
                          </Link>
                        )}
                      </div>

                      {/* Drawings */}
                      {Array.isArray(item.drawings) && item.drawings.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {item.drawings.map((d, idx) => {
                            const isLatest = idx === item.drawings.length - 1;
                            const isOld = !isLatest;
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (d.file_type === 'PDF') {
                                    setPreviewUrl(d.url);
                                    setPreviewName(d.name);
                                  } else {
                                    window.open(d.url, '_blank');
                                  }
                                }}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs transition-colors ${
                                  isOld
                                    ? 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-slate-100'
                                    : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700'
                                }`}
                                title={isOld ? 'Versão antiga' : 'Versão atual'}
                              >
                                <FileText className={`h-3 w-3 ${isOld ? 'opacity-50' : ''}`} />
                                <span className={`max-w-32 truncate ${isOld ? 'line-through opacity-60' : ''}`}>{d.name}</span>
                                <Badge className={`text-xs px-1 py-0 h-4 ${isOld ? 'bg-slate-100 text-slate-400' : FILE_TYPE_COLORS[d.file_type] || FILE_TYPE_COLORS.OUTRO}`}>
                                  {d.file_type}
                                </Badge>
                                {isOld
                                  ? <span className="text-xs text-slate-400 opacity-60">(antiga)</span>
                                  : d.file_type === 'PDF' ? <Eye className="h-3 w-3 opacity-50" /> : <ExternalLink className="h-3 w-3 opacity-50" />
                                }
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Sem desenhos anexados</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-500" />
              {previewName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-[70vh] rounded border"
                title={previewName}
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir em nova aba
              </Button>
            </a>
            <Button variant="outline" size="sm" onClick={() => setPreviewUrl(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}