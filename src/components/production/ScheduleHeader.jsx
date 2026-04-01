import React from 'react';
import { Calendar, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';

export default function ScheduleHeader({ alertCount = 0, opCount = 0, selectedCount = 0, lateCount = 0, inProgressCount = 0 }) {
  const stats = [
    { label: 'OPs no Cronograma', value: opCount, icon: Calendar, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    { label: 'Em Andamento', value: inProgressCount, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: 'Atrasadas', value: alertCount || lateCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    { label: 'Concluídas', value: selectedCount, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cronograma de Produção</h1>
        <p className="text-slate-500 text-sm mt-1">Gerencie e acompanhe todas as etapas de produção</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-9 w-9 rounded-lg bg-white flex items-center justify-center shadow-sm`}>
                <Icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                <p className={`text-xs font-medium ${s.color}`}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}