import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyId } from '@/components/useCompanyId';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Save, Calendar, MapPin, Clock, Car, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import ClientSearchSelect from '@/components/clients/ClientSearchSelect';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';

export default function ProspectionVisitForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const { user } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const visitId = urlParams.get('id');

  const [formData, setFormData] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    seller_id: null,
    start_time: null,
    end_time: null,
    client_id: null,
    client_name: '',
    prospective_client_name: '',
    city: '',
    state: '',
    is_company_vehicle: true,
    vehicle_km_start: 0,
    vehicle_km_end: 0,
    visit_type: 'PROSPECCAO',
    visit_report: '',
    interested_products: [],
    interested_products_names: '',
    proposal_sent: false,
    result: '',
    next_action: '',
    next_visit_date: null,
    status: 'PLANEJADA',
    notes: '',
  });

  const [selectedProducts, setSelectedProducts] = useState([]);

  const { data: allSellers = [] } = useQuery({
    queryKey: ['sellers', companyId],
    queryFn: () => companyId ? base44.entities.Seller.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  // Calculate access context
  const accessContext = useMemo(() => {
    if (!user || !allSellers) return { isAdmin: false, isManager: false, isSeller: false, managedSellerIds: [], currentSellerId: null };

    const isAdmin = user.role?.toLowerCase() === 'admin' || user.email?.toLowerCase() === 'jonata.santos@agfequipamentos.com.br';
    
    // Check if user is a seller (by email)
    const sellerRecord = allSellers.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
    const isSeller = !!sellerRecord;
    const currentSellerId = sellerRecord?.id || null;

    // Check if user is a manager (any seller has them in manager_ids)
    const managedSellers = allSellers.filter(s => {
        const managers = Array.isArray(s.manager_ids) ? s.manager_ids : [];
        return managers.includes(user.id);
    });
    const isManager = managedSellers.length > 0;
    const managedSellerIds = managedSellers.map(s => s.id);

    return { isAdmin, isManager, isSeller, managedSellerIds, currentSellerId };
  }, [user, allSellers]);

  const authorizedSellers = useMemo(() => {
    if (accessContext.isAdmin) return allSellers;
    if (accessContext.isManager) {
        const uniqueIds = new Set([...accessContext.managedSellerIds]);
        if (accessContext.currentSellerId) uniqueIds.add(accessContext.currentSellerId);
        return allSellers.filter(s => uniqueIds.has(s.id));
    }
    if (accessContext.isSeller) {
        return allSellers.filter(s => s.id === accessContext.currentSellerId);
    }
    return [];
  }, [allSellers, accessContext]);

  const sellers = authorizedSellers;

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ active: true }),
  });

  const { data: visit, isLoading: isVisitLoading } = useQuery({
    queryKey: ['prospection-visit', visitId],
    queryFn: async () => {
      const data = await base44.entities.ProspectionVisit.filter({ id: visitId });
      return data?.[0];
    },
    enabled: !!visitId,
  });

  useEffect(() => {
    if (visit && user && allSellers.length > 0) {
      // Check Access
      let hasAccess = accessContext.isAdmin;
      if (!hasAccess) {
        const visitSellerId = visit.seller_id;
        if (accessContext.isManager && accessContext.managedSellerIds.includes(visitSellerId)) hasAccess = true;
        else if (accessContext.isSeller && visitSellerId === accessContext.currentSellerId) hasAccess = true;
        else if (visit.created_by?.toLowerCase() === user?.email?.toLowerCase()) hasAccess = true;
      }

      if (!hasAccess) {
        toast.error('Você não tem permissão para editar esta visita');
        navigate(createPageUrl('SalesAppointments'));
        return;
      }

      setFormData(visit);
      setSelectedProducts(Array.isArray(visit.interested_products) ? visit.interested_products : []);
    }
  }, [visit, user, allSellers, accessContext, navigate]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const seller = sellers?.find(s => s.id === data.seller_id);
      const visitNumber = `V${Date.now()}`;
      
      if (!user?.company_id) {
        throw new Error('Empresa não identificada');
      }
      
      console.log('Criando visita com dados:', {
        ...data,
        company_id: user.company_id,
        visit_number: visitNumber,
        seller_name: seller?.name,
        interested_products: selectedProducts,
      });

      try {
        return await base44.entities.ProspectionVisit.create({
          ...data,
          company_id: user.company_id,
          visit_number: visitNumber,
          seller_name: seller?.name,
          interested_products: Array.isArray(selectedProducts) ? selectedProducts : [],
          interested_products_names: Array.isArray(selectedProducts) ? selectedProducts.map(id => 
            products?.find(p => p.id === id)?.name
          ).filter(Boolean).join(', ') : '',
        });
      } catch (err) {
        console.error('Erro detalhado da API Supabase:', err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospection-visits'] });
      toast.success('Visita criada');
      navigate(createPageUrl('SalesAppointments'));
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao criar visita');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const seller = sellers?.find(s => s.id === data.seller_id);
      
      return await base44.entities.ProspectionVisit.update(visitId, {
        ...data,
        seller_name: seller?.name,
        interested_products: Array.isArray(selectedProducts) ? selectedProducts : [],
        interested_products_names: Array.isArray(selectedProducts) ? selectedProducts.map(id => 
          products?.find(p => p.id === id)?.name
        ).filter(Boolean).join(', ') : '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospection-visits'] });
      queryClient.invalidateQueries({ queryKey: ['prospection-visit', visitId] });
      toast.success('Visita atualizada');
      navigate(createPageUrl('SalesAppointments'));
    },
  });

  useEffect(() => {
    if (user && sellers && !visitId) {
      const seller = sellers.find(s => s.email === user.email);
      if (seller) {
        setFormData(prev => ({ ...prev, seller_id: seller.id }));
      }
    }
  }, [user, sellers, visitId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validação
    if (!formData.seller_id) {
      toast.error('Selecione o vendedor');
      return;
    }
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
    
    if (visitId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const addProduct = (productId) => {
    if (productId && !selectedProducts.includes(productId)) {
      setSelectedProducts([...selectedProducts, productId]);
    }
  };

  const removeProduct = (productId) => {
    setSelectedProducts(selectedProducts.filter(id => id !== productId));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('SalesAppointments')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {visitId ? 'Editar Visita' : 'Nova Visita'}
          </h1>
          <p className="text-slate-500">Registro de visita de prospecção</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Vendedor</label>
                <Select
                  value={formData.seller_id || undefined}
                  onValueChange={(value) => setFormData({ ...formData, seller_id: value })}
                  required
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {sellers?.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Data da Visita</label>
                <Input
                  type="date"
                  value={formData.visit_date || ''}
                  onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Horário Início</label>
                <Input
                  type="time"
                  value={formData.start_time || ''}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value || null })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Horário Término</label>
                <Input
                  type="time"
                  value={formData.end_time || ''}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value || null })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Tipo de Visita</label>
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

            <div>
              <label className="text-sm font-medium">Status</label>
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Cliente e Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Cliente Cadastrado (Opcional)</label>
              <ClientSearchSelect
                value={formData.client_id || null}
                onSelect={(clientId, client) => {
                  setFormData({ 
                    ...formData, 
                    client_id: clientId || null, 
                    client_name: client?.name || '',
                    city: client?.city || formData.city,
                    state: client?.state || formData.state,
                    prospective_client_name: ''
                  });
                }}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Ou Cliente em Prospecção</label>
              <Input
                value={formData.prospective_client_name || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  prospective_client_name: e.target.value.toUpperCase(),
                  client_id: null,
                  client_name: ''
                })}
                placeholder="NOME DO CLIENTE POTENCIAL"
                className="mt-1 uppercase"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Cidade</label>
                <Input
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value.toUpperCase() })}
                  className="mt-1 uppercase"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Estado</label>
                <Input
                  value={formData.state || ''}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                  className="mt-1 uppercase"
                  maxLength={2}
                  placeholder="EX: SP"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Informações do Veículo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Nota:</strong> O registro de KM é feito uma vez por dia na página <strong>Registro de KM</strong>.
                Este campo indica apenas se você usou veículo da empresa nesta visita.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!formData.is_company_vehicle}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  is_company_vehicle: e.target.checked
                })}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Utilizou veículo da empresa nesta visita</label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Relatório da Visita
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Relatório Detalhado</label>
              <Textarea
                value={formData.visit_report || ''}
                onChange={(e) => setFormData({ ...formData, visit_report: e.target.value })}
                placeholder="Descreva como foi a visita, pontos discutidos, necessidades do cliente..."
                className="mt-1"
                rows={6}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Produtos de Interesse</label>
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.proposal_sent}
                onChange={(e) => setFormData({ ...formData, proposal_sent: e.target.checked })}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Proposta enviada</label>
            </div>

            <div>
              <label className="text-sm font-medium">Resultado da Visita</label>
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

            <div>
              <label className="text-sm font-medium">Próxima Ação</label>
              <Textarea
                value={formData.next_action || ''}
                onChange={(e) => setFormData({ ...formData, next_action: e.target.value })}
                placeholder="O que deve ser feito em seguida?"
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Data da Próxima Visita</label>
              <Input
                type="date"
                value={formData.next_visit_date || ''}
                onChange={(e) => setFormData({ ...formData, next_visit_date: e.target.value || null })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Observações Adicionais</label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Outras informações relevantes..."
                className="mt-1"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Link to={createPageUrl('SalesAppointments')}>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {visitId ? 'Atualizar' : 'Criar'} Visita
          </Button>
        </div>
      </form>
    </div>
  );
}