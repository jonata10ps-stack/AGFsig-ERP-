import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronLeft, ChevronRight, Calendar, User, MapPin, Phone, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

const statusColors = {
  PENDENTE: 'bg-blue-100 text-blue-700',
  EM_ANDAMENTO: 'bg-amber-100 text-amber-700',
  PAUSADA: 'bg-orange-100 text-orange-700',
  CONCLUIDA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-slate-100 text-slate-700',
};

const typeColors = {
  INSTALACAO: 'bg-indigo-50 border-indigo-200',
  MANUTENCAO: 'bg-blue-50 border-blue-200',
  GARANTIA: 'bg-emerald-50 border-emerald-200',
  REVISAO: 'bg-purple-50 border-purple-200',
};

const priorityColors = {
  BAIXA: 'text-slate-600',
  NORMAL: 'text-blue-600',
  ALTA: 'text-orange-600',
  URGENTE: 'text-red-600',
};

export default function ServiceSchedule() {
  const { companyId } = useCompanyId();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [technicianFilter, setTechnicianFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');

  // Buscamos o usuário atual
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  // Se for técnico, buscamos seu registro
  const { data: currentTechnician } = useQuery({
    queryKey: ['technician-by-user', user?.email],
    queryFn: async () => {
        if (!user?.is_technician || !user?.email) return null;
        const techs = await base44.entities.Technician.filter({ email: user.email });
        return techs?.[0] || null;
    },
    enabled: !!user?.is_technician && !!user?.email,
  });

  const { data: serviceOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ['service-orders', companyId, currentTechnician?.id],
    queryFn: async () => {
        if (!companyId) return [];
        const filters = { company_id: companyId };
        
        // Se for técnico, filtra apenas pelas dele
        if (user?.is_technician) {
            if (!currentTechnician) return [];
            filters.technician_id = currentTechnician.id;
        }
        
        return await base44.entities.ServiceOrder.filter(filters, '-created_date');
    },
    enabled: !!companyId && (!user?.is_technician || !!currentTechnician),
  });

  const { data: technicians } = useQuery({
    queryKey: ['technicians', companyId],
    queryFn: () => companyId ? base44.entities.Technician.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const filteredOrders = useMemo(() => {
    if (!serviceOrders) return [];
    return serviceOrders.filter(order => {
      if (!order.scheduled_date) return false;
      
      // Se for gestor, respeita o filtro de técnico selecionado
      if (!user?.is_technician) {
          const matchTechnician = technicianFilter === 'all' || order.technician_id === technicianFilter;
          return matchTechnician;
      }
      
      return true; // Se for técnico, já vem filtrado da query
    });
  }, [serviceOrders, technicianFilter, user?.is_technician]);

  const selectedDayOrders = useMemo(() => {
    return filteredOrders.filter(order => {
      const orderDate = parseISO(order.scheduled_date);
      return isSameDay(orderDate, selectedDate);
    }).sort((a, b) => {
      const priorityOrder = { URGENTE: 0, ALTA: 1, NORMAL: 2, BAIXA: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [filteredOrders, selectedDate]);

  const getOrdersForDay = (day) => {
    return filteredOrders.filter(order => {
      const orderDate = parseISO(order.scheduled_date);
      return isSameDay(orderDate, day);
    }).length;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Agenda de Serviços</h1>
        <p className="text-slate-500">Programação de atendimentos por técnico e cliente</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendário */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentDate(addMonths(currentDate, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="font-semibold text-sm">
                  {format(currentDate, 'MMMM yyyy', { locale: pt })}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dias da semana */}
              <div className="grid grid-cols-7 gap-1 text-xs font-semibold text-center">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(day => (
                  <div key={day} className="h-8 flex items-center justify-center text-slate-600">
                    {day}
                  </div>
                ))}
              </div>

              {/* Dias do mês */}
              <div className="grid grid-cols-7 gap-1">
                {/* Espaçamento para alinhar o primeiro dia da semana */}
                {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-10" />
                ))}
                {days.map(day => {
                  const ordersCount = getOrdersForDay(day);
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentDate);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`h-10 rounded text-xs font-medium transition-all ${
                        !isCurrentMonth
                          ? 'text-slate-300 hover:bg-slate-50'
                          : isSelected
                          ? 'bg-indigo-600 text-white shadow-lg'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full">
                        <span>{format(day, 'd')}</span>
                        {ordersCount > 0 && (
                          <span className={`text-xs ${isSelected ? 'text-indigo-200' : 'text-indigo-600'}`}>
                            •
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detalhes e filtros */}
        <div className="lg:col-span-3 space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!user?.is_technician && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Técnico</label>
                    <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os técnicos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os técnicos</SelectItem>
                        {technicians?.map(tech => (
                          <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agendamentos do dia */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                <CardTitle className="text-lg">
                  {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: pt })}
                </CardTitle>
                <Badge variant="outline" className="ml-auto">
                  {selectedDayOrders.length} {selectedDayOrders.length === 1 ? 'agendamento' : 'agendamentos'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loadingOrders ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : selectedDayOrders.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Nenhum agendamento para este dia</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayOrders.map(order => (
                    <Link key={order.id} to={createPageUrl(`ServiceOrderDetail?id=${order.id}`)}>
                      <div className={`border-l-4 border-indigo-600 p-4 rounded-lg ${typeColors[order.type]} hover:shadow-md transition-shadow cursor-pointer`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-slate-900">{order.os_number}</h4>
                              <Badge className={statusColors[order.status]} variant="outline">
                                {order.status}
                              </Badge>
                              <Badge variant="outline" className={priorityColors[order.priority]}>
                                {order.priority}
                              </Badge>
                            </div>

                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2 text-slate-700">
                                <MapPin className="h-4 w-4 text-slate-400" />
                                <span className="font-medium">{order.client_name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-600">
                                <User className="h-4 w-4 text-slate-400" />
                                <span>{order.technician_name || 'Sem técnico'}</span>
                              </div>
                              <p className="text-slate-600 line-clamp-2">{order.description}</p>
                            </div>
                          </div>

                          <div className="flex-shrink-0 text-right text-xs text-slate-500">
                            <Badge variant="secondary" className="whitespace-nowrap">
                              {order.type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo da semana */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo por Técnico</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {technicians?.map(tech => {
                  const techOrders = filteredOrders.filter(o => o.technician_id === tech.id);
                  const techTodayOrders = selectedDayOrders.filter(o => o.technician_id === tech.id);
                  return (
                    <div key={tech.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                      <div>
                        <p className="font-medium text-slate-900">{tech.name}</p>
                        <p className="text-xs text-slate-500">{tech.phone || 'Sem contato'}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold text-slate-900">{techTodayOrders.length}</p>
                        <p className="text-xs text-slate-500">hoje</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}