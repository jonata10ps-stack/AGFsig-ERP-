import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ShippingLabel({ item, order, onClose }) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta de Envio</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; }
          .label {
            width: 100mm;
            height: 150mm;
            padding: 10mm;
            border: 2px solid #000;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-after: always;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 8mm;
            margin-bottom: 8mm;
          }
          .title { font-size: 16px; font-weight: bold; }
          .content {
            font-size: 12px;
            line-height: 1.6;
          }
          .field {
            margin-bottom: 6mm;
          }
          .label-text {
            font-size: 10px;
            color: #666;
          }
          .value {
            font-size: 13px;
            font-weight: bold;
            margin-top: 2mm;
            word-break: break-word;
          }
          .footer {
            border-top: 2px solid #000;
            padding-top: 8mm;
            text-align: center;
            font-size: 11px;
          }
          .barcode-area {
            text-align: center;
            padding: 8mm 0;
            border: 1px dashed #999;
            font-size: 10px;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .label { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="header">
            <div class="title">ETIQUETA DE ENVIO</div>
          </div>
          
          <div class="content">
            <div class="field">
              <div class="label-text">DESTINATÁRIO</div>
              <div class="value">${order.client_name}</div>
            </div>
            
            <div class="field">
              <div class="label-text">PRODUTO</div>
              <div class="value">${item.product_sku} - ${item.product_name}</div>
            </div>
            
            <div class="field">
              <div class="label-text">QUANTIDADE</div>
              <div class="value">${item.qty} ${item.unit || 'UN'}</div>
            </div>
            
            <div class="field">
              <div class="label-text">PEDIDO / NF</div>
              <div class="value">Ped: ${order.order_number || order.numero_pedido_externo} / NF: ${order.nf_number || 'Pendente'}</div>
            </div>
            
            <div class="field">
              <div class="label-text">DATA DE ENVIO</div>
              <div class="value">${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}</div>
            </div>
            
            <div class="field">
              <div class="label-text">DATA PREVISTA ENTREGA</div>
              <div class="value">${
                order.delivery_date 
                  ? format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: ptBR })
                  : 'A definir'
              }</div>
            </div>
          </div>
          
          <div class="barcode-area">
            Código: ${item.id}
          </div>
          
          <div class="footer">
            <div>AGFSig ERP • Sistema de Logística</div>
            <div style="margin-top: 3mm; font-size: 10px;">${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Etiqueta de Envio</DialogTitle>
        </DialogHeader>
        
        <div className="bg-white p-8 border-2 border-dashed border-slate-300 rounded-lg" style={{ width: '100%', aspectRatio: '210/297' }}>
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-4">
            <h3 className="font-bold text-lg">ETIQUETA DE ENVIO</h3>
          </div>
          
          <div className="space-y-3 text-sm font-mono">
            <div>
              <p className="text-xs text-slate-500">DESTINATÁRIO</p>
              <p className="font-bold text-base">{order.client_name}</p>
            </div>
            
            <div>
              <p className="text-xs text-slate-500">PRODUTO</p>
              <p className="font-bold">{item.product_sku}</p>
              <p className="text-sm">{item.product_name}</p>
            </div>
            
            <div>
              <p className="text-xs text-slate-500">QUANTIDADE</p>
              <p className="font-bold text-base">{item.qty} {item.unit || 'UN'}</p>
            </div>
            
            <div>
              <p className="text-xs text-slate-500">PEDIDO / NF</p>
              <p className="font-bold text-sm">
                Ped: {order.order_number || order.numero_pedido_externo}
              </p>
              <p className="font-bold text-sm">
                NF: {order.nf_number || 'Pendente'}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-slate-500">DATA ENVIO</p>
              <p className="font-bold">{format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}</p>
            </div>
            
            <div>
              <p className="text-xs text-slate-500">DATA PREVISTA ENTREGA</p>
              <p className="font-bold">
                {order.delivery_date 
                  ? format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: ptBR })
                  : 'A definir'
                }
              </p>
            </div>
          </div>
          
          <div className="border border-dashed border-slate-400 p-3 my-4 text-center text-xs">
            Código: {item.id}
          </div>
          
          <div className="border-t-2 border-slate-900 pt-3 text-center text-xs">
            <p>AGFSig ERP • Sistema de Logística</p>
            <p className="mt-1">{format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
          <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}