import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ProspectionProjectsDashboard from '@/components/ProspectionProjectsDashboard';
import ClientSearchSelect from '@/components/clients/ClientSearchSelect';
import {
  Plus, Search, Filter, MapPin, Image, Zap, Eye, Trash2, Edit,
  ArrowLeft, X, Clock, CheckCircle2, AlertCircle, Share2, FileText, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  AGUARDADO: { color: 'bg-blue-100 text-blue-700', label: 'Aguardado', icon: Clock },
  FINALIZADO: { color: 'bg-green-100 text-green-700', label: 'Finalizado', icon: CheckCircle2 },
  AGUARDADO_CLIENTE: { color: 'bg-yellow-100 text-yellow-700', label: 'Aguardando Cliente', icon: AlertCircle },
  AGUARDADO_MODIFICACAO: { color: 'bg-orange-100 text-orange-700', label: 'Aguardando Modificação', icon: AlertCircle },
  AGUARDADO_ORCAMENTO: { color: 'bg-purple-100 text-purple-700', label: 'Aguardando Orçamento', icon: AlertCircle },
  EM_DESENVOLVIMENTO: { color: 'bg-indigo-100 text-indigo-700', label: 'Em Desenvolvimento', icon: Clock },
  CANCELADO: { color: 'bg-red-100 text-red-700', label: 'Cancelado', icon: X }
};

const VOLTAGE_CONFIG = {
  MONOFASICO_220V: '220V Monofásico',
  TRIFASICO_220V: '220V Trifásico',
  TRIFASICO_380V: '380V Trifásico',
  TRIFASICO_440V: '440V Trifásico'
};

export default function ProspectionProjects() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formData, setFormData] = useState({
    project_name: '',
    client_id: '',
    client_name: '',
    description: '',
    status: 'AGUARDADO',
    voltage_type: '',
    location_address: '',
    location_latitude: '',
    location_longitude: '',
    city: '',
    state: '',
    notes: '',
    photos: [],
    attachments: [],
    seller_id: '',
    seller_name: ''
  });
  const [clientInputMode, setClientInputMode] = useState('select');

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['prospection-projects', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ProspectionProjectItem.filter({ company_id: companyId });
    },
    enabled: !!companyId,
    refetchInterval: 60000, // Atualizar a cada 60 segundos
  });


  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ['sellers', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.Seller.filter({ company_id: companyId, active: true });
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formData.project_name || (!formData.client_id && !formData.client_name)) {
        throw new Error('Preencha os campos obrigatórios: nome do projeto e cliente');
      }

      const data = {
        company_id: companyId,
        project_name: formData.project_name,
        client_id: formData.client_id,
        client_name: formData.client_name,
        description: formData.description,
        status: formData.status,
        voltage_type: formData.voltage_type,
        location_address: formData.location_address,
        location_latitude: formData.location_latitude ? parseFloat(formData.location_latitude) : null,
        location_longitude: formData.location_longitude ? parseFloat(formData.location_longitude) : null,
        location_url: formData.location_latitude && formData.location_longitude 
          ? `https://www.google.com/maps/?q=${formData.location_latitude},${formData.location_longitude}`
          : null,
        city: formData.city,
        state: formData.state,
        notes: formData.notes,
        photos: formData.photos,
        attachments: formData.attachments,
        seller_id: formData.seller_id || user?.id,
        seller_name: formData.seller_name || user?.full_name
      };

      if (editingProject) {
        // Notificar se status foi alterado
        if (editingProject.status !== formData.status && editingProject.seller_id) {
          const seller = await base44.entities.User.filter({ id: editingProject.seller_id });
          if (seller?.length > 0) {
            await base44.functions.invoke('notifyProjectChange', {
              project_id: editingProject.id,
              seller_id: editingProject.seller_id,
              seller_email: seller[0].email,
              change_type: 'status',
              message: `O projeto "${formData.project_name}" teve o status alterado para "${STATUS_CONFIG[formData.status]?.label}".`
            });
          }
        }
        return base44.entities.ProspectionProjectItem.update(editingProject.id, data);
      } else {
        return base44.entities.ProspectionProjectItem.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospection-projects', companyId] });
      toast.success(editingProject ? 'Projeto atualizado' : 'Projeto criado com sucesso');
      resetForm();
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao salvar projeto');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId) => base44.entities.ProspectionProjectItem.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospection-projects', companyId] });
      toast.success('Projeto deletado');
    },
    onError: () => {
      toast.error('Erro ao deletar projeto');
    }
  });

  const resetForm = () => {
    setFormData({
      project_name: '',
      client_id: '',
      client_name: '',
      description: '',
      status: 'AGUARDADO',
      voltage_type: '',
      location_address: '',
      location_latitude: '',
      location_longitude: '',
      city: '',
      state: '',
      notes: '',
      photos: [],
      attachments: [],
      seller_id: user?.id || '',
      seller_name: user?.full_name || ''
    });
    setEditingProject(null);
    setClientInputMode('select');
  };

  const handleOpenDialog = (project = null) => {
    if (project) {
      // Ensure photos and attachments are arrays
      const sanitizedProject = {
        ...project,
        photos: Array.isArray(project.photos) ? project.photos : [],
        attachments: Array.isArray(project.attachments) ? project.attachments : []
      };
      setEditingProject(sanitizedProject);
      setFormData(sanitizedProject);
      setClientInputMode(sanitizedProject.client_id ? 'select' : 'manual');
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleAddPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({
        ...prev,
        photos: [...(prev.photos || []), { url: file_url, uploaded_at: new Date().toISOString() }]
      }));
      toast.success('Foto adicionada');
    } catch (error) {
      toast.error('Erro ao upload da foto');
    }
  };

  const handleRemovePhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: (Array.isArray(prev.photos) ? prev.photos : []).filter((_, i) => i !== index)
    }));
  };

  const handleAddAttachment = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const description = prompt('Descrição do arquivo (opcional):') || '';

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const newAttachment = {
        url: file_url,
        name: file.name,
        description,
        uploaded_at: new Date().toISOString()
      };
      
      setFormData(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), newAttachment]
      }));

      // Notificar vendedor sobre arquivo anexado
      if (editingProject?.seller_id && editingProject?.seller_name) {
        const seller = await base44.entities.User.filter({ id: editingProject.seller_id });
        if (seller?.length > 0) {
          await base44.functions.invoke('notifyProjectChange', {
            project_id: editingProject.id,
            seller_id: editingProject.seller_id,
            seller_email: seller[0].email,
            change_type: 'attachment',
            message: `Novo arquivo "${file.name}" foi anexado ao projeto "${editingProject.project_name}".${description ? ` Descrição: ${description}` : ''}`
          });
        }
      }

      toast.success('Arquivo adicionado');
    } catch (error) {
      toast.error('Erro ao fazer upload do arquivo');
    }
  };

  const handleRemoveAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: (Array.isArray(prev.attachments) ? prev.attachments : []).filter((_, i) => i !== index)
    }));
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setFormData(prev => ({
            ...prev,
            location_latitude: latitude.toFixed(6),
            location_longitude: longitude.toFixed(6)
          }));
          toast.success('Localização obtida do GPS');
        },
        () => {
          toast.error('Não foi possível obter a localização');
        }
      );
    } else {
      toast.error('Geolocalização não suportada neste navegador');
    }
  };

  const handleSelectClient = (client) => {
    setFormData(prev => ({
      ...prev,
      client_id: client.id,
      client_name: client.name
    }));
  };

  const filtered = useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = project.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.client_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchTerm, statusFilter]);

  if (projectsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Projetos de Prospecção</h1>
          <p className="text-slate-600 mt-2">Controle de itens em desenvolvimento para clientes</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Projeto
        </Button>
      </div>

      {/* Dashboard */}
      <ProspectionProjectsDashboard projects={filtered} />

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por projeto ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Todos os Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Projects Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum projeto encontrado</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const config = STATUS_CONFIG[project.status];
            return (
              <Card key={project.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{project.project_name}</CardTitle>
                      <p className="text-sm text-slate-600 mt-1">{project.client_name}</p>
                    </div>
                    <Badge className={config.color}>{config.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Description */}
                  {project.description && (
                    <p className="text-sm text-slate-600 line-clamp-2">{project.description}</p>
                  )}

                  {/* Voltage */}
                  {project.voltage_type && (
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-slate-700">
                        {VOLTAGE_CONFIG[project.voltage_type]}
                      </span>
                    </div>
                  )}

                  {/* Location */}
                  {project.location_address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-red-600 mt-0.5" />
                      <div className="text-sm text-slate-600">
                        <p className="line-clamp-1">{project.location_address}</p>
                        {project.location_url && (
                          <a href={project.location_url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs">
                            Ver no Maps
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Photos Count */}
                  {project.photos?.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm text-slate-600">{project.photos.length} foto(s)</span>
                    </div>
                  )}

                  {/* Attachments Count */}
                  {project.attachments?.length > 0 && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-600" />
                      <span className="text-sm text-slate-600">{project.attachments.length} arquivo(s)</span>
                    </div>
                  )}

                  {/* City/State */}
                  {(project.city || project.state) && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="h-4 w-4" />
                      {project.city}{project.city && project.state && ', '}{project.state}
                    </div>
                  )}

                  {/* Seller */}
                  {project.seller_name && (
                    <div className="text-xs text-slate-500 pt-2 border-t">
                      <span>Vendedor: {project.seller_name}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(project)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (window.confirm('Deletar este projeto?')) {
                          deleteMutation.mutate(project.id);
                        }
                      }}
                      className="flex-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Deletar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProject ? 'Editar Projeto' : 'Novo Projeto de Prospecção'}
              </DialogTitle>
              <DialogDescription>
                {editingProject ? 'Atualize as informações do projeto selecionado.' : 'Preencha os dados abaixo para iniciar um novo projeto de prospecção.'}
              </DialogDescription>
            </DialogHeader>

          <div className="space-y-4">
            {/* Project Name */}
            <div>
              <label className="text-sm font-medium text-slate-700">Nome do Projeto *</label>
              <Input
                value={formData.project_name}
                onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                placeholder="Ex: Sistema de Climatização"
                className="mt-1"
              />
            </div>

            {/* Client */}
            <div>
              <label className="text-sm font-medium text-slate-700">Cliente</label>
              <div className="mt-1 space-y-2">
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    variant={clientInputMode === 'select' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setClientInputMode('select');
                      setFormData({ ...formData, client_id: '', client_name: '' });
                    }}
                  >
                    Selecionar
                  </Button>
                  <Button
                    type="button"
                    variant={clientInputMode === 'manual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setClientInputMode('manual');
                      setFormData({ ...formData, client_id: '', client_name: '' });
                    }}
                  >
                    Informar Manualmente
                  </Button>
                </div>

                {clientInputMode === 'select' ? (
                  <ClientSearchSelect
                    value={formData.client_id}
                    onSelect={(id, client) => {
                      if (!id || !client) {
                        setFormData(prev => ({ ...prev, client_id: '', client_name: '' }));
                        return;
                      }
                      handleSelectClient(client);
                    }}
                    placeholder="Selecione um cliente cadastrado"
                  />
                ) : (
                  <Input
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    placeholder="Nome do cliente"
                  />
                )}

                {formData.client_name && (
                  <div className="p-2 bg-blue-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium">{formData.client_name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, client_id: '', client_name: '' })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-slate-700">Descrição</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do projeto..."
                rows="3"
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Seller */}
            <div>
              <label className="text-sm font-medium text-slate-700">Vendedor Responsável</label>
              <Select value={formData.seller_id} onValueChange={(value) => {
                const seller = sellers.find(s => s.id === value);
                if (seller) {
                  setFormData({ ...formData, seller_id: seller.id, seller_name: seller.name });
                }
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map(seller => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <label className="text-sm font-medium text-slate-700">Status</label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Voltage */}
            <div>
              <label className="text-sm font-medium text-slate-700">Voltagem</label>
              <Select value={formData.voltage_type} onValueChange={(value) => setFormData({ ...formData, voltage_type: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a voltagem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONOFASICO_220V">220V Monofásico</SelectItem>
                  <SelectItem value="TRIFASICO_220V">220V Trifásico</SelectItem>
                  <SelectItem value="TRIFASICO_380V">380V Trifásico</SelectItem>
                  <SelectItem value="TRIFASICO_440V">440V Trifásico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div>
              <label className="text-sm font-medium text-slate-700">Endereço</label>
              <Input
                value={formData.location_address}
                onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                placeholder="Endereço completo"
                className="mt-1"
              />
            </div>

            {/* City/State */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Cidade</label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Ex: São Paulo"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Estado</label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="Ex: SP"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Latitude</label>
                <Input
                  type="number"
                  step="0.000001"
                  value={formData.location_latitude}
                  onChange={(e) => setFormData({ ...formData, location_latitude: e.target.value })}
                  placeholder="Ex: -23.5505"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Longitude</label>
                <Input
                  type="number"
                  step="0.000001"
                  value={formData.location_longitude}
                  onChange={(e) => setFormData({ ...formData, location_longitude: e.target.value })}
                  placeholder="Ex: -46.6333"
                  className="mt-1"
                />
              </div>
              <div className="flex flex-col justify-end">
                <Button 
                  type="button"
                  onClick={handleGetLocation}
                  variant="outline"
                  className="gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Usar GPS
                </Button>
              </div>
            </div>

            {/* Google Maps Link */}
            {formData.location_latitude && formData.location_longitude && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <a 
                  href={`https://www.google.com/maps/?q=${formData.location_latitude},${formData.location_longitude}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm font-medium flex items-center gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  Abrir localização no Google Maps
                </a>
              </div>
            )}

            {/* Photos */}
            <div>
              <label className="text-sm font-medium text-slate-700">Fotos do Projeto</label>
              <div className="mt-2 space-y-3">
                {Array.isArray(formData.photos) && formData.photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {formData.photos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img src={photo.url} alt="Project" className="w-full h-24 object-cover rounded-lg" />
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition">
                  <div className="text-center">
                    <Image className="h-6 w-6 mx-auto text-slate-400 mb-2" />
                    <span className="text-sm text-slate-600">Adicionar foto</span>
                  </div>
                  <input type="file" accept="image/*" onChange={handleAddPhoto} className="hidden" />
                </label>
              </div>
            </div>

            {/* Attachments */}
            <div>
              <label className="text-sm font-medium text-slate-700">Arquivos Anexados</label>
              <div className="mt-2 space-y-3">
                {Array.isArray(formData.attachments) && formData.attachments.length > 0 && (
                  <div className="space-y-2 bg-slate-50 rounded-lg p-3 border border-slate-200">
                    {formData.attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{attachment.name}</p>
                              {attachment.description && (
                                <p className="text-xs text-slate-500">{attachment.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAttachment(index)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition">
                  <div className="text-center">
                    <FileText className="h-6 w-6 mx-auto text-slate-400 mb-2" />
                    <span className="text-sm text-slate-600">Anexar arquivo</span>
                    <p className="text-xs text-slate-500 mt-1">PDF, DOC, XLS, etc.</p>
                  </div>
                  <input type="file" onChange={handleAddAttachment} className="hidden" />
                </label>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-slate-700">Observações</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionais..."
                rows="2"
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Salvando...' : (editingProject ? 'Atualizar' : 'Criar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}