import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, CheckCircle2, Clock, AlertCircle, FileText, Users, Image } from 'lucide-react';

const STATUS_CONFIG = {
  AGUARDADO: { color: 'bg-blue-100 text-blue-700', label: 'Aguardado', icon: Clock },
  FINALIZADO: { color: 'bg-green-100 text-green-700', label: 'Finalizado', icon: CheckCircle2 },
  AGUARDADO_CLIENTE: { color: 'bg-yellow-100 text-yellow-700', label: 'Aguardando Cliente', icon: AlertCircle },
  AGUARDADO_MODIFICACAO: { color: 'bg-orange-100 text-orange-700', label: 'Aguardando Modificação', icon: AlertCircle },
  AGUARDADO_ORCAMENTO: { color: 'bg-purple-100 text-purple-700', label: 'Aguardando Orçamento', icon: AlertCircle },
  EM_DESENVOLVIMENTO: { color: 'bg-indigo-100 text-indigo-700', label: 'Em Desenvolvimento', icon: Clock },
  CANCELADO: { color: 'bg-red-100 text-red-700', label: 'Cancelado', icon: AlertCircle }
};

export default function ProspectionProjectsDashboard({ projects }) {
  const stats = {
    total: projects.length,
    byStatus: Object.keys(STATUS_CONFIG).reduce((acc, status) => {
      acc[status] = projects.filter(p => p.status === status).length;
      return acc;
    }, {}),
    withPhotos: projects.filter(p => p.photos?.length > 0).length,
    withAttachments: projects.filter(p => p.attachments?.length > 0).length,
    uniqueSellers: new Set(projects.map(p => p.seller_id).filter(Boolean)).size,
    totalPhotos: projects.reduce((sum, p) => sum + (p.photos?.length || 0), 0),
    totalAttachments: projects.reduce((sum, p) => sum + (p.attachments?.length || 0), 0)
  };

  const kpis = [
    {
      label: 'Total de Projetos',
      value: stats.total,
      icon: Package,
      color: 'bg-indigo-100 text-indigo-700'
    },
    {
      label: 'Finalizados',
      value: stats.byStatus.FINALIZADO,
      icon: CheckCircle2,
      color: 'bg-green-100 text-green-700'
    },
    {
      label: 'Em Desenvolvimento',
      value: stats.byStatus.EM_DESENVOLVIMENTO,
      icon: Clock,
      color: 'bg-indigo-100 text-indigo-700'
    },
    {
      label: 'Aguardando Cliente',
      value: stats.byStatus.AGUARDADO_CLIENTE,
      icon: AlertCircle,
      color: 'bg-yellow-100 text-yellow-700'
    },
    {
      label: 'Com Fotos',
      value: stats.withPhotos,
      icon: Image,
      color: 'bg-purple-100 text-purple-700'
    },
    {
      label: 'Com Arquivos',
      value: stats.withAttachments,
      icon: FileText,
      color: 'bg-slate-100 text-slate-700'
    },
    {
      label: 'Vendedores',
      value: stats.uniqueSellers,
      icon: Users,
      color: 'bg-orange-100 text-orange-700'
    }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{kpi.label}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{kpi.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${kpi.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Status Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Distribuição por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {Object.entries(stats.byStatus).map(([statusKey, count]) => {
              const config = STATUS_CONFIG[statusKey];
              return (
                <div
                  key={statusKey}
                  className={`p-3 rounded-lg text-center ${config.color} transition-all`}
                >
                  <p className="text-xs font-medium">{config.label}</p>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}