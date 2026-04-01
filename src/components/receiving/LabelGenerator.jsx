import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const LABEL_SIZES = {
  a4_4x6: {
    name: 'A4 - 4 por página (10x15cm)',
    cols: 2,
    rows: 2,
    width: '210mm',
    height: '297mm',
    itemWidth: '100mm',
    itemHeight: '148mm',
    padding: '5mm',
    gap: '0',
    qrSize: 70,
    fontSize: 'text-sm',
  },
  a4_8x10: {
    name: 'A4 - 8 por página',
    cols: 2,
    rows: 4,
    width: '210mm',
    height: '297mm',
    itemWidth: '100mm',
    itemHeight: '74mm',
    padding: '3mm',
    gap: '0',
    qrSize: 50,
    fontSize: 'text-xs',
  },
  a4_16: {
    name: 'A4 - 16 por página',
    cols: 4,
    rows: 4,
    width: '210mm',
    height: '297mm',
    itemWidth: '50mm',
    itemHeight: '74mm',
    padding: '2mm',
    gap: '0',
    qrSize: 35,
    fontSize: 'text-xs',
  },
  carta_4x6: {
    name: 'Carta (EUA) - 4x6 polegadas',
    cols: 2,
    rows: 3,
    width: '215.9mm',
    height: '279.4mm',
    itemWidth: '101.6mm',
    itemHeight: '88.9mm',
    padding: '3mm',
    gap: '2.5mm',
    qrSize: 60,
    fontSize: 'text-sm',
  },
  etiqueta_10x15: {
    name: 'Etiqueta 10x15cm (Rolo)',
    cols: 1,
    rows: 1,
    width: '100mm',
    height: '150mm',
    itemWidth: '100mm',
    itemHeight: '150mm',
    padding: '5mm',
    gap: '0',
    qrSize: 80,
    fontSize: 'text-base',
  },
};

export default function LabelGenerator({ items }) {
  const [selectedSize, setSelectedSize] = useState('a4_4x6');
  const config = LABEL_SIZES[selectedSize];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Tamanho */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configurações de Impressão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-3">Selecione o tamanho de etiqueta:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(LABEL_SIZES).map(([key, size]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedSize(key)}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all text-left',
                      selectedSize === key
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <p className="font-medium text-slate-900">{size.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {size.cols} × {size.rows} = {size.cols * size.rows} etiquetas
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-slate-600">
                <p>Tamanho selecionado: <Badge className="ml-2">{config.name}</Badge></p>
                <p className="text-xs text-slate-500 mt-1">{config.itemWidth} × {config.itemHeight}</p>
              </div>
              <Button 
                onClick={handlePrint}
                className="bg-indigo-600 hover:bg-indigo-700 gap-2 print:hidden"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <div className="print:hidden bg-slate-50 p-6 rounded-lg border-2 border-dashed border-slate-300">
        <p className="text-sm text-slate-600 mb-4">
          Preview: {items?.length || 0} etiqueta{items?.length !== 1 ? 's' : ''}
        </p>
        <div
          className="bg-white mx-auto border border-slate-300 overflow-auto"
          style={{
            width: '400px',
            height: '500px',
            transform: 'scale(0.4)',
            transformOrigin: 'top left',
          }}
        >
          <LabelSheet items={items} config={config} />
        </div>
      </div>

      {/* Labels for Printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #label-generator, #label-generator * {
            visibility: visible;
          }
          #label-generator {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>

      <div id="label-generator">
        <LabelSheet items={items} config={config} />
      </div>
    </div>
  );
}

function LabelSheet({ items, config }) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    4: 'grid-cols-4',
  };

  return (
    <div
      style={{
        width: config.width,
        height: config.height,
        padding: config.padding,
      }}
      className={cn(
        'grid',
        gridCols[config.cols],
        'gap-[' + config.gap + ']',
        'print:gap-0'
      )}
    >
      {items?.map((item, index) => (
        <div
          key={index}
          style={{
            width: config.itemWidth,
            height: config.itemHeight,
            padding: config.padding,
          }}
          className="label-item border border-gray-400 flex flex-col print:border print:border-black print:rounded-none print:p-1 overflow-hidden"
        >
          <div className="flex items-start gap-2 flex-1">
            <div className="flex-shrink-0">
              <QRCodeSVG
                value={item.product_sku}
                size={config.qrSize}
                level="M"
                className="border border-gray-300 p-0.5"
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-start">
              <p className={cn('font-mono font-bold text-gray-900 break-words leading-tight', config.fontSize)}>
                {item.product_sku}
              </p>
              <p className={cn('font-medium text-gray-700 break-words leading-tight mt-0.5', config.fontSize)}>
                {item.product_name?.substring(0, 30)}
              </p>
              <div className={cn('space-y-0.5 mt-1', config.fontSize)}>
                <p className="text-gray-600">
                  Q: <span className="font-semibold">{item.qty}</span>
                </p>
                {item.warehouse_name && (
                  <p className="text-gray-600 truncate">
                    D: <span className="font-semibold">{item.warehouse_name?.substring(0, 15)}</span>
                  </p>
                )}
                {item.location_barcode && (
                  <p className="text-gray-600 truncate">
                    L: <span className="font-semibold">{item.location_barcode?.substring(0, 12)}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}