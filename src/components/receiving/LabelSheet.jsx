import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function LabelSheet({ items }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="print:hidden mb-4">
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Imprimir Etiquetas
        </button>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #label-sheet, #label-sheet * {
            visibility: visible;
          }
          #label-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .label-item {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      <div id="label-sheet" className="grid grid-cols-2 gap-4 print:gap-2">
        {items?.map((item, index) => (
          <div
            key={index}
            className="label-item border-2 border-slate-300 rounded-lg p-4 print:border-black print:rounded-none"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <QRCodeSVG
                  value={item.product_sku}
                  size={80}
                  level="M"
                  className="border-2 border-slate-200 p-1"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-lg font-bold text-slate-900 break-words">
                  {item.product_sku}
                </p>
                <p className="text-sm font-medium text-slate-700 mt-1 break-words">
                  {item.product_name}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-slate-500">
                    Qtd: <span className="font-semibold text-slate-700">{item.qty}</span>
                  </p>
                  {item.warehouse_name && (
                    <p className="text-xs text-slate-500">
                      Destino: <span className="font-semibold text-slate-700">{item.warehouse_name}</span>
                    </p>
                  )}
                  {item.location_barcode && (
                    <p className="text-xs text-slate-500">
                      Local: <span className="font-semibold text-slate-700">{item.location_barcode}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}