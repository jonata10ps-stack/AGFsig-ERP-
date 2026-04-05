import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Edit, Calendar, MapPin, Clock, Car, FileText, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusColors = {
  PLANEJADA: 'bg-blue-100 text-blue-700',
  REALIZADA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-slate-100 text-slate-700',
};

const resultColors = {
  MUITO_POSITIVO: 'bg-emerald-100 text-emerald-700',
  POSITIVO: 'bg-green-100 text-green-700',
  NEUTRO: 'bg-slate-100 text-slate-700',
  NEGATIVO: 'bg-red-100 text-red-700',
};

export default function ProspectionVisitDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const visitId = urlParams.get('id');

  const { data: visit, isLoading } = useQuery({
    queryKey: ['prospection-visit', visitId],
    queryFn: async () => {
      const data = await base44.entities.ProspectionVisit.filter({ id: visitId });
      return data?.[0];
    },
    enabled: !!visitId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Visita não encontrada</p>
        <Link to={createPageUrl('ProspectionVisits')}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const kmPercorridos = visit.vehicle_km_end - visit.vehicle_km_start;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('ProspectionVisits')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Visita {visit.visit_number}</h1>
            <div className="flex gap-2 mt-1">
              <Badge className={statusColors[visit.status]}>{visit.status}</Badge>
              {visit.result && (
                <Badge className={resultColors[visit.result]}>
                  {visit.result.replace('_', ' ')}
                </Badge>
              )}
              <Badge variant="outline">{visit.visit_type?.replace('_', ' ')}</Badge>
            </div>
          </div>
        </div>
        <Link to={createPageUrl('ProspectionVisitForm') + '?id=' + visit.id}>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Informações da Visita
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Data da Visita</p>
                <p className="font-medium">
                  {format(new Date(visit.visit_date), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Vendedor</p>
                <p className="font-medium">{visit.seller_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Horário</p>
                <p className="font-medium">
                  {visit.start_time || '-'} {visit.end_time ? `até ${visit.end_time}` : ''}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Cliente</p>
                <p className="font-medium">{visit.client_name || visit.prospective_client_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Localização</p>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <p className="font-medium">{visit.city}, {visit.state}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Proposta Enviada</p>
                <Badge className={visit.proposal_sent ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
                  {visit.proposal_sent ? 'Sim' : 'Não'}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">KM Inicial</p>
                <p className="font-medium">{Number(visit.vehicle_km_start || 0).toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">KM Final</p>
                <p className="font-medium">{Number(visit.vehicle_km_end || 0).toFixed(1)}</p>
              </div>
            </div>
            {kmPercorridos > 0 && (
              <div className="bg-indigo-50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-indigo-600" />
                  <div>
                    <p className="text-sm text-slate-500">Distância Percorrida</p>
                    <p className="text-lg font-bold text-indigo-600">{Number(kmPercorridos || 0).toFixed(1)} km</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Próximos Passos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {visit.next_action && (
              <div>
                <p className="text-sm text-slate-500 mb-1">Próxima Ação</p>
                <p className="text-sm">{visit.next_action}</p>
              </div>
            )}
            {visit.next_visit_date && (
              <div>
                <p className="text-sm text-slate-500 mb-1">Próxima Visita</p>
                <p className="font-medium">
                  {format(new Date(visit.next_visit_date), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            )}
            {!visit.next_action && !visit.next_visit_date && (
              <p className="text-sm text-slate-400">Nenhuma ação definida</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatório da Visita
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {visit.visit_report ? (
            <p className="text-sm whitespace-pre-wrap">{visit.visit_report}</p>
          ) : (
            <p className="text-sm text-slate-400">Nenhum relatório registrado</p>
          )}

          {visit.interested_products_names && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Produtos de Interesse</p>
                <p className="text-sm">{visit.interested_products_names}</p>
              </div>
            </>
          )}

          {visit.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Observações</p>
                <p className="text-sm text-slate-600">{visit.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}