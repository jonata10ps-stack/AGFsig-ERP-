import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function CompanySelector() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const userCompanyId = user?.company_id || '';

  const { data: allCompanies = [] } = useQuery({
    queryKey: ['companies-selector'],
    queryFn: () => base44.entities.Company.filter({ active: true }),
  });

  if (!user) return null;

  // Filtrar apenas empresas que o usuário tem acesso
  const companies = user.company_ids && user.company_ids.length > 0 
    ? allCompanies.filter(c => user.company_ids.includes(c.id))
    : allCompanies;

  const currentCompany = companies.find(c => c.id === userCompanyId);

  const handleCompanyChange = async (companyId) => {
    try {
      setLoading(true);
      await base44.auth.updateMe({ company_id: companyId });
      updateUser({ company_id: companyId });
      // Remove todo o cache para forçar re-fetch com o novo companyId após o re-render
      queryClient.removeQueries();
      toast.success('Empresa alterada com sucesso');
    } catch (e) {
      toast.error('Erro ao trocar empresa');
      console.error('Erro ao trocar empresa:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Building2 className="h-4 w-4 text-indigo-600" />
          <div className="flex flex-col items-start">
            <span className="text-xs text-slate-500">Empresa</span>
            <span className="text-sm font-semibold text-slate-900">
              {currentCompany?.name || currentCompany?.code || 'AGF'}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50">
          EMPRESAS DISPONÍVEIS
        </div>
        <DropdownMenuSeparator />
        {companies.length === 0 ? (
          <div className="px-3 py-4 text-sm text-slate-500 text-center">Nenhuma empresa disponível</div>
        ) : (
          companies.map(company => (
            <DropdownMenuItem
              key={company.id}
              onClick={() => handleCompanyChange(company.id)}
              disabled={loading}
              className="cursor-pointer flex justify-between items-center py-2.5"
            >
              <div className="flex-1">
                <div className="font-semibold text-sm">{company.code}</div>
                <div className="text-xs text-slate-500">{company.name}</div>
              </div>
              {userCompanyId === company.id && (
                <div className="h-2 w-2 rounded-full bg-indigo-600 flex-shrink-0 ml-2" />
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}