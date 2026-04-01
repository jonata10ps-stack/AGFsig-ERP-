import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ERPSyncPanel from '@/components/erp/ERPSyncPanel';

export default function ERPIntegration() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Dashboard')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Integração com ERP</h1>
          <p className="text-slate-500 mt-1">Sincronize dados bidireccionalmente com o ERP</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">Sincronize catálogo de produtos com códigos SKU e preços</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">Mantenha dados de clientes consistentes entre sistemas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos & OPs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">OPs criadas no app aparecem no ERP e vice-versa</p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Panel */}
      <ERPSyncPanel />
    </div>
  );
}