import React, { useState, useEffect } from 'react';
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

export default function ProductLabelGenerator({ companyId }) {
  const [selectedSize, setSelectedSize] = useState('a4_4x6');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const config = LABEL_SIZES[selectedSize];

  // Limpa seleção ao trocar de empresa
  React.useEffect(() => {
    setSelectedProducts([]);
    setSearchTerm('');
  }, [companyId]);

  const { data: products = [] } = useQuery({
    queryKey: ['label-products', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const PAGE = 5000;
      let all = [];
      let skip = 0;
      while (true) {
        const page = await base44.entities.Product.filter({ company_id: companyId }, 'name', PAGE, skip);
        if (!page || page.length === 0) break;
        all = all.concat(page);
        if (page.length < PAGE) break;
        skip += PAGE;
      }
      return all;
    },
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  const filteredProducts = products
    .filter(p => p.company_id === companyId)
    .filter(p =>
      searchTerm === '' ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (!searchTerm) return 0;
      const term = searchTerm.toLowerCase();
      const skuA = (a.sku || '').toLowerCase();
      const skuB = (b.sku || '').toLowerCase();
      if (skuA === term && skuB !== term) return -1;
      if (skuB === term && skuA !== term) return 1;
      return skuA.length - skuB.length;
    });

  const toggleProduct = (product) => {
    setSelectedProducts(prev => {
      const exists = prev.some(p => p.id === product.id);
      if (exists) {
        return prev.filter(p => p.id !== product.id);
      } else {
        return [...prev, product];
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Tamanho */}
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

      {/* Busca e Seleção de Produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Selecione os Produtos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por SKU ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {selectedProducts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Selecionados ({selectedProducts.length})</p>
              <div className="flex flex-wrap gap-2">
                {selectedProducts.map(product => (
                  <Badge key={product.id} className="gap-2 bg-indigo-100 text-indigo-700 cursor-pointer"
                    onClick={() => toggleProduct(product)}
                  >
                    {product.sku}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredProducts.map(product => {
              const isSelected = selectedProducts.some(p => p.id === product.id);
              return (
                <div
                  key={product.id}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                  onClick={() => toggleProduct(product)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => {}}
                      className="cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{product.sku}</p>
                      <p className="text-sm text-slate-500">{product.name}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Etiquetas para Impressão */}
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
        <LabelSheet items={selectedProducts} config={config} />
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
          <div className="flex items-start gap-2 flex-1">
            <div className="flex-shrink-0">
              <QRCodeSVG
                value={item.sku}
                size={config.qrSize}
                level="M"
                className="border border-gray-300 p-0.5"
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-start">
              <p className={cn('font-mono font-bold text-gray-900 break-words leading-tight', config.fontSize)}>
                {item.sku}
              </p>
              <p className={cn('font-medium text-gray-700 break-words leading-tight mt-0.5', config.fontSize)}>
                {item.name?.substring(0, 35)}
              </p>
              {item.category && (
                <p className={cn('text-gray-600 leading-tight mt-1', config.fontSize)}>
                  Cat: <span className="font-semibold">{item.category}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}