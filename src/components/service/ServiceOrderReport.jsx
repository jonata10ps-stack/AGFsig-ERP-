import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X, User, Wrench, Clipboard, History, FileText, ImageIcon, CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ServiceOrderReport({ order, history, onClose }) {
  if (!order) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    const photoHtml = (order.service_photos || []).map(url => 
      `<div class="photo-card"><img src="${url}"></div>`
    ).join('') || '<div class="empty-state">Nenhuma foto anexada</div>';

    const signatureHtml = order.client_signature 
      ? `<img src="${order.client_signature}" class="signature-img">`
      : '<div class="signature-placeholder">Assinatura Pendente</div>';

    const historyHtml = (history || []).map(h => `
      <div class="history-item">
        <div class="history-dot"></div>
        <div class="history-content">
          <div class="history-meta">${format(new Date(h.created_at || h.created_date), 'dd/MM/yyyy HH:mm')}</div>
          <div class="history-text">Técnico: <strong>${h.to_technician_name}</strong></div>
          <div class="history-reason">${h.reason || 'Alteração de rotina'}</div>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OS ${order.os_number} - Relatório Técnico</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          body { 
            font-family: 'Inter', sans-serif; 
            color: #1e293b; 
            background: #fff;
            margin: 0; padding: 0; 
            font-size: 11px;
            line-height: 1.5;
          }
          .container { max-width: 800px; margin: 0 auto; }
          
          /* Header Styling */
          .header { 
            display: flex; justify-content: space-between; align-items: center; 
            padding: 20px 0; border-bottom: 2px solid #f1f5f9; margin-bottom: 30px; 
          }
          .logo-text { font-size: 24px; font-weight: 800; color: #4f46e5; letter-spacing: -1px; }
          .os-badge { 
            background: #f1f5f9; padding: 10px 20px; border-radius: 12px; text-align: right; 
          }
          .os-number { font-size: 18px; font-weight: 800; color: #1e293b; display: block; }
          .os-status { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px; }

          /* Cards Layout */
          .section-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 25px; }
          .card { 
            background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; 
            padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          }
          .card-label { font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
          .card-value { font-weight: 600; color: #0f172a; word-break: break-word; }
          .card-sub { font-size: 10px; color: #64748b; margin-top: 4px; }

          /* Content Sections */
          .full-section { margin-bottom: 25px; }
          .section-title { 
            font-size: 10px; font-weight: 800; color: #4f46e5; 
            text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
          }
          .section-title::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
          .text-content { background: #f8fafc; border-radius: 12px; padding: 15px; font-size: 11px; color: #334155; border: 1px solid #f1f5f9; }
          .text-solution { color: #059669; font-weight: 500; }

          /* Photo Gallery */
          .photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .photo-card { border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; height: 180px; }
          .photo-card img { width: 100%; height: 100%; object-fit: cover; }
          .empty-state { text-align: center; padding: 40px; color: #94a3b8; background: #f8fafc; border-radius: 12px; font-style: italic; }

          /* History */
          .history-container { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 15px; }
          .history-item { display: flex; gap: 12px; margin-bottom: 12px; position: relative; }
          .history-dot { width: 8px; height: 8px; background: #4f46e5; border-radius: 50%; margin-top: 4px; }
          .history-meta { font-size: 9px; color: #94a3b8; font-weight: 600; }
          .history-text { font-size: 11px; }

          /* Footer / Signature */
          .signature-section { 
            margin-top: 40px; border-top: 1px solid #e2e8f0; pt: 30px; 
            display: flex; justify-content: center; text-align: center; 
          }
          .signature-box { width: 300px; }
          .signature-img { max-height: 100px; width: auto; margin-bottom: 15px; }
          .signature-line { border-top: 2px solid #1e293b; margin-top: 5px; padding-top: 5px; font-weight: 700; }
          .footer-note { font-size: 8px; color: #94a3b8; text-align: center; margin-top: 40px; }

          .page-break { page-break-before: always; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="header">
            <div class="logo-text">AGFsig <span style="font-weight: 400; color: #94a3b8">ERP</span></div>
            <div class="os-badge">
              <span class="os-number">OS ${order.os_number}</span>
              <span class="os-status">${order.status} • ${order.type}</span>
            </div>
          </header>

          <div class="section-grid">
            <div class="card">
              <div class="card-label">Dados do Cliente</div>
              <div class="card-value">${order.client_name}</div>
            </div>
            <div class="card">
              <div class="card-label">Técnico Responsável</div>
              <div class="card-value">${order.technician_name || 'Não atribuído'}</div>
              <div class="card-sub">${order.scheduled_date ? format(new Date(order.scheduled_date), 'dd/MM/yyyy') : 'Sem data'}</div>
            </div>
            <div class="card">
              <div class="card-label">Investimento Total</div>
              <div class="card-value" style="color: #4f46e5; font-size: 14px;">R$ ${(order.total_cost || 0).toFixed(2)}</div>
              <div class="card-sub">${order.labor_hours || 0}h de labor</div>
            </div>
          </div>

          <div class="full-section">
            <div class="section-title">Diagnóstico Técnico</div>
            <div class="text-content italic">${order.diagnosis || 'Nenhum diagnóstico registrado.'}</div>
          </div>

          <div class="full-section">
            <div class="section-title">Solução Aplicada</div>
            <div class="text-content text-solution">${order.solution || 'Pendente de finalização.'}</div>
          </div>

          <div class="full-section">
            <div class="section-title">Relatório Fotográfico</div>
            <div class="photo-grid">
              ${photoHtml}
            </div>
          </div>

          <div class="page-break"></div>

          <div class="full-section">
            <div class="section-title">Histórico de Movimentação</div>
            <div class="history-container">
              ${historyHtml || '<div class="empty-state">Sem histórico registrado</div>'}
            </div>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              ${signatureHtml}
              <div class="signature-line">ASSINATURA DO CLIENTE</div>
              <div style="font-size: 10px; color: #64748b; font-weight: 500;">${order.client_name}</div>
            </div>
          </div>

          <div class="footer-note">
            Este relatório foi gerado digitalmente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} • Autenticidade garantida por AGFsig ERP
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 800);
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
