import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function LabelPrintDialog({ open, onClose, label, type = 'product' }) {
  const printRef = useRef();

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Imprimir Etiqueta</title>');
    printWindow.document.write('<style>');
    printWindow.document.write(`
      body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
      .label { 
        width: 100mm; 
        height: 50mm; 
        border: 2px solid #000; 
        padding: 10mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .label-title { font-size: 18px; font-weight: bold; margin-bottom: 8px; }
      .label-info { font-size: 14px; margin: 4px 0; }
      .label-barcode { font-size: 24px; font-family: monospace; font-weight: bold; text-align: center; margin-top: 10px; }
      @media print {
        body { margin: 0; padding: 0; }
        .label { page-break-after: always; }
      }
    `);
    printWindow.document.write('</style></head><body>');
    printWindow.document.write(printRef.current.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
    
    toast.success('Comando de impressão enviado');
  };

  const generateQRCode = (text) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
  };

  if (!label) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Etiqueta - {type === 'product' ? 'Produto' : 'Localização'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div ref={printRef} className="border-2 border-slate-900 p-6 bg-white">
            {type === 'product' ? (
              <>
                <div className="text-center mb-4">
                  <img 
                    src={generateQRCode(label.sku)} 
                    alt="QR Code" 
                    className="mx-auto"
                    style={{ width: '150px', height: '150px' }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xl font-bold text-center font-mono">{label.sku}</div>
                  <div className="text-lg text-center">{label.name}</div>
                  {label.category && (
                    <div className="text-sm text-center text-slate-600">{label.category}</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <img 
                    src={generateQRCode(label.barcode)} 
                    alt="QR Code" 
                    className="mx-auto"
                    style={{ width: '150px', height: '150px' }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xl font-bold text-center font-mono">{label.barcode}</div>
                  <div className="text-sm text-center">
                    {label.rua && `Rua: ${label.rua} `}
                    {label.modulo && `| Módulo: ${label.modulo} `}
                    {label.nivel && `| Nível: ${label.nivel} `}
                    {label.posicao && `| Posição: ${label.posicao}`}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handlePrint} className="flex-1">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}