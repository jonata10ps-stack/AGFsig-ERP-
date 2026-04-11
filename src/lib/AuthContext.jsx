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
      
      // 1. O base44.auth.me() já busca o perfil, trata localStorage e retorna o usuário completo
      const currentUser = await base44.auth.me();
      
      const isAdminEmail = currentUser.email?.toLowerCase() === 'jonata.santos@agfequipamentos.com.br';

      // SEGURANÇA REFORÇADA: Só entra se estiver APROVADO
      // Exceção apenas para o e-mail do Jonata (Admin principal)
      if (!isAdminEmail && currentUser.account_status !== 'APROVADO') {
        throw new Error('PENDING_APPROVAL');
      }

      setUser(currentUser);
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
      
      // Sincroniza current_company_id também para evitar que componentes usem o valor antigo
      if (!updatedUser.current_company_id) {
        updatedUser.current_company_id = updatedUser.company_id;
      }
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