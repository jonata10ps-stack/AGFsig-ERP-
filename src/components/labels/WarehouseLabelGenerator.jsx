import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Search, X } from 'lucide-react';
import { LABEL_SIZES } from './labelSizes';
import { cn } from '@/lib/utils';

export default function WarehouseLabelGenerator({ companyId }) {
  const [selectedSize, setSelectedSize] = useState('a4_4x6');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouses, setSelectedWarehouses] = useState([]);
  const config = LABEL_SIZES[selectedSize];

  const { data: warehouses = [] } = useQuery({
    queryKey: ['label-warehouses', companyId],
    queryFn: () => base44.entities.Warehouse.filter({ company_id: companyId }, 'name', 500),
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  const filteredWarehouses = warehouses
    .filter(w => companyId && w.company_id === companyId)
    .filter(w => w.code?.includes(searchTerm) || w.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggleWarehouse = (warehouse) => {
    setSelectedWarehouses(prev => {
      const exists = prev.some(p => p.id === warehouse.id);
      if (exists) {
        return prev.filter(p => p.id !== warehouse.id);
      } else {
        return [...prev, warehouse];
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Impressão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Tamanho de etiqueta:</p>
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
            <Badge variant="outline">{config.name}</Badge>
            <Button 
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2 print:hidden"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selecione os Armazéns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por código ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {selectedWarehouses.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Selecionados ({selectedWarehouses.length})</p>
              <div className="flex flex-wrap gap-2">
                {selectedWarehouses.map(warehouse => (
                  <Badge key={warehouse.id} className="gap-2 bg-indigo-100 text-indigo-700 cursor-pointer"
                    onClick={() => toggleWarehouse(warehouse)}
                  >
                    {warehouse.code}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredWarehouses.map(warehouse => {
              const isSelected = selectedWarehouses.some(p => p.id === warehouse.id);
              return (
                <div
                  key={warehouse.id}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                  onClick={() => toggleWarehouse(warehouse)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => {}}
                      className="cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{warehouse.code}</p>
                      <p className="text-sm text-slate-500">{warehouse.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{warehouse.type}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <style>{`
        @page {
          size: ${config.width} ${config.height};
          margin: 0;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #label-sheet, #label-sheet * {
            visibility: visible;
          }
          #label-sheet {
            position: fixed;
            left: 0;
            top: 0;
            width: ${config.width};
            height: ${config.height};
            margin: 0;
            padding: 0;
          }
        }
      `}</style>

      <div id="label-sheet">
        <LabelSheet items={selectedWarehouses} config={config} />
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
          <div className="flex items-start gap-2 flex-1 justify-center">
            <div className="flex-shrink-0">
              <QRCodeSVG
                value={item.code}
                size={config.qrSize}
                level="M"
                className="border border-gray-300 p-0.5"
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className={cn('font-mono font-bold text-gray-900 break-words leading-tight', config.fontSize)}>
                {item.code}
              </p>
              <p className={cn('font-medium text-gray-700 break-words leading-tight mt-0.5', config.fontSize)}>
                {item.name?.substring(0, 35)}
              </p>
              {item.type && (
                <p className={cn('text-gray-600 leading-tight mt-1', config.fontSize)}>
                  {item.type}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}