import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';

const STATUS_CONFIG = {
  SINCRONIZADO: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700', label: 'Sincronizado' },
  PENDENTE: { icon: Clock, color: 'bg-amber-100 text-amber-700', label: 'Pendente' },
  ERRO: { icon: XCircle, color: 'bg-rose-100 text-rose-700', label: 'Erro' },
  CONFLITO: { icon: AlertCircle, color: 'bg-red-100 text-red-700', label: 'Conflito' },
};

export default function ERPSyncStatus({ status, message }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDENTE;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4" />
      <Badge className={config.color}>{config.label}</Badge>
      {message && <span className="text-xs text-slate-500 ml-2">{message}</span>}
    </div>
  );
}