import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Package, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanyId } from '@/components/useCompanyId';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function StockStatusWidget() {
  const { companyId, loading: companyLoading } = useCompanyId();
  const { data: stockBalances, isLoading } = useQuery({
    queryKey: ['stock-status', companyId],
    queryFn: () => base44.entities.StockBalance.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { lowStock, totalItems, pieData } = useMemo(() => {
    const low = stockBalances?.filter(s => s.qty_available <= 0).length || 0;
    const total = stockBalances?.length || 0;
    const good = total - low;

    return {
      lowStock: low,
      totalItems: total,
      pieData: [
        { name: 'Em Estoque', value: good, color: '#10b981' },
        { name: 'Sem Estoque', value: low, color: '#f43f5e' }
      ]
    };
  }, [stockBalances]);

  if (isLoading || companyLoading) {
    return (
      <Card className="h-full border-none shadow-sm">
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent><Skeleton className="h-8 w-24" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-xl transition-all duration-300 border-none shadow-sm bg-white h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
           <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
              <Package className="h-4 w-4" />
           </div>
           <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
             Status de Estoque
           </CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="pt-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-2xl font-black text-slate-900 leading-none">{totalItems}</div>
            <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">Produtos totais</p>
            
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span className="text-rose-600 uppercase">{lowStock} críticos</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-600 uppercase">{totalItems - lowStock} saudáveis</span>
              </div>
            </div>
          </div>

          <div className="h-20 w-20">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={25}
                  outerRadius={35}
                  paddingAngle={5}
                  dataKey="value"
                  animationDuration={1500}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}