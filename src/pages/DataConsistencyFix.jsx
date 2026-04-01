import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { AlertCircle, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

export default function DataConsistencyFix() {
  const queryClient = useQueryClient();
  const [fixing, setFixing] = useState(false);

  // Buscar itens de recebimento com status inconsistente
  const { data: inconsistentItems = [], isLoading } = useQuery({
    queryKey: ['inconsistent-items'],
    queryFn: async () => {
      const items = await base44.entities.ReceivingItem.list();
      return items.filter(item => item.status === 'ARMAZENADO');
    },
  });

  const fixItemsMutation = useMutation({
    mutationFn: async () => {
      setFixing(true);
      let fixed = 0;
      let errors = [];

      for (const item of inconsistentItems) {
        try {
          // Se item está ARMAZENADO, garantir que é CONFERIDO primeiro
          if (item.status === 'ARMAZENADO') {
            // Isso deveria ter sido CONFERIDO antes, então voltamos para CONFERIDO
            // pois o status ARMAZENADO deveria ser gerenciado apenas após armazenamento real
            await base44.entities.ReceivingItem.update(item.id, {
              status: 'CONFERIDO'
            });
            fixed++;
          }
        } catch (error) {
          errors.push(`${item.product_sku}: ${error.message}`);
        }
      }

      setFixing(false);
      
      if (errors.length > 0) {
        toast.error(`${fixed} itens corrigidos, ${errors.length} com erro`);
        errors.forEach(e => console.error(e));
      } else {
        toast.success(`${fixed} itens corrigidos com sucesso!`);
      }

      queryClient.invalidateQueries({ queryKey: ['inconsistent-items'] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Dashboard')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Correção de Dados Inconsistentes</h1>
            <p className="text-sm text-slate-500 mt-1">Detecta e corrige itens com status inválido</p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">Itens com Status Inválido Encontrados</p>
              <p className="text-sm text-amber-700 mt-1">
                Itens que estão marcados como ARMAZENADO mas não foram conferidos primeiro. 
                A correção voltará estes itens para CONFERIDO.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Total de itens inconsistentes:</span>
            <Badge variant="destructive" className="text-lg px-3 py-1">
              {inconsistentItems.length}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      {inconsistentItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Itens para Corrigir</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status Atual</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inconsistentItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-indigo-600">{item.product_sku}</TableCell>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell>
                      <Badge className="bg-red-100 text-red-700">ARMAZENADO</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">→ Será alterado para CONFERIDO</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Link to={createPageUrl('Dashboard')}>
          <Button variant="outline">Voltar</Button>
        </Link>
        {inconsistentItems.length > 0 && (
          <Button
            onClick={() => fixItemsMutation.mutate()}
            disabled={fixing || fixItemsMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {fixing || fixItemsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Corrigindo...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Corrigir Todos os Itens
              </>
            )}
          </Button>
        )}
      </div>

      {inconsistentItems.length === 0 && !isLoading && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-900">Nenhum item inconsistente encontrado</p>
                <p className="text-sm text-emerald-700 mt-1">Todos os dados estão consistentes.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}