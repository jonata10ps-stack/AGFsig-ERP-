import { useAuth } from '@/lib/AuthContext';

export function useCompanyId() {
  const { user, isLoadingAuth } = useAuth();

  const companyId = user?.company_id || user?.current_company_id || user?.company_ids?.[0] || null;

  return { companyId, loading: isLoadingAuth };
}