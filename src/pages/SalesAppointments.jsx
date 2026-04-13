import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { useAuth } from '@/lib/AuthContext';
import { Plus, Calendar as CalendarIcon, MapPin, TrendingUp, Eye, X, Save, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ClientSearchSelect from '@/components/clients/ClientSearchSelect';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';

const statusColors = {
  PLANEJADA: 'bg-blue-100 text-blue-700',
  REALIZADA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-slate-100 text-slate-700',
};

const resultColors = {
  MUITO_POSITIVO: 'bg-emerald-100 text-emerald-700',
  POSITIVO: 'bg-green-100 text-green-700',
  NEUTRO: 'bg-slate-100 text-slate-700',
  NEGATIVO: 'bg-red-100 text-red-700',
};

export default function SalesAppointments() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sellerFilter, setSellerFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);

  // Fetch all sellers first to determine management/team
  const { data: allSellers = [] } = useQuery({
    queryKey: ['sellers', companyId],
    queryFn: () => companyId ? base44.entities.Seller.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  // Calculate access context
  const accessContext = useMemo(() => {
    if (!user || !allSellers) return { isAdmin: false, isManager: false, isSeller: false, managedSellerIds: [], currentSellerId: null, currentSeller: null };

    const isAdmin = user.role?.toLowerCase() === 'admin' || user.email?.toLowerCase() === 'jonata.santos@agfequipamentos.com.br';
    
    // Check if user is a seller (by email)
    const sellerRecord = allSellers.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
    const isSeller = !!sellerRecord;
    const currentSellerId = sellerRecord?.id || null;
    const currentSeller = sellerRecord || null;

    // Check if user is a manager (any seller has them in manager_ids)
    const managedSellers = allSellers.filter(s => {
        const managers = Array.isArray(s.manager_ids) ? s.manager_ids : [];
        return managers.includes(user.id);
    });
    const isManager = managedSellers.length > 0;
    const managedSellerIds = managedSellers.map(s => s.id);

    return { isAdmin, isManager, isSeller, managedSellerIds, currentSellerId, currentSeller };
  }, [user, allSellers]);

  const currentSeller = accessContext.currentSeller;

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['prospection-visits', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return base44.entities.ProspectionVisit.filter({ company_id: companyId }, '-visit_date');
    },
    enabled: !!companyId,
    refetchOnMount: 'always',
  });

  const [formData, setFormData] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    client_id: '',
    client_name: '',
    prospective_client_name: '',
    city: '',
    state: '',
    is_company_vehicle: true,
    visit_type: 'PROSPECCAO',
    visit_report: '',
    proposal_sent: false,
    result: '',
    next_action: '',
    next_visit_date: '',
    status: 'PLANEJADA',
    notes: '',
  });

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createSellerMutation = useMutation({
    mutationFn: async () => {
      const code = `V${Date.now()}`;
      return await base44.entities.Seller.create({
        company_id: companyId,
        code,
        name: user.full_name || user.email,
        email: user.email,
        active: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers', companyId] });
      toast.success('Vendedor cadastrado com sucesso!');
    },
  });

  // Verificar visitas próximas e criar notificações
  useEffect(() => {
    if (!user || !currentSeller || !visits || visits.length === 0) return;

    const checkUpcomingVisits = async () => {
      const now = new Date();
      
      for (const visit of visits) {
        if (visit.status !== 'PLANEJADA' || !visit.visit_date) continue;
        
        // Fix: Use T00:00:00 to avoid timezone shift
        const visitDateTime = new Date(`${visit.visit_date}T${visit.start_time || '00:00:00'}`);
        const minutesUntilVisit = (visitDateTime - now) / (1000 * 60);
        
        // Notificar 15 minutos antes
        if (minutesUntilVisit > 0 && minutesUntilVisit <= 15) {
          // Verificar se já não existe notificação
          const existing = await base44.entities.Notification.filter({
            user_email: user.email,
            related_visit_id: visit.id,
            type: 'VISITA_PROXIMA',
          });
          
          if (existing.length === 0) {
            await base44.entities.Notification.create({
              company_id: companyId,
              user_email: user.email,
              type: 'VISITA_PROXIMA',
              title: 'Visita em Breve',
              message: `Visita com ${visit.client_name || visit.prospective_client_name || 'cliente'} em ${Math.round(minutesUntilVisit)} minutos`,
              related_visit_id: visit.id,
            });
          }
        }
      }
    };

    checkUpcomingVisits();
    const interval = setInterval(checkUpcomingVisits, 60000); // Verificar a cada 1 minuto
    return () => clearInterval(interval);
  }, [visits, user, currentSeller, companyId]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const visitNumber = `V${Date.now()}`;
      
      return await base44.entities.ProspectionVisit.create({
        ...data,
        company_id: companyId,
        seller_id: currentSeller.id,
        seller_name: currentSeller.name,
        visit_number: visitNumber,
        interested_products: selectedProducts,
        interested_products_names: selectedProducts.map(id => 
          products?.find(p => p.id === id)?.name
        ).join(', '),
      });
    },
    onSuccess: async (savedVisit) => {
      toast.success(`✓ Visita salva: ${savedVisit.client_name || savedVisit.prospective_client_name}`);
      toast.info(`Vendedor: ${savedVisit.seller_name}, Data: ${savedVisit.visit_date}`);
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ['prospection-visits'] });
    },
    onError: (error) => {
      console.error('Erro ao criar visita:', error);
      toast.error(`Erro ao criar visita: ${error.message || 'Erro desconhecido'}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldVisit }) => {
      // Notificar gestores se foi cancelada ou reagendada
      if (currentSeller && oldVisit) {
        const sellers = await base44.entities.Seller.filter({ company_id: companyId });
        const seller = sellers.find(s => s.id === currentSeller.id);
        
        if (seller?.manager_ids?.length > 0) {
          const users = await base44.entities.User.list();
          
          // Se foi cancelada
          if (data.status === 'CANCELADA' && oldVisit.status !== 'CANCELADA') {
            for (const managerId of seller.manager_ids) {
              const manager = users.find(u => u.id === managerId);
              if (manager) {
                await base44.entities.Notification.create({
                  company_id: companyId,
                  user_email: manager.email,
                  type: 'VISITA_CANCELADA',
                  title: 'Visita Cancelada',
                  message: `${seller.name} cancelou visita com ${data.client_name || data.prospective_client_name || 'cliente'} em ${format(new Date(data.visit_date), 'dd/MM/yyyy', { locale: ptBR })}`,
                  related_visit_id: id,
                });
              }
            }
          }
          
          // Se foi reagendada
          if (data.visit_date !== oldVisit.visit_date) {
            for (const managerId of seller.manager_ids) {
              const manager = users.find(u => u.id === managerId);
              if (manager) {
                await base44.entities.Notification.create({
                  company_id: companyId,
                  user_email: manager.email,
                  type: 'VISITA_REAGENDADA',
                  title: 'Visita Reagendada',
                  message: `${seller.name} reagendou visita com ${data.client_name || data.prospective_client_name || 'cliente'} de ${format(new Date(oldVisit.visit_date), 'dd/MM/yyyy', { locale: ptBR })} para ${format(new Date(data.visit_date), 'dd/MM/yyyy', { locale: ptBR })}`,
                  related_visit_id: id,
                });
              }
            }
          }
        }
      }
      
      return await base44.entities.ProspectionVisit.update(id, {
        ...data,
        interested_products: selectedProducts,
        interested_products_names: selectedProducts.map(id => 
          products?.find(p => p.id === id)?.name
        ).join(', '),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prospection-visits'] });
      toast.success('Visita atualizada com sucesso');
      resetForm();
    },
    onError: (error) => {
      console.error('Erro ao atualizar visita:', error);
      toast.error(`Erro ao atualizar visita: ${error.message || 'Erro desconhecido'}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    toast.info('Formulário submetido');
    
    // Validação de campos obrigatórios básicos
    if (!formData.visit_date) {
      toast.error('Data da visita é obrigatória');
      return;
    }
    if (!formData.city) {
      toast.error('Cidade é obrigatória');
      return;
    }
    if (!formData.state) {
      toast.error('Estado é obrigatório');
      return;
    }
    if (!formData.client_id && !formData.prospective_client_name) {
      toast.error('Selecione um cliente ou informe o nome do cliente em prospecção');
      return;
    }

    // Validação adicional se status for REALIZADA
    if (formData.status === 'REALIZADA') {
      if (!formData.visit_report) {
        toast.error('Relatório da visita é obrigatório para visitas realizadas');
        return;
      }
      if (!formData.result) {
        toast.error('Resultado da visita é obrigatório para visitas realizadas');
        return;
      }
    }
    
    toast.success('Validação OK - Salvando...');
    
    if (editingVisit) {
      updateMutation.mutate({ id: editingVisit.id, data: formData, oldVisit: editingVisit });
    } else {
      createMutation.mutate(formData);
    }
  };

  const resetForm = () => {
    setFormData({
      visit_date: new Date().toISOString().split('T')[0],
      start_time: '',
      end_time: '',
      client_id: '',
      client_name: '',
      prospective_client_name: '',
      city: '',
      state: '',
      is_company_vehicle: true,
      visit_type: 'PROSPECCAO',
      visit_report: '',
      proposal_sent: false,
      result: '',
      next_action: '',
      next_visit_date: '',
      status: 'PLANEJADA',
      notes: '',
    });
    setSelectedProducts([]);
    setShowForm(false);
    setEditingVisit(null);
    setStatusFilter('all');
    setDateFilter('all');
    setSellerFilter('all');
    setSearch('');
  };

  const handleEdit = (visit) => {
    setFormData(visit);
    setSelectedProducts(Array.isArray(visit.interested_products) ? visit.interested_products : []);
    setEditingVisit(visit);
    setShowForm(true);
  };

  const addProduct = (productId) => {
    if (productId && !selectedProducts.includes(productId)) {
      setSelectedProducts([...selectedProducts, productId]);
    }
  };

  const removeProduct = (productId) => {
    setSelectedProducts(selectedProducts.filter(id => id !== productId));
  };

  const filteredVisits = visits.filter(visit => {
    // Access Control
    let hasAccess = accessContext.isAdmin;
    if (!hasAccess) {
      const visitSellerId = visit.seller_id;
      if (accessContext.isManager && accessContext.managedSellerIds.includes(visitSellerId)) hasAccess = true;
      else if (accessContext.isSeller && visitSellerId === accessContext.currentSellerId) hasAccess = true;
      else if (visit.created_by?.toLowerCase() === user?.email?.toLowerCase()) hasAccess = true;
    }
    
    if (!hasAccess) return false;

    const matchSearch = search === '' ||
      visit.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      visit.prospective_client_name?.toLowerCase().includes(search.toLowerCase()) ||
      visit.city?.toLowerCase().includes(search.toLowerCase());
    
    const matchStatus = statusFilter === 'all' || visit.status === statusFilter;

    let matchDate = true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Fix: Use T00:00:00 to avoid timezone shift
    const visitDateString = visit.visit_date?.includes('T') ? visit.visit_date : `${visit.visit_date}T12:00:00`;
    const visitDate = new Date(visitDateString);
    visitDate.setHours(0, 0, 0, 0);
    
    if (dateFilter === 'upcoming') {
      matchDate = visitDate >= today;
    } else if (dateFilter === 'past') {
      matchDate = visitDate < today;
    }
    
    const matchSeller = sellerFilter === 'all' || visit.seller_id === sellerFilter;

    return matchSearch && matchStatus && matchDate && matchSeller;
  });



  const stats = {
    total: filteredVisits?.length || 0,
    realizadas: filteredVisits?.filter(v => v.status === 'REALIZADA').length || 0,
    planejadas: filteredVisits?.filter(v => v.status === 'PLANEJADA').length || 0,
    comProposta: filteredVisits?.filter(v => v.proposal_sent).length || 0,
  };

  if (!user) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!currentSeller && user.role !== 'admin') {
    return (
      <div className="p-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 space-y-4 text-center">
            <TrendingUp className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-semibold text-amber-900">Configuração de Vendedor Necessária</h2>
            <p className="text-amber-800 max-w-md mx-auto">
              Para acessar a agenda de prospecção, você precisa estar vinculado a um cadastro de vendedor.
            </p>
            <Button 
              onClick={() => {
                // Pre-check if seller was already created in this session but not yet reflected in query
                if (allSellers.some(s => s.email?.toLowerCase() === user.email?.toLowerCase())) {
                   queryClient.invalidateQueries({ queryKey: ['sellers', companyId] });
                   return;
                }
                createSellerMutation.mutate();
              }}
              disabled={createSellerMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {createSellerMutation.isPending ? 'Criando Cadastro...' : 'Criar Meu Cadastro de Vendedor'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Minha Agenda de Prospecção</h1>
          <p className="text-slate-500">Visitas comerciais e relatórios</p>
        </div>
        {currentSeller && (
          <Button onClick={() => setShowForm(!showForm)} className="bg-indigo-600">
            {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {showForm ? 'Cancelar' : 'Nova Visita'}
          </Button>
        )}
      </div>

      {/* Formulário de Visita */}
      {showForm && (
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardHeader>
            <CardTitle>{editingVisit ? 'Editar Visita' : 'Nova Visita'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Data da Visita *</Label>
                  <Input
                    type="date"
                    value={formData.visit_date || ''}
                    onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label>Tipo de Visita</Label>
                  <Select
                    value={formData.visit_type || 'PROSPECCAO'}
                    onValueChange={(value) => setFormData({ ...formData, visit_type: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROSPECCAO">Prospecção</SelectItem>
                      <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
                      <SelectItem value="FECHAMENTO">Fechamento</SelectItem>
                      <SelectItem value="MANUTENCAO_CLIENTE">Manutenção Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Horário Início</Label>
                  <Input
                    type="time"
                    value={formData.start_time || ''}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Horário Término</Label>
                  <Input
                    type="time"
                    value={formData.end_time || ''}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Cliente Cadastrado *</Label>
                <ClientSearchSelect
                  value={formData.client_id || ''}
                  onSelect={(clientId, client) => {
                    setFormData({ 
                      ...formData, 
                      client_id: clientId || '', 
                      client_name: client?.name || '',
                      prospective_client_name: ''
                    });
                  }}
                />
                <p className="text-xs text-slate-500 mt-1">Ou preencha o campo abaixo</p>
              </div>

              <div>
                <Label>Ou Cliente em Prospecção *</Label>
                <Input
                  value={formData.prospective_client_name || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    prospective_client_name: e.target.value,
                    client_id: '',
                    client_name: ''
                  })}
                  placeholder="Nome do cliente potencial"
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">Um dos dois campos de cliente é obrigatório</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Cidade *</Label>
                  <Input
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label>Estado *</Label>
                  <Input
                    value={formData.state || ''}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="mt-1"
                    maxLength={2}
                    placeholder="Ex: SP"
                    required
                  />
                </div>
              </div>

              {/* Campos de feedback - só aparecem quando status é REALIZADA */}
              {formData.status === 'REALIZADA' && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-semibold text-slate-900 mb-4">Feedback da Visita</h3>
                  </div>

                  <div>
                    <Label>Relatório da Visita *</Label>
                    <Textarea
                      value={formData.visit_report || ''}
                      onChange={(e) => setFormData({ ...formData, visit_report: e.target.value })}
                      placeholder="Descreva como foi a visita, pontos discutidos, necessidades do cliente..."
                      className="mt-1"
                      rows={4}
                      required
                    />
                  </div>

                  <div>
                    <Label>Produtos de Interesse</Label>
                    <ProductSearchSelect
                      value=""
                      onChange={addProduct}
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Array.isArray(selectedProducts) && selectedProducts.map((productId) => {
                        const product = products?.find(p => p.id === productId);
                        return (
                          <div
                            key={productId}
                            className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm"
                          >
                            {product?.name}
                            <button
                              type="button"
                              onClick={() => removeProduct(productId)}
                              className="hover:text-indigo-900"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label>Resultado da Visita *</Label>
                    <Select
                      value={formData.result || ''}
                      onValueChange={(value) => setFormData({ ...formData, result: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o resultado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MUITO_POSITIVO">Muito Positivo</SelectItem>
                        <SelectItem value="POSITIVO">Positivo</SelectItem>
                        <SelectItem value="NEUTRO">Neutro</SelectItem>
                        <SelectItem value="NEGATIVO">Negativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!formData.proposal_sent}
                      onChange={(e) => setFormData({ ...formData, proposal_sent: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label>Proposta enviada</Label>
                  </div>

                  <div>
                    <Label>Próxima Ação</Label>
                    <Textarea
                      value={formData.next_action || ''}
                      onChange={(e) => setFormData({ ...formData, next_action: e.target.value })}
                      placeholder="O que deve ser feito em seguida?"
                      className="mt-1"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Data da Próxima Visita</Label>
                    <Input
                      type="date"
                      value={formData.next_visit_date || ''}
                      onChange={(e) => setFormData({ ...formData, next_visit_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              <div>
                <Label>Status da Visita</Label>
                <Select
                  value={formData.status || 'PLANEJADA'}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLANEJADA">Planejada</SelectItem>
                    <SelectItem value="REALIZADA">Realizada</SelectItem>
                    <SelectItem value="CANCELADA">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  {formData.status === 'PLANEJADA' && 'Agendamento futuro - preencha feedback depois'}
                  {formData.status === 'REALIZADA' && 'Visita concluída - preencha o feedback acima'}
                  {formData.status === 'CANCELADA' && 'Visita cancelada'}
                </p>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Outras informações relevantes..."
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingVisit ? 'Atualizar' : 'Criar'} Visita
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total de Visitas</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <CalendarIcon className="h-10 w-10 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Realizadas</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.realizadas}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Planejadas</p>
                <p className="text-2xl font-bold text-blue-600">{stats.planejadas}</p>
              </div>
              <CalendarIcon className="h-10 w-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Com Proposta</p>
                <p className="text-2xl font-bold text-amber-600">{stats.comProposta}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por cliente ou cidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="min-w-[150px]">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Próximas</SelectItem>
                  <SelectItem value="past">Anteriores</SelectItem>
                  <SelectItem value="all">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="PLANEJADA">Planejada</SelectItem>
                  <SelectItem value="REALIZADA">Realizada</SelectItem>
                  <SelectItem value="CANCELADA">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(accessContext.isAdmin || accessContext.isManager) && (
              <div className="min-w-[200px]">
                <Select value={sellerFilter} onValueChange={setSellerFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os Vendedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Vendedores</SelectItem>
                    {allSellers
                      .filter(s => accessContext.isAdmin || accessContext.managedSellerIds.includes(s.id))
                      .map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Visits List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredVisits.map((visit) => {
            const visitDate = new Date(visit.visit_date);
            const isPast = visitDate < new Date();

            return (
              <Card key={visit.id} className={isPast ? 'opacity-70' : ''}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">
                              {visit.client_name || visit.prospective_client_name}
                            </h3>
                            <Badge className={statusColors[visit.status]}>
                              {visit.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">
                            {visit.visit_type?.replace('_', ' ')}
                          </p>
                        </div>
                        {visit.result && (
                          <Badge className={resultColors[visit.result]}>
                            {visit.result.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          {format(visitDate, "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {visit.city}, {visit.state}
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">{visit.seller_name || 'Vendedor Desconhecido'}</span>
                        </div>
                        {visit.proposal_sent && (
                          <Badge className="bg-green-100 text-green-700">
                            Proposta Enviada
                          </Badge>
                        )}
                      </div>

                      {visit.visit_report && (
                        <div className="bg-slate-50 p-3 rounded-lg text-sm">
                          <strong>Relatório:</strong> {visit.visit_report.substring(0, 150)}{visit.visit_report.length > 150 && '...'}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(visit)}>
                        Editar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredVisits.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Nenhuma visita encontrada</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}