import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X, User, Truck, Clipboard, Scale, FileText, ImageIcon, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ShippingReport({ order, items, onClose }) {
  if (!order) return null;

  const parsePhotos = (photoData) => {
    if (!photoData) return [];
    if (typeof photoData === 'string') {
      if (photoData.startsWith('[')) {
        try { return JSON.parse(photoData); } catch { return [photoData]; }
      }
      return [photoData];
    }
    if (Array.isArray(photoData)) return photoData;
    return [];
  };

  const parsedNfPhotos = parsePhotos(order.signed_nf_photo);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    // Preparar fotos para o print
    const photoHtml = (order.load_photos || []).map(url => 
      `<img src="${url}" style="width: 100%; max-height: 400px; object-fit: contain; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px;">`
    ).join('') || '<p>Nenhuma foto da carga anexada.</p>';

    const nfHtml = parsedNfPhotos.length > 0
      ? parsedNfPhotos.map(url => `<img src="${url}" style="width: 100%; border: 1px solid #000; margin-top: 10px;">`).join('')
      : '<p>Canhoto/NF Assinada não anexado.</p>';

    // Preparar tabela de itens para o print
    const itemsHtml = (items || []).map(item => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-size: 11px;">${item.product_sku}</td>
        <td style="padding: 8px; border: 1px solid #ddd; font-size: 11px;">${item.product_name}</td>
        <td style="padding: 8px; border: 1px solid #ddd; font-size: 11px; text-align: center;">${item.qty}</td>
        <td style="padding: 8px; border: 1px solid #ddd; font-size: 10px; color: #444;">
          ${(item.serial_numbers || []).join(', ') || 'N/A'}
        </td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Expedição - ${order.order_number}</title>
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
          .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .items-table th { background: #f8fafc; text-align: left; padding: 8px; border: 1px solid #ddd; font-size: 10px; text-transform: uppercase; }
          .photos-grid { display: grid; grid-template-columns: 1fr; gap: 15px; }
          .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 5px; font-size: 9px; color: #999; text-align: center; }
          @media print {
            button { display: none; }
            .no-print { display: none; }
            .page-break { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="header">
            <div class="title">Relatório de Expedição</div>
            <div class="order-info">
              <div style="font-size: 16px; font-weight: bold;">Pedido: ${order.order_number}</div>
              <div style="font-size: 11px;">Data: ${format(new Date(order.shipping_date || new Date()), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Dados do Cliente e Transporte</div>
            <div class="grid">
              <div>
                <div class="field-label">Cliente</div>
                <div class="field-value">${order.client_name}</div>
              </div>
              <div>
                <div class="field-label">NF-e</div>
                <div class="field-value">${order.nf_number || 'Não Informada'}</div>
              </div>
              <div>
                <div class="field-label">Motorista</div>
                <div class="field-value">${order.driver_name || 'N/A'} (CPF: ${order.driver_cpf || 'N/A'})</div>
              </div>
              <div>
                <div class="field-label">Transportadora / Placa</div>
                <div class="field-value">${order.carrier || 'N/A'} / ${order.plate || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Itens da Carga e Núm. de Série</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 15%">SKU</th>
                  <th style="width: 40%">Produto</th>
                  <th style="width: 10%">Qtd</th>
                  <th style="width: 35%">Números de Série</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Observações</div>
            <div class="field-value" style="font-size: 11px;">${order.shipping_notes || 'Sem observações adicionais.'}</div>
          </div>

          <div class="page-break"></div>
          
          <div class="section">
            <div class="section-title">Fotos da Carga</div>
            <div class="photos-grid">
              ${photoHtml}
            </div>
          </div>

          <div class="page-break"></div>

          <div class="section">
            <div class="section-title">Canhoto / NF Assinada</div>
            <div style="text-align: center;">
              ${nfHtml}
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b bg-slate-50">
          <div className="flex justify-between items-center pr-8">
            <DialogTitle className="text-xl flex items-center gap-2 font-bold text-slate-800">
              <Clipboard className="h-5 w-5 text-indigo-600" />
              Relatório de Expedição - {order.order_number}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase mb-1">
                <User className="h-3.5 w-3.5" /> Motorista
              </div>
              <p className="text-sm font-semibold text-slate-700">{order.driver_name || 'N/A'}</p>
              <p className="text-xs text-slate-400">{order.driver_cpf || 'CPF não informado'}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase mb-1">
                <Truck className="h-3.5 w-3.5" /> Transporte
              </div>
              <p className="text-sm font-semibold text-slate-700">{order.carrier || 'N/A'}</p>
              <p className="text-xs text-slate-400">Placa: {order.plate || 'N/A'}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase mb-1">
                <Scale className="h-3.5 w-3.5" /> Peso
              </div>
              <p className="text-sm font-semibold text-slate-700">{order.weight ? `${order.weight} kg` : 'N/A'}</p>
              <p className="text-xs text-slate-400">Volumes: {order.volume || '-'}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase mb-1">
                <FileText className="h-3.5 w-3.5" /> Nota Fiscal
              </div>
              <p className="text-sm font-bold text-indigo-600">{order.nf_number || 'N/A'}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-500" />
              <h4 className="text-xs font-bold text-slate-700 uppercase">Relação de Itens e Séries</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/50 text-slate-500 font-bold border-b">
                  <tr>
                    <th className="px-4 py-2">SKU</th>
                    <th className="px-4 py-2">Produto</th>
                    <th className="px-4 py-2 text-center">Qtd</th>
                    <th className="px-4 py-2">Números de Série</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items?.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-indigo-600 font-medium">{item.product_sku}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{item.product_name}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-600">{item.qty}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.serial_numbers?.length > 0 ? (
                            item.serial_numbers.map((s, i) => (
                              <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-600 text-[9px] px-1 py-0 border-none font-mono">
                                {s}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-300 italic">Nenhum série vinculado</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Documents & Photos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-tight">
                  <FileText className="h-4 w-4 text-indigo-500" /> Canhoto / NF Assinada
                </h4>
              </div>
              <div className="bg-white p-2 rounded-xl border shadow-sm min-h-[250px] flex items-center justify-center overflow-hidden">
                {parsedNfPhotos.length > 0 ? (
                  <div className={`grid gap-2 w-full ${parsedNfPhotos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {parsedNfPhotos.map((url, idx) => (
                      <img key={idx} src={url} alt={`Canhoto ${idx+1}`} className="w-full rounded-md object-contain hover:scale-110 transition-transform" />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-300">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p className="text-xs">Documento não anexado</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-tight">
                  <ImageIcon className="h-4 w-4 text-indigo-500" /> Fotos da Carga
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {order.load_photos?.length > 0 ? (
                  order.load_photos.map((url, idx) => (
                    <div key={idx} className="bg-white p-1 rounded-lg border shadow-sm overflow-hidden aspect-video">
                      <img src={url} alt={`Carga ${idx+1}`} className="w-full h-full object-cover hover:scale-110 transition-transform cursor-pointer" />
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 bg-white p-12 rounded-xl border border-dashed flex items-center justify-center text-slate-300">
                    <div className="text-center">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p className="text-xs">Nenhuma foto da carga</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="p-6 bg-slate-50 border-t">
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={onClose} className="rounded-xl border-slate-300">
              <X className="h-4 w-4 mr-2" />
              Fechar
            </Button>
            <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 px-8">
              <Printer className="h-4 w-4 mr-2" />
              Gerar PDF / Imprimir
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
