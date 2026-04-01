import { useAuth } from '@/lib/AuthContext';

// UUID padrão da empresa AGF — usado como fallback enquanto o multi-empresa não é configurado
const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

export function useCompanyId() {
  const { user, isLoadingAuth } = useAuth();

  const companyId = user?.company_id || user?.current_company_id || user?.company_ids?.[0] || DEFAULT_COMPANY_ID;

  return { companyId, loading: isLoadingAuth };
}