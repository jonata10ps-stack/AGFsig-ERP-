import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Warehouse, MapPin, Factory, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import ProductLabelGenerator from '@/components/labels/ProductLabelGenerator';
import WarehouseLabelGenerator from '@/components/labels/WarehouseLabelGenerator';
import LocationLabelGenerator from '@/components/labels/LocationLabelGenerator';
import ProductionOrderLabelGenerator from '@/components/labels/ProductionOrderLabelGenerator';
import { useCompanyId } from '@/components/useCompanyId';

const LABEL_TYPES = [
  { id: 'product', name: 'Produto', icon: Package, description: 'Etiquetas de produtos' },
  { id: 'warehouse', name: 'Armazém', icon: Warehouse, description: 'Etiquetas de armazém' },
  { id: 'location', name: 'Localização', icon: MapPin, description: 'Etiquetas de localização' },
  { id: 'op', name: 'Ordem de Produção', icon: Factory, description: 'Etiquetas de OP' },
];

export default function LabelGeneratorPage() {
  const navigate = useNavigate();
  const { companyId, loading: companyLoading } = useCompanyId();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gerador de Etiquetas</h1>
          <p className="text-slate-600 mt-1">Crie e personalize etiquetas para seus itens</p>
        </div>
      </div>

      {/* Tipos de Etiqueta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LABEL_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <Card key={type.id} className="hover:border-indigo-300 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Icon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{type.name}</CardTitle>
                    <p className="text-sm text-slate-500">{type.description}</p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Abas de Conteúdo */}
      <Tabs defaultValue="product" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="product">Produto</TabsTrigger>
          <TabsTrigger value="warehouse">Armazém</TabsTrigger>
          <TabsTrigger value="location">Localização</TabsTrigger>
          <TabsTrigger value="op">OP</TabsTrigger>
        </TabsList>

        <TabsContent value="product" className="space-y-6">
          {!companyLoading && companyId && <ProductLabelGenerator key={companyId} companyId={companyId} />}
        </TabsContent>

        <TabsContent value="warehouse" className="space-y-6">
          {!companyLoading && companyId && <WarehouseLabelGenerator key={companyId} companyId={companyId} />}
        </TabsContent>

        <TabsContent value="location" className="space-y-6">
          {!companyLoading && companyId && <LocationLabelGenerator key={companyId} companyId={companyId} />}
        </TabsContent>

        <TabsContent value="op" className="space-y-6">
          {!companyLoading && companyId && <ProductionOrderLabelGenerator key={companyId} companyId={companyId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}