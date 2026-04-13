import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

const MONTHS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' }
];

export default function SellerGoalsManagement() {
  const { companyId } = useCompanyId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedSeller, setSelectedSeller] = useState('');
  
  const [formData, setFormData] = useState({});

  const { data: sellers = [] } = useQuery({
    queryKey: ['authorized-sellers-goals', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const allSellers = await base44.entities.Seller.filter({ company_id: companyId, active: true });
      const isAdmin = user?.role?.toLowerCase() === 'admin';
      if (isAdmin) return allSellers;
      // If manager, only their managed sellers
      return allSellers.filter(s => Array.isArray(s.manager_ids) && s.manager_ids.includes(user?.id));
    },
    enabled: !!companyId && !!user,
  });

  const { data: performances, isLoading } = useQuery({
    queryKey: ['seller-performance', companyId, selectedSeller, selectedYear],
    queryFn: () => companyId && selectedSeller ? 
      base44.entities.SellerMonthlyPerformance.filter({ company_id: companyId, seller_id: selectedSeller, year: selectedYear }) : 
      Promise.resolve([]),
    enabled: !!companyId && !!selectedSeller,
  });

  useEffect(() => {
    if (performances) {
      const formatted = {};
      MONTHS.forEach(m => {
        const p = performances.find(x => x.month === m.value) || {};
        formatted[m.value] = {
          id: p.id || null,
          monthly_goal: p.monthly_goal || 0,
          actual_revenue: p.actual_revenue || 0,
          monthly_cost: p.monthly_cost || 0
        };
      });
      setFormData(formatted);
    }
  }, [performances, selectedSeller, selectedYear]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises = Object.keys(formData).map(monthValue => {
        const data = formData[monthValue];
        if (data.id) {
          return base44.entities.SellerMonthlyPerformance.update(data.id, {
            company_id: companyId,
            seller_id: selectedSeller,
            year: selectedYear,
            month: monthValue,
            monthly_goal: Number(data.monthly_goal) || 0,
            actual_revenue: Number(data.actual_revenue) || 0,
            monthly_cost: Number(data.monthly_cost) || 0
          });
        } else {
          return base44.entities.SellerMonthlyPerformance.create({
            company_id: companyId,
            seller_id: selectedSeller,
            year: selectedYear,
            month: monthValue,
            monthly_goal: Number(data.monthly_goal) || 0,
            actual_revenue: Number(data.actual_revenue) || 0,
            monthly_cost: Number(data.monthly_cost) || 0
          });
        }
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['seller-performance']);
      toast.success('Metas salvas com sucesso!');
    },
    onError: (err) => {
      toast.error('Erro ao salvar metas: ' + err.message);
    }
  });

  const handleInputChange = (month, field, value) => {
    setFormData(prev => ({
      ...prev,
      [month]: {
        ...prev[month],
        [field]: value
      }
    }));
  };

  const years = [2025, 2026, 2027, 2028, 2029];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-white/20 shadow-sm mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-primary tracking-tight">Gestão de Metas e Resultados</h1>
          <p className="text-slate-500 mt-1 font-medium italic text-sm">Alimente os custos, metas e faturamento da equipe referencial</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Filtro de Referência</CardTitle>
          <Button onClick={() => saveMutation.mutate()} disabled={!selectedSeller || saveMutation.isLoading} className="bg-emerald-600 hover:bg-emerald-700">
            {saveMutation.isLoading ? 'Salvando...' : 'Salvar Tabela'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Select value={selectedSeller} onValueChange={setSelectedSeller}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Selecione o Vendedor" />
              </SelectTrigger>
              <SelectContent>
                {sellers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedSeller ? (
            <div className="text-center py-10 text-slate-500">
              Selecione um vendedor para alimentar os dados.
            </div>
          ) : isLoading ? (
            <div className="text-center py-10">Carregando dados...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Meta Faturamento (R$)</TableHead>
                  <TableHead>Faturamento Realizado (R$)</TableHead>
                  <TableHead>Custo Mensal (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MONTHS.map((m) => (
                  <TableRow key={m.value}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={formData[m.value]?.monthly_goal || ''} 
                        onChange={(e) => handleInputChange(m.value, 'monthly_goal', e.target.value)}
                        placeholder="Ex: 50000"
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={formData[m.value]?.actual_revenue || ''} 
                        onChange={(e) => handleInputChange(m.value, 'actual_revenue', e.target.value)}
                        placeholder="Ex: 45000"
                        className="w-32 text-emerald-700 font-medium"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={formData[m.value]?.monthly_cost || ''} 
                        onChange={(e) => handleInputChange(m.value, 'monthly_cost', e.target.value)}
                        placeholder="Ex: 8000"
                        className="w-32 text-amber-700"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
