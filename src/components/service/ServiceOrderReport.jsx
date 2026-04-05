import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X, User, Wrench, Clipboard, History, FileText, ImageIcon, CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ServiceOrderReport({ order, history, onClose }) {
  if (!order) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    // Preparar fotos para o print
    const photoHtml = (order.service_photos || []).map(url => 
      `<img src="${url}" style="width: 100%; max-height: 350px; object-fit: contain; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px;">`
    ).join('') || '<p style="color: #999; font-style: italic;">Nenhuma foto do serviço anexada.</p>';

    const signatureHtml = order.client_signature 
      ? `<img src="${order.client_signature}" style="max-height: 120px; display: block; margin: 0 auto;">`
      : '<p style="color: #999; font-style: italic; border-bottom: 1px solid #ccc; width: 250px; margin: 20px auto;"></p><p style="text-align: center; color: #999; font-size: 10px;">Assinatura não coletada</p>';

    // Preparar histórico para o print
    const historyHtml = (history || []).map(h => `
      <div style="margin-bottom: 8px; border-left: 2px solid #ddd; padding-left: 10px; font-size: 11px;">
        <strong>${format(new Date(h.created_at || h.created_date), 'dd/MM/yyyy HH:mm')}</strong> - 
        De: ${h.from_technician_name || 'Não atribuído'} p/ ${h.to_technician_name}
        <br/><span style="color: #666;">Motivo: ${h.reason || '-'}</span>
      </div>
    `).join('') || '<p>Sem histórico de trocas técnicas.</p>';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Serviço - OS ${order.os_number}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Inter', system-ui, sans-serif; color: #333; line-height: 1.4; margin: 0; padding: 0; }
          .report-container { padding: 10px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 22px; font-weight: bold; text-transform: uppercase; }
          .order-info { text-align: right; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 12px; font-weight: bold; background: #f4f4f5; padding: 4px 8px; border-left: 3px solid #333; margin-bottom: 10px; text-transform: uppercase; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .field-label { font-size: 10px; text-transform: uppercase; color: #666; font-weight: bold; }
          .field-value { font-size: 12px; font-weight: 500; }
          .content-box { font-size: 11px; white-space: pre-wrap; background: #fff; border: 1px solid #eee; padding: 10px; border-radius: 4px; }
          .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 5px; font-size: 9px; color: #999; text-align: center; }
          @media print {
            button { display: none; }
            .page-break { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="header">
            <div class="title">Relatório Técnico de Serviço</div>
            <div class="order-info">
              <div style="font-size: 16px; font-weight: bold;">OS: ${order.os_number}</div>
              <div style="font-size: 11px;">Status: ${order.status}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Dados Gerais</div>
            <div class="grid">
              <div>
                <div class="field-label">Cliente</div>
                <div class="field-value">${order.client_name}</div>
              </div>
              <div>
                <div class="field-label">Tipo de Serviço</div>
                <div class="field-value">${order.type}</div>
              </div>
              <div>
                <div class="field-label">Técnico Responsável</div>
                <div class="field-value">${order.technician_name || 'Não atribuído'}</div>
              </div>
              <div>
                <div class="field-label">Data Agendada</div>
                <div class="field-value">${order.scheduled_date ? format(new Date(order.scheduled_date), 'dd/MM/yyyy') : '-'}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Descrição do Problema / Solicitação</div>
            <div class="content-box">${order.description || 'Não informado.'}</div>
          </div>

          <div class="section">
            <div class="section-title">Diagnóstico Técnico</div>
            <div class="content-box">${order.diagnosis || 'Pendente.'}</div>
          </div>

          <div class="section">
            <div class="section-title">Solução Realizada</div>
            <div class="content-box">${order.solution || 'Pendente.'}</div>
          </div>

          <div class="section">
            <div class="section-title">Peças / Materiais Utilizados</div>
            <div class="content-box">${order.parts_used || 'Nenhuma peça informada.'}</div>
          </div>

          <div class="section">
            <div class="section-title">Custos e Tempo</div>
            <div class="grid">
              <div>
                <div class="field-label">Horas Trabalhadas</div>
                <div class="field-value">${order.labor_hours || 0}h</div>
              </div>
              <div>
                <div class="field-label">Custo Total</div>
                <div class="field-value">R$ ${(order.total_cost || 0).toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div class="page-break"></div>

          <div class="section">
            <div class="section-title">Histórico de Movimentação Técnica</div>
            ${historyHtml}
          </div>

          <div class="section">
            <div class="section-title">Relatório Fotográfico</div>
            <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
              ${photoHtml}
            </div>
          </div>

          <div class="page-break" style="margin-top: 40px;"></div>

          <div class="section" style="margin-top: 50px;">
            <div class="section-title">Conformidade e Assinatura</div>
            <p style="font-size: 10px; color: #666; margin-bottom: 30px;">
              Declaro que os serviços acima descritos foram realizados e o equipamento/instalação encontra-se em conformidade.
            </p>
            <div style="width: 300px; margin: 40px auto; text-align: center;">
              ${signatureHtml}
              <div style="border-top: 1px solid #333; padding-top: 5px; font-size: 11px; font-weight: bold; margin-top: 5px;">
                Assinatura do Cliente
              </div>
              <div style="font-size: 10px; color: #666;">${order.client_name}</div>
            </div>
          </div>

          <div class="footer">
            Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} pelo sistema AGFSig ERP
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
        <DialogHeader className="p-6 pb-2 border-b bg-slate-900 text-white">
          <div className="flex justify-between items-center pr-8">
            <DialogTitle className="text-xl flex items-center gap-2 font-bold">
              <Clipboard className="h-5 w-5 text-indigo-400" />
              Relatório de Ordem de Serviço - OS {order.os_number}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50">
          {/* Main Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="p-4 pb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Geral</p>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-bold">{order.client_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tipo:</span>
                  <Badge variant="outline">{order.type}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Técnico:</span>
                  <span className="font-medium">{order.technician_name}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
              <CardHeader className="p-4 pb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Diagnóstico e Solução</p>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="text-xs">
                  <span className="text-slate-500 font-bold block mb-1">Diagnóstico:</span>
                  <p className="line-clamp-2 italic">{order.diagnosis || 'Não informado'}</p>
                </div>
                <div className="text-xs mt-2">
                  <span className="text-slate-500 font-bold block mb-1">Solução:</span>
                  <p className="line-clamp-2 text-emerald-700 font-medium">{order.solution || 'Pendente'}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
              <CardHeader className="p-4 pb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Valores e Tempo</p>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Horas:</span>
                  <span className="font-bold">{order.labor_hours || 0}h</span>
                </div>
                <div className="flex justify-between text-lg pt-1">
                  <span className="text-slate-500">Total:</span>
                  <span className="font-extrabold text-indigo-600">R$ {(order.total_cost || 0).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Photos and Signature */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-widest">
                <ImageIcon className="h-4 w-4 text-indigo-500" /> Relatório Fotográfico
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {order.service_photos?.length > 0 ? (
                  order.service_photos.map((url, idx) => (
                    <div key={idx} className="bg-white p-1.5 rounded-xl border shadow-sm aspect-video overflow-hidden">
                      <img src={url} alt={`Foto ${idx+1}`} className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform" />
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 py-12 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon className="h-12 w-12 mb-2 opacity-10" />
                    <p className="text-xs">Sem fotos anexadas</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-widest">
                <User className="h-4 w-4 text-indigo-500" /> Assinatura do Cliente
              </h4>
              <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-inner min-h-[220px] flex items-center justify-center overflow-hidden">
                {order.client_signature ? (
                  <div className="text-center group">
                    <img src={order.client_signature} alt="Assinatura" className="max-h-[160px] object-contain mb-4" />
                    <div className="pt-2 border-t border-slate-200 w-48 mx-auto">
                      <p className="text-[10px] font-bold text-slate-800">{order.client_name}</p>
                      <p className="text-[9px] text-slate-400">Assinatura Digital</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-300">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-10" />
                    <p className="text-sm">Assinatura pendente</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Technician History */}
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-widest">
              <History className="h-4 w-4 text-indigo-500" /> Histórico de Técnicos
            </h4>
            <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
              {history?.length > 0 ? (
                <div className="divide-y">
                  {history.map((item, idx) => (
                    <div key={idx} className="p-4 flex gap-4 items-start hover:bg-slate-50/50 transition-colors">
                      <div className="p-2 bg-indigo-50 rounded-lg">
                        <Clock className="h-4 w-4 text-indigo-500" />
                      </div>
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Data/Hora</p>
                          <p className="text-xs font-medium">{format(new Date(item.created_at || item.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                        </div>
                        <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">De</p>
                        <p className="text-xs">{item.from_technician_name || 'Inexistente'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Para</p>
                          <p className="font-bold text-xs text-indigo-600">{item.to_technician_name}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Motivo</p>
                          <p className="text-xs truncate italic">{item.reason || '-'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 italic text-sm">
                  Sem movimentações de técnicos registradas.
                </div>
              )}
            </div>
          </div>
        </div>
        
        <DialogFooter className="p-6 bg-slate-900 border-t border-slate-800">
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={onClose} className="rounded-xl border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700">
              <X className="h-4 w-4 mr-2" />
              Fechar
            </Button>
            <div className="flex gap-3">
              <Button onClick={() => window.open(`/public/os/${order.id}`, '_blank')} variant="outline" className="rounded-xl border-indigo-500/50 text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10">
                <FileText className="h-4 w-4 mr-2" />
                Link Público
              </Button>
              <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-900/20 px-8 border-none font-bold">
                <Printer className="h-4 w-4 mr-2" />
                Versão para Impressão (PDF)
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
