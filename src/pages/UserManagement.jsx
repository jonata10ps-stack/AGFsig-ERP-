import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabaseAdmin } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Users, CheckCircle, XCircle, Clock, Search, Mail, Calendar,
  UserCheck, Shield, Settings, Ban, UserPlus, Building2, Key
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import moment from 'moment';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const AVAILABLE_MODULES = [
  { id: 'Cadastros', name: 'Cadastros', description: 'Produtos, Clientes, Vendedores, Armazéns, etc.' },
  { id: 'Vendas', name: 'Vendas', description: 'Pedidos e Separação' },
  { id: 'Estoque', name: 'Estoque', description: 'Solicitações, Recebimentos, Movimentações, Saldos' },
  { id: 'Producao', name: 'Produção', description: 'Solicitações, OPs, Roteiros, Recursos' },
  { id: 'PosVendas', name: 'Pós-Vendas', description: 'Solicitações de Serviço, OSs, Controle de Séries' },
  { id: 'Qualidade', name: 'Qualidade', description: 'Não Conformidades' },
  { id: 'Relatorios', name: 'Relatórios', description: 'Relatórios Gerais e de Estoque' },
  { id: 'Engenharia', name: 'Engenharia', description: 'Projetos, Componentes e Histórico de Componentes' },
  { id: 'GerenciamentoDados', name: 'Gerenciamento de Dados', description: 'Dados Gerais, Integração ERP, Consistência' },
];

// Converte texto JSON ou array para array de forma segura
const parseArr = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
};

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [actionDialog, setActionDialog] = useState(null);
  const [permissionsDialog, setPermissionsDialog] = useState(null);
  const [selectedModules, setSelectedModules] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [inviteDialog, setInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', modules: [], is_seller: false, company_ids: [] });
  const [resetPasswordDialog, setResetPasswordDialog] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-management'],
    queryFn: async () => {
      const allUsers = await base44.entities.User.list('-created_at');
      return allUsers;
    },
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-select'],
    queryFn: () => base44.entities.Company.filter({ active: true }),
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, status, modules, company_ids }) => {
      const updateData = {
        account_status: status,
        approved_at: status === 'APROVADO' ? new Date().toISOString() : null,
        approved_by: status === 'APROVADO' ? currentUser?.email : null,
      };
      if (modules !== undefined) {
        updateData.allowed_modules = JSON.stringify(modules);
      }
      if (company_ids !== undefined) {
        updateData.company_ids = JSON.stringify(company_ids);
      }
      await base44.entities.User.update(userId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-management'] });
      toast.success('Status do usuário atualizado!');
      setActionDialog(null);
      setPermissionsDialog(null);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar usuário: ' + error.message);
    },
  });
  
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }) => {
      // 1. Tenta via RPC (Mais seguro e funciona em produção)
      const { data, error: rpcError } = await base44.functions.invokeRpc('admin_reset_user_password', { 
        p_user_id: userId, 
        p_new_password: password 
      });

      if (!rpcError && data?.success) return data;
      if (!rpcError && data && !data.success) throw new Error(data.message || 'O banco de dados negou o acesso.');

      // 2. Fallback para supabaseAdmin (caso a função RPC não exista e a chave esteja disponível)
      if (supabaseAdmin) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password: password }
        );
        if (error) throw error;
        return { success: true };
      }
      
      throw new Error(rpcError?.message || 'Serviço de administração não configurado no banco de dados. Por favor, execute o SQL de ativação.');
    },
    onSuccess: () => {
      toast.success('Senha atualizada com sucesso!');
      setResetPasswordDialog(null);
      setNewPassword('');
    },
    onError: (error) => {
      console.error('Erro no reset:', error);
      // Extrai a mensagem de erro de forma mais agressiva
      const friendlyMsg = error.message || 'Erro desconhecido';
      toast.error(`Reset falhou: ${friendlyMsg}`, { duration: 8000 });
    }
  });

  const handleApprove = (user) => {
    setActionDialog({ type: 'approve', user });
  };

  const handleReject = (user) => {
    setActionDialog({ type: 'reject', user });
  };

  const confirmAction = () => {
    if (!actionDialog) return;
    
    const status = actionDialog.type === 'approve' ? 'APROVADO' : 'REJEITADO';
    updateUserMutation.mutate({
      userId: actionDialog.user.id,
      status,
    });
  };

  const openPermissionsDialog = (user) => {
    setPermissionsDialog(user);
    setSelectedModules(parseArr(user.allowed_modules));
    setSelectedCompanies(parseArr(user.company_ids));
  };

  const savePermissions = () => {
    if (!permissionsDialog) return;
    
    updateUserMutation.mutate({
      userId: permissionsDialog.id,
      status: permissionsDialog.account_status || 'PENDENTE',
      modules: selectedModules,
      company_ids: selectedCompanies,
    });
  };

  const toggleModule = (moduleId) => {
    setSelectedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(m => m !== moduleId)
        : [...prev, moduleId]
    );
  };

  const toggleUserActive = async (user) => {
    const newActiveStatus = !user.active;
    try {
      await base44.entities.User.update(user.id, { active: newActiveStatus });
      
      await base44.entities.AuditLog.create({
        entity_type: 'User',
        entity_id: user.id,
        action: newActiveStatus ? 'ATIVADO' : 'DESATIVADO',
        details: `Usuário ${user.full_name || user.email} foi ${newActiveStatus ? 'ativado' : 'desativado'}`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['users-management'] });
      toast.success(`Usuário ${newActiveStatus ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (error) {
      toast.error('Erro ao atualizar status: ' + error.message);
    }
  };

  const inviteMutation = useMutation({
    mutationFn: async () => {
      // 1. O envio automático de e-mail foi removido por segurança (exigia Service Role Key).
      // Agora o Admin pré-autoriza o e-mail no banco e o usuário se cadastra no site.
      console.log('Iniciando pré-autorização para:', inviteForm.email);

      // 2. Cria o registro na tabela User com as permissões definidas
      await base44.entities.User.create({
        email: inviteForm.email,
        full_name: inviteForm.full_name,
        allowed_modules: JSON.stringify(inviteForm.modules),
        company_ids: JSON.stringify(inviteForm.company_ids),
        is_seller: inviteForm.is_seller,
        account_status: 'PENDENTE',
        role: 'user',
        active: true,
      });

      // 3. Se for vendedor, cria o registro de vendedor também
      if (inviteForm.is_seller) {
        await base44.entities.Seller.create({
          code: inviteForm.email.split('@')[0].toUpperCase(),
          name: inviteForm.full_name,
          email: inviteForm.email,
          active: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-management'] });
      toast.success(`✉️ Usuário ${inviteForm.email} pré-autorizado! Peça para ele acessar o sistema e "Criar Conta" para ativar o acesso.`);
      setInviteDialog(false);
      setInviteForm({ email: '', full_name: '', modules: [], is_seller: false, company_ids: [] });
    },
    onError: (error) => {
      toast.error('Erro ao enviar convite: ' + error.message);
    },
  });

  const handleInvite = () => {
    if (!inviteForm.email || !inviteForm.full_name) {
      toast.error('Preencha e-mail e nome completo do usuário');
      return;
    }
    inviteMutation.mutate();
  };

  const toggleInviteModule = (moduleId) => {
    setInviteForm(prev => ({
      ...prev,
      modules: prev.modules.includes(moduleId)
        ? prev.modules.filter(m => m !== moduleId)
        : [...prev.modules, moduleId]
    }));
  };

  const filteredUsers = (users || []).filter(user => {
    const matchesSearch = 
      (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      filterStatus === 'all' || 
      (filterStatus === 'active' && user.active !== false) ||
      (filterStatus === 'inactive' && user.active === false) ||
      user.account_status === filterStatus ||
      (!user.account_status && filterStatus === 'PENDENTE');
    
    return matchesSearch && matchesStatus;
  });

  const pendingCount = users?.filter(u => !u.account_status || u.account_status === 'PENDENTE').length || 0;
  const approvedCount = users?.filter(u => u.account_status === 'APROVADO').length || 0;
  const rejectedCount = users?.filter(u => u.account_status === 'REJEITADO').length || 0;

  const getStatusBadge = (status) => {
    if (!status || status === 'PENDENTE') {
      return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
    if (status === 'APROVADO') {
      return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
    }
    if (status === 'REJEITADO') {
      return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
    }
  };

  const getRoleBadge = (role) => {
    if (role === 'admin') {
      return <Badge className="bg-indigo-100 text-indigo-700"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
    }
    return <Badge variant="outline">Usuário</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-slate-500">Total de Usuários</p>
              <p className="text-3xl font-bold text-slate-900">{users?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-slate-500">Pendentes</p>
              <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-slate-500">Aprovados</p>
              <p className="text-3xl font-bold text-emerald-600">{approvedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-slate-500">Rejeitados</p>
              <p className="text-3xl font-bold text-red-600">{rejectedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1 relative w-full sm:w-auto">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar por nome ou email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <Button onClick={() => setInviteDialog(true)} className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">
          <UserPlus className="h-4 w-4 mr-2" />
          Convidar Usuário
        </Button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {['all', 'PENDENTE', 'APROVADO', 'REJEITADO'].map(status => (
          <Button
            key={status}
            variant={filterStatus === status ? 'default' : 'outline'}
            onClick={() => setFilterStatus(status)}
            className={filterStatus === status ? 'bg-indigo-600' : ''}
          >
            {status === 'all' ? 'Todos' : status}
          </Button>
        ))}
      </div>

      {/* Users List */}
      <div className="space-y-4">
        {isLoading ? (
          <Card><CardContent className="text-center py-8">Carregando...</CardContent></Card>
        ) : filteredUsers?.length === 0 ? (
          <Card><CardContent className="text-center py-8 text-slate-500">Nenhum usuário encontrado</CardContent></Card>
        ) : (
          filteredUsers?.map(user => (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">{user.full_name}</h3>
                      {getRoleBadge(user.role)}
                      {getStatusBadge(user.account_status)}
                      {user.active === false && <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Inativo</Badge>}
                    </div>
                    <p className="text-sm text-slate-500 mb-2">{user.email}</p>
                    
                    {parseArr(user.company_ids).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {parseArr(user.company_ids).map(companyId => {
                          const company = companies.find(c => c.id === companyId);
                          return company ? <Badge key={companyId} variant="secondary">{company.code}</Badge> : null;
                        })}
                      </div>
                    )}
                    
                    {parseArr(user.allowed_modules).length > 0 && (
                      <div className="text-xs text-slate-500">
                        <p>Módulos: {parseArr(user.allowed_modules).join(', ')}</p>
                      </div>
                    )}
                    
                    {user.created_date && (
                      <p className="text-xs text-slate-500 mt-2">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        Criado em {moment(user.created_date).format('DD/MM/YYYY')}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                      onClick={() => openPermissionsDialog(user)}
                      variant="outline" 
                      size="sm"
                      className="flex-1 sm:flex-initial"
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Permissões
                    </Button>
                    
                    {!user.account_status || user.account_status === 'PENDENTE' ? (
                      <>
                        <Button 
                          onClick={() => handleApprove(user)}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 flex-1 sm:flex-initial"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aprovar
                        </Button>
                        <Button 
                          onClick={() => handleReject(user)}
                          size="sm"
                          variant="destructive"
                          className="flex-1 sm:flex-initial"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rejeitar
                        </Button>
                      </>
                    ) : null}
                    
                    <Button 
                      onClick={() => setResetPasswordDialog(user)}
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-initial text-amber-600 border-amber-200 hover:bg-amber-50"
                      title="Resetar Senha"
                    >
                      <Key className="h-4 w-4 mr-1" />
                      Senha
                    </Button>
                    
                    <Button 
                      onClick={() => toggleUserActive(user)}
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-initial"
                    >
                      {user.active === false ? <UserCheck className="h-4 w-4 mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
                      {user.active === false ? 'Ativar' : 'Desativar'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convidar Novo Usuário</DialogTitle>
            <DialogDescription>
              Convide um novo usuário para o sistema e configure suas permissões.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-900 block mb-2">Email *</label>
                <Input 
                  type="email"
                  placeholder="usuario@email.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-900 block mb-2">Nome Completo *</label>
                <Input 
                  placeholder="Nome do usuário"
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({...inviteForm, full_name: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-900 block mb-3">Empresas *</label>
              <div className="space-y-2">
                {companies.map(company => (
                  <div key={company.id} className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                    <Checkbox
                      id={`invite-company-${company.id}`}
                      checked={inviteForm.company_ids.includes(company.id)}
                      onCheckedChange={(checked) => {
                        setInviteForm(prev => ({
                          ...prev,
                          company_ids: checked 
                            ? [...prev.company_ids, company.id]
                            : prev.company_ids.filter(id => id !== company.id)
                        }));
                      }}
                    />
                    <label htmlFor={`invite-company-${company.id}`} className="text-sm font-medium text-slate-900 cursor-pointer flex-1">
                      {company.code} - {company.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-900 block mb-3">Módulos de Acesso</label>
              <div className="space-y-3">
                {AVAILABLE_MODULES.map((module) => (
                  <div key={module.id} className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                    <Checkbox
                      id={`invite-${module.id}`}
                      checked={inviteForm.modules.includes(module.id)}
                      onCheckedChange={() => toggleInviteModule(module.id)}
                    />
                    <div className="flex-1">
                      <label htmlFor={`invite-${module.id}`} className="text-sm font-medium text-slate-900 cursor-pointer">
                        {module.name}
                      </label>
                      <p className="text-xs text-slate-500">{module.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
              <Checkbox
                id="invite-is_seller"
                checked={inviteForm.is_seller}
                onCheckedChange={(checked) => setInviteForm({...inviteForm, is_seller: checked})}
              />
              <label htmlFor="invite-is_seller" className="text-sm font-medium text-slate-900 cursor-pointer flex-1">
                É Vendedor?
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} className="bg-indigo-600 hover:bg-indigo-700">
              <Mail className="h-4 w-4 mr-2" />
              Enviar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === 'approve' ? 'Aprovar Usuário' : 'Rejeitar Usuário'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-600">
            {actionDialog?.type === 'approve' 
              ? `Deseja aprovar o usuário ${actionDialog?.user?.full_name}?`
              : `Deseja rejeitar o usuário ${actionDialog?.user?.full_name}?`
            }
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={confirmAction}
              className={actionDialog?.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {actionDialog?.type === 'approve' ? 'Aprovar' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={!!permissionsDialog} onOpenChange={() => setPermissionsDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissões do Usuário</DialogTitle>
            <DialogDescription>
              {permissionsDialog?.full_name} ({permissionsDialog?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-slate-900 block mb-3">Empresas Associadas</label>
              <div className="space-y-2">
                {companies.map(company => (
                  <div key={company.id} className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                    <Checkbox
                      id={`perm-company-${company.id}`}
                      checked={selectedCompanies.includes(company.id)}
                      onCheckedChange={(checked) => {
                        setSelectedCompanies(prev =>
                          checked 
                            ? [...prev, company.id]
                            : prev.filter(id => id !== company.id)
                        );
                      }}
                    />
                    <label htmlFor={`perm-company-${company.id}`} className="text-sm font-medium text-slate-900 cursor-pointer flex-1">
                      {company.code} - {company.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-900 block mb-3">Módulos de Acesso</label>
              <div className="space-y-3">
                {AVAILABLE_MODULES.map((module) => (
                  <div key={module.id} className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                    <Checkbox
                      id={`perm-${module.id}`}
                      checked={selectedModules.includes(module.id)}
                      onCheckedChange={() => toggleModule(module.id)}
                    />
                    <div className="flex-1">
                      <label htmlFor={`perm-${module.id}`} className="text-sm font-medium text-slate-900 cursor-pointer">
                        {module.name}
                      </label>
                      <p className="text-xs text-slate-500">{module.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={savePermissions}>
              Salvar Permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordDialog} onOpenChange={() => setResetPasswordDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetar Senha Manualmente</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {resetPasswordDialog?.full_name || resetPasswordDialog?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nova Senha Provisória</label>
              <Input 
                type="text" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ex: AGF@123456"
              />
              <p className="text-[10px] text-slate-500">O usuário deverá usar esta senha para entrar. Avise-o após o reset.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialog(null)}>Cancelar</Button>
            <Button 
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                if (newPassword.length < 6) {
                  toast.error('A senha deve ter pelo menos 6 caracteres');
                  return;
                }
                resetPasswordMutation.mutate({ userId: resetPasswordDialog.id, password: newPassword });
              }}
              disabled={resetPasswordMutation.isLoading}
            >
              Confirmar Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}