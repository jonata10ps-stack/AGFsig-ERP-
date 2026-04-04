import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calculator, Package, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function RecalculateProductBalance() {
  const [sku, setSku] = useState('');
  const [result, setResult] = useState(null);

  const recalculateMutation = useMutation({
    mutationFn: async (productSku) => {
      toast.info('Recalculando saldo...');
      
      // Buscar produto
      const products = await base44.entities.Product.filter({ sku: productSku });
      if (!products || products.length === 0) {
        throw new Error('Produto não encontrado');
      }
      const product = products[0];

      // Buscar armazém PROD-01
      const warehouses = await base44.entities.Warehouse.filter({ code: 'PROD-01' });
      const prodWarehouse = warehouses?.[0];
      
      if (!prodWarehouse) {
        throw new Error('Armazém PROD-01 não encontrado');
      }

      // Buscar todos os movimentos deste produto
      const allMoves = await base44.entities.InventoryMove.list();
      const productMoves = allMoves.filter(m => m.product_id === product.id);

      // Calcular saldo por tipo de movimento
      let entradas = 0;
      let saidas = 0;
      let consumos = 0;
      let producoes = 0;
      let transferenciasEntrada = 0;
      let transferenciasSaida = 0;

      const movesByWarehouse = {};

      productMoves.forEach(move => {
        const warehouseId = move.warehouse_id;
        if (!movesByWarehouse[warehouseId]) {
          movesByWarehouse[warehouseId] = { entradas: 0, saidas: 0, saldo: 0 };
        }

        if (['ENTRADA', 'PRODUCAO_ENTRADA', 'PRODUCAO_REVERSO', 'ESTORNO'].includes(move.type)) {
          movesByWarehouse[warehouseId].entradas += move.qty;
          if (move.type === 'ENTRADA') entradas += move.qty;
          if (move.type === 'PRODUCAO_ENTRADA') producoes += move.qty;
          if (['PRODUCAO_REVERSO', 'ESTORNO'].includes(move.type)) entradas += move.qty; // Log as equivalent to entry
        } else if (['SAIDA', 'PRODUCAO_CONSUMO', 'BAIXA'].includes(move.type)) {
          movesByWarehouse[warehouseId].saidas += move.qty;
          saidas += move.qty;
        } else if (move.type === 'CONSUMO_OP') {
          movesByWarehouse[warehouseId].saidas += move.qty;
          consumos += move.qty;
        } else if (move.type === 'TRANSFERENCIA') {
          // Transferência é saída do armazém
          movesByWarehouse[warehouseId].saidas += move.qty;
          transferenciasSaida += move.qty;
          
          // Se tem destino, adiciona entrada no destino
          if (move.to_warehouse_id) {
            if (!movesByWarehouse[move.to_warehouse_id]) {
              movesByWarehouse[move.to_warehouse_id] = { entradas: 0, saidas: 0, saldo: 0 };
            }
            movesByWarehouse[move.to_warehouse_id].entradas += move.qty;
            transferenciasEntrada += move.qty;
          }
        }
      });

      // Calcular saldo por armazém
      const warehouseBalances = [];
      for (const [warehouseId, data] of Object.entries(movesByWarehouse)) {
        const saldo = data.entradas - data.saidas;
        data.saldo = saldo;

        const wh = await base44.entities.Warehouse.filter({ id: warehouseId });
        const warehouseName = wh?.[0]?.name || warehouseId;

        warehouseBalances.push({
          warehouse_id: warehouseId,
          warehouse_name: warehouseName,
          entradas: data.entradas,
          saidas: data.saidas,
          saldo: saldo
        });

        // Atualizar saldo no banco
        const existingBalances = await base44.entities.StockBalance.filter({
          product_id: product.id,
          warehouse_id: warehouseId
        });

        if (existingBalances && existingBalances.length > 0) {
          await base44.entities.StockBalance.update(existingBalances[0].id, {
            qty: saldo
          });
        } else if (saldo > 0) {
          await base44.entities.StockBalance.create({
            product_id: product.id,
            product_sku: product.sku,
            product_name: product.name,
            warehouse_id: warehouseId,
            warehouse_name: warehouseName,
            qty: saldo,
            qty_available: 0
          });
        }
      }

      const totalEntradas = entradas + producoes + transferenciasEntrada;
      const totalSaidas = saidas + consumos + transferenciasSaida;
      const saldoTotal = totalEntradas - totalSaidas;

      return {
        product,
        totalEntradas,
        totalSaidas,
        saldoTotal,
        entradas,
        saidas,
        consumos,
        producoes,
        transferenciasEntrada,
        transferenciasSaida,
        warehouseBalances,
        totalMoves: productMoves.length
      };
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Saldo recalculado com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Dashboard')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recalcular Saldo de Produto</h1>
          <p className="text-sm text-slate-500">Recalcula o saldo baseado nos movimentos de inventário</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Recalcular Saldo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>SKU do Produto</Label>
            <div className="flex gap-2">
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ex: EC10"
                className="flex-1"
              />
              <Button 
                onClick={() => recalculateMutation.mutate(sku)}
                disabled={!sku || recalculateMutation.isPending}
              >
                {recalculateMutation.isPending ? 'Recalculando...' : 'Recalcular'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {result.product.name} ({result.product.sku})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600">Total Entradas</p>
                  <p className="text-2xl font-bold text-green-700">{result.totalEntradas}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-600">Total Saídas</p>
                  <p className="text-2xl font-bold text-red-700">{result.totalSaidas}</p>
                </div>
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <p className="text-sm text-indigo-600">Saldo Total</p>
                  <p className="text-2xl font-bold text-indigo-700">{result.saldoTotal}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600">Movimentos</p>
                  <p className="text-2xl font-bold text-slate-700">{result.totalMoves}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 mb-1">Entradas</p>
                  <p className="text-lg font-bold text-blue-700">{result.entradas}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-600 mb-1">Saídas</p>
                  <p className="text-lg font-bold text-amber-700">{result.saidas}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-600 mb-1">Consumos OP</p>
                  <p className="text-lg font-bold text-purple-700">{result.consumos}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-xs text-emerald-600 mb-1">Produções</p>
                  <p className="text-lg font-bold text-emerald-700">{result.producoes}</p>
                </div>
                <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                  <p className="text-xs text-cyan-600 mb-1">Transf. Entrada</p>
                  <p className="text-lg font-bold text-cyan-700">{result.transferenciasEntrada}</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                  <p className="text-xs text-rose-600 mb-1">Transf. Saída</p>
                  <p className="text-lg font-bold text-rose-700">{result.transferenciasSaida}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saldo por Armazém</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.warehouseBalances.map((wh, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium">{wh.warehouse_name}</p>
                      <p className="text-sm text-slate-500">
                        Entradas: {wh.entradas} | Saídas: {wh.saidas}
                      </p>
                    </div>
                    <Badge 
                      className={wh.saldo > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}
                    >
                      Saldo: {wh.saldo}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}