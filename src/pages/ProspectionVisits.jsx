import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, Search, Calendar, MapPin, TrendingUp, Filter, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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

export default function ProspectionVisits() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');

  const { data: visits, isLoading } = useQuery({
    queryKey: ['prospection-visits', companyId],
    queryFn: () => companyId ? base44.entities.ProspectionVisit.filter({ company_id: companyId }, '-visit_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const filteredVisits = visits?.filter(visit => {
    const matchSearch = search === '' ||
      visit.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      visit.prospective_client_name?.toLowerCase().includes(search.toLowerCase()) ||
      visit.city?.toLowerCase().includes(search.toLowerCase()) ||
      visit.seller_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchStatus = statusFilter === 'all' || visit.status === statusFilter;
    const matchResult = resultFilter === 'all' || visit.result === resultFilter;

    // Se não é admin, mostrar apenas suas visitas
    const matchUser = user?.role === 'admin' || visit.created_by === user?.email;

    return matchSearch && matchStatus && matchResult && matchUser;
  });

  // Estatísticas rápidas
  const stats = {
    total: filteredVisits?.length || 0,
    realizadas: filteredVisits?.filter(v => v.status === 'REALIZADA').length || 0,
    planejadas: filteredVisits?.filter(v => v.status === 'PLANEJADA').length || 0,
    comProposta: filteredVisits?.filter(v => v.proposal_sent).length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Prospecção de Vendas</h1>
          <p className="text-slate-500">Registro e acompanhamento de visitas</p>
        </div>
        <Link to={createPageUrl('ProspectionVisitForm')}>
          <Button className="bg-indigo-600">
            <Plus className="h-4 w-4 mr-2" />
            Nova Visita
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total de Visitas</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <Calendar className="h-10 w-10 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Realizadas</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.realizadas}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Planejadas</p>
                <p className="text-2xl font-bold text-blue-600">{stats.planejadas}</p>
              </div>
              <Calendar className="h-10 w-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Com Proposta</p>
                <p className="text-2xl font-bold text-amber-600">{stats.comProposta}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente, cidade ou vendedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="PLANEJADA">Planejada</SelectItem>
                <SelectItem value="REALIZADA">Realizada</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Resultado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Resultados</SelectItem>
                <SelectItem value="MUITO_POSITIVO">Muito Positivo</SelectItem>
                <SelectItem value="POSITIVO">Positivo</SelectItem>
                <SelectItem value="NEUTRO">Neutro</SelectItem>
                <SelectItem value="NEGATIVO">Negativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Proposta</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVisits?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      Nenhuma visita encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVisits?.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell className="font-medium">
                        {format(new Date(visit.visit_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {visit.client_name || visit.prospective_client_name || '-'}
                      </TableCell>
                      <TableCell>{visit.seller_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {visit.city}, {visit.state}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {visit.visit_type?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[visit.status]}>
                          {visit.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {visit.result ? (
                          <Badge className={resultColors[visit.result]}>
                            {visit.result.replace('_', ' ')}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {visit.proposal_sent ? (
                          <Badge className="bg-green-100 text-green-700">Sim</Badge>
                        ) : (
                          <Badge variant="outline">Não</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={createPageUrl('ProspectionVisitDetail') + '?id=' + visit.id}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}