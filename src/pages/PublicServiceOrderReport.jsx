import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Clipboard, User, Wrench, Clock, History, ImageIcon, CheckCircle, Printer, MapPin, Phone, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

export default function PublicServiceOrderReport() {
  const { id } = useParams();

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['public-service-order', id],
    queryFn: async () => {
      const data = await base44.entities.ServiceOrder.filter({ id });
      return data?.[0] || null;
    },
    enabled: !!id,
  });

  const { data: history } = useQuery({
    queryKey: ['public-technician-history', id],
    queryFn: () => base44.entities.TechnicianHistory.filter({ service_order_id: id }, '-created_date'),
    enabled: !!id && !!order,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <Card className="w-full max-w-4xl shadow-2xl">
          <CardHeader className="p-8 border-b bg-slate-900 text-white rounded-t-xl">
             <Skeleton className="h-10 w-64 bg-slate-800" />
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 flex items-center justify-center text-center">
        <Card className="p-12 max-w-md shadow-xl border-none">
          <Clipboard className="h-16 w-16 mx-auto mb-4 text-slate-300 opacity-20" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Relatório não encontrado</h2>
          <p className="text-slate-500 mb-6">A Ordem de Serviço solicitada não existe ou o link expirou.</p>
          <p className="text-xs text-slate-400">Verifique se o link está correto ou entre em contato com o suporte.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 print:p-0 print:bg-white">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Public Header - No Sidebar/Nav */}
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl border border-slate-800 relative overflow-hidden print:rounded-none print:shadow-none print:border-none">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
             <Wrench className="h-48 w-48" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-indigo-500 text-white border-none px-3 font-bold">RELATÓRIO TÉCNICO</Badge>
                <Badge variant="outline" className="border-indigo-400 text-indigo-400 border-2">{order.status}</Badge>
              </div>
              <h1 className="text-4xl font-black tracking-tight">OS {order.os_number}</h1>
              <p className="text-slate-400 font-medium">Ordem de Serviço • {order.type}</p>
            </div>
            <div className="text-right hidden md:block">
              <p className="text-sm text-slate-400 uppercase font-bold tracking-widest mb-1">Data de Realização</p>
              <p className="text-2xl font-bold">{order.completed_at ? format(new Date(order.completed_at), "dd 'de' MMMM, yyyy", { locale: ptBR }) : 'Pendente'}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="flex justify-end gap-4 print:hidden">
          <Button onClick={handlePrint} className="bg-white hover:bg-slate-50 text-slate-900 border shadow-sm rounded-xl px-6">
            <Printer className="h-4 w-4 mr-2" />
            Salvar em PDF / Imprimir
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* 1. Client and Device Info */}
            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b p-6">
                 <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                    <User className="h-4 w-4 text-indigo-500" /> DADOS DO CLIENTE E EQUIPAMENTO
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente / Solicitante</p>
                   <p className="font-bold text-lg text-slate-900">{order.client_name}</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produto / Modelo</p>
                   <p className="font-bold text-lg text-slate-900">{order.product_name || 'N/A'}</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Número de Série</p>
                   <p className="font-mono text-indigo-600 font-bold">{order.serial_number || 'N/A'}</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Técnico Responsável</p>
                   <p className="font-bold text-slate-800">{order.technician_name || 'Não atribuído'}</p>
                 </div>
               </CardContent>
            </Card>

            {/* 2. Technical details */}
            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b p-6">
                 <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                    <Wrench className="h-4 w-4 text-indigo-500" /> DETALHAMENTO TÉCNICO
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-10">
                 <div className="space-y-3">
                    <p className="text-xs font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                       <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                       Diagnóstico Realizado
                    </p>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                       {order.diagnosis || 'Pendente de preenchimento.'}
                    </div>
                 </div>

                 <div className="space-y-3">
                    <p className="text-xs font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                       <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                       Solução Aplicada
                    </p>
                    <div className="p-6 bg-emerald-50/30 rounded-2xl border border-emerald-100/50 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                       {order.solution || 'Aguardando conclusão dos serviços.'}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
                    <div className="space-y-3">
                       <p className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                          <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
                          Peças e Materiais
                       </p>
                       <p className="text-sm text-slate-600 bg-white p-4 rounded-xl border border-slate-100 shadow-inner">
                          {order.parts_used || 'Nenhuma peça vinculada.'}
                       </p>
                    </div>
                    <div className="space-y-3">
                       <p className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                          <span className="w-1.5 h-4 bg-slate-400 rounded-full"></span>
                          Tempo de Execução
                       </p>
                       <p className="text-sm text-slate-600 bg-white p-4 rounded-xl border border-slate-100 shadow-inner">
                          {order.labor_hours || 0} horas totais
                       </p>
                    </div>
                 </div>
               </CardContent>
            </Card>

            {/* 3. Photos Report */}
            <div className="space-y-6">
               <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <ImageIcon className="h-6 w-6 text-indigo-500" />
                  RELATÓRIO FOTOGRÁFICO
               </h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 {order.service_photos?.length > 0 ? (
                   order.service_photos.map((url, idx) => (
                      <div key={idx} className="group relative bg-white p-2 rounded-3xl border shadow-sm overflow-hidden aspect-video transition-transform hover:-translate-y-1">
                         <img src={url} alt={`Evidência ${idx+1}`} className="w-full h-full object-cover rounded-2xl" />
                         <div className="absolute bottom-4 left-4">
                            <Badge className="bg-black/50 backdrop-blur-md text-white border-none py-1">FOTO {idx+1}</Badge>
                         </div>
                      </div>
                   ))
                 ) : (
                    <div className="col-span-full py-16 bg-slate-100/50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                       <ImageIcon className="h-12 w-12 mb-3 opacity-20" />
                       <p className="text-sm font-medium italic">Nenhuma evidência fotográfica anexada.</p>
                    </div>
                 )}
               </div>
            </div>
          </div>

          {/* Sidebar / Signature Column */}
          <div className="space-y-8">
            
            {/* 4. Timeline / History */}
            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b p-6">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                     <History className="h-4 w-4 text-indigo-500" /> HISTÓRICO TÉCNICO
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                  <div className="space-y-6">
                     <div className="flex gap-4">
                        <div className="relative">
                           <div className="h-full w-0.5 bg-slate-100 absolute left-4 top-4"></div>
                           <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white relative z-10 shadow-lg shadow-emerald-100">
                              <CheckCircle className="h-4 w-4" />
                           </div>
                        </div>
                        <div className="pt-1 pb-4">
                           <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Criada</p>
                           <p className="text-[10px] text-slate-400 mt-0.5">
                             {order.created_date ? format(new Date(order.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                           </p>
                        </div>
                     </div>

                     {history?.map((item, idx) => (
                        <div key={item.id} className="flex gap-4">
                           <div className="relative">
                              <div className={`h-full w-0.5 bg-slate-100 absolute left-4 top-4 ${idx === history.length - 1 ? 'hidden' : ''}`}></div>
                              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 relative z-10 border-2 border-white">
                                 <Clock className="h-4 w-4" />
                              </div>
                           </div>
                           <div className="pt-1 pb-4">
                              <p className="text-xs font-black text-slate-700 uppercase tracking-tight">Atribuída p/ {item.to_technician_name}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                 {format(new Date(item.created_at || item.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </p>
                              {item.reason && <p className="text-[9px] text-slate-500 italic mt-1 line-clamp-1">"{item.reason}"</p>}
                           </div>
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>

            {/* 5. Client Signature */}
            <Card className="rounded-3xl border-slate-200 shadow-lg overflow-hidden bg-white">
               <CardHeader className="bg-slate-900 border-b p-6">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-white/90">
                     <User className="h-4 w-4 text-indigo-400" /> CONFORMIDADE E ASSINATURA
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-8 text-center bg-slate-50/30">
                  <p className="text-[10px] text-slate-500 leading-relaxed mb-8 italic">
                     "Confirmo que os serviços descritos neste relatório foram executados satisfatoriamente e o equipamento/instalação foi testado e aprovado."
                  </p>
                  <div className="relative min-h-[160px] bg-white rounded-2xl border-2 border-slate-100 shadow-inner flex flex-col items-center justify-center p-4">
                     {order.client_signature ? (
                       <>
                         <img src={order.client_signature} alt="Assinatura" className="max-h-[140px] object-contain relative z-10" />
                         <div className="mt-4 pt-2 border-t border-slate-200 w-32">
                           <p className="text-[10px] font-black text-slate-800 uppercase tabular-nums">ASSINADO</p>
                         </div>
                       </>
                     ) : (
                        <div className="opacity-10 text-slate-300">
                           <User className="h-16 w-16 mx-auto mb-2" />
                           <p className="text-xs font-bold">AGUARDANDO COLETA</p>
                        </div>
                     )}
                  </div>
                  <div className="mt-4">
                     <p className="text-xs font-bold text-slate-900">{order.client_name}</p>
                     <p className="text-[9px] text-slate-400 uppercase tracking-widest">{order.completed_at ? 'Validado em ' + format(new Date(order.completed_at), 'dd/MM/yyyy') : '-'}</p>
                  </div>
               </CardContent>
               <div className="bg-slate-100 p-4 flex items-center justify-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                  <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> GPS Validado</div>
                  <div className="flex items-center gap-1.5"><History className="h-3 w-3" /> Registro Temporal</div>
               </div>
            </Card>
          </div>
        </div>

        {/* Public Footer */}
        <div className="text-center py-12 border-t border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Documento Gerado Digitalmente pelo Sistema AGFSig ERP</p>
          <div className="mt-4 flex justify-center gap-6 text-slate-300">
             <Phone className="h-4 w-4" />
             <Mail className="h-4 w-4" />
             <MapPin className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
