import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'local', public_settings: {} });

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    // Modo standalone com Supabase: ignora verificação do Base44 e carrega usuário diretamente
    await checkUserAuth();
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      
      // 1. Autenticação básica
      const currentUser = await base44.auth.me();
      
      // 2. Buscar perfil expandido na entidade User para checar aprovação
      const profiles = await base44.entities.User.filter({ email: currentUser.email });
      const userProfile = profiles?.[0];
      
      const isAdminEmail = currentUser.email.toLowerCase() === 'jonata.santos@agfequipamentos.com.br';

      // SEGURANÇA REFORÇADA: Só entra se estiver APROVADO
      // Exceção apenas para o e-mail do Jonata (Admin principal)
      if (!isAdminEmail && (!userProfile || userProfile.account_status !== 'APROVADO')) {
        throw new Error('PENDING_APPROVAL');
      }

      const fullUser = { ...currentUser, ...userProfile };
      
      // PERSISTÊNCIA: Recuperar última empresa selecionada do localStorage
      const storedCompanyId = localStorage.getItem('selectedCompanyId');
      if (storedCompanyId) {
        // Verifica se o usuário ainda tem acesso a essa empresa antes de aplicar
        const hasAccess = fullUser.company_ids?.includes(storedCompanyId) || fullUser.company_id === storedCompanyId;
        if (hasAccess) {
          fullUser.company_id = storedCompanyId;
        }
      }

      setUser(fullUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Usuário não autenticado ou pendente:', error.message);
      setIsAuthenticated(false);
      
      if (error.message === 'PENDING_APPROVAL') {
        setAuthError({
          type: 'approval_pending',
          message: 'Sua conta está aguardando aprovação de um administrador.'
        });
      } else {
        setAuthError({
          type: 'auth_required',
          message: error.message || 'Erro não monitorado'
        });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = () => {
    setIsLoadingAuth(true);
    base44.auth.logout();
  };

  const navigateToLogin = () => {
    // Agora o roteamento é tratado pelo React Router no App.jsx 
    // com base no !isAuthenticated
  };

  const updateUser = (updatedUser) => {
    // PERSISTÊNCIA: Se a empresa mudou, salvar no localStorage
    if (updatedUser.company_id) {
      localStorage.setItem('selectedCompanyId', updatedUser.company_id);
    }
    setUser(prev => ({ ...prev, ...updatedUser }));
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};