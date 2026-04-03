import React, { useState, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SerialNumberInput({ item, order, onClose, onSuccess }) {
  const queryClient = useQueryClient();

  const { data: existingSerials = [], isLoading } = useQuery({
    queryKey: ['serial-numbers', order.id, item.product_id],
    queryFn: () => base44.entities.SerialNumber.filter({ 
      order_id: order.id,
      product_id: item.product_id
    })
  });

  const [serialNumbers, setSerialNumbers] = useState(
    Array(item.qty).fill('').map(() => ({ serial: '', captured: false, isSavedInDB: false }))
  );

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && existingSerials.length > 0) {
      setSerialNumbers(prev => {
        const newSerials = [...prev];
        existingSerials.forEach((s, i) => {
          if (i < newSerials.length) {
            newSerials[i] = { serial: s.serial_number, captured: true, isSavedInDB: true };
          }
        });
        return newSerials;
      });
    }
  }, [existingSerials, isLoading]);

  const handleSerialChange = (index, value) => {
    const newSerials = [...serialNumbers];
    newSerials[index].serial = value;
    setSerialNumbers(newSerials);
  };

  const handleAddSerial = (index) => {
    if (!serialNumbers[index].serial.trim()) {
      toast.error('Informe o número de série');
      return;
    }
    const newSerials = [...serialNumbers];
    newSerials[index].captured = true;
    setSerialNumbers(newSerials);
  };

  const handleRemoveSerial = (index) => {
    const newSerials = [...serialNumbers];
    newSerials[index] = { serial: '', captured: false, isSavedInDB: false };
    setSerialNumbers(newSerials);
  };

  const handleSaveAll = async () => {
    const allCaptured = serialNumbers.every(s => s.captured);
    if (!allCaptured) {
      toast.error('Capture todos os números de série antes de salvar');
      return;
    }

    setSaving(true);
    try {
      // Criar registro de SerialNumber para cada série (apenas as novas)
      for (const serial of serialNumbers) {
        if (serial.isSavedInDB) continue;
        
        await base44.entities.SerialNumber.create({
          company_id: order.company_id,
          serial_number: serial.serial,
          product_id: item.product_id,
          product_sku: item.product_sku,
          product_name: item.product_name,
          client_id: order.client_id,
          client_name: order.client_name,
          order_id: order.id,
          order_number: order.order_number,
          sale_date: new Date().toISOString().split('T')[0],
          warranty_months: 12,
          status: 'VENDIDO',
        });
      }

      // Os seriais (tabela SerialNumber) já garantem o lastro histórico, não há necessidade
      // de salvar uma cópia redundante (string) na tabela SalesOrderItem.

      queryClient.invalidateQueries({ queryKey: ['serial-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['order-items-shipping'] });
      toast.success('Números de série salvos com sucesso!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar números de série:', error);
      toast.error('Erro ao salvar: ' + (error?.message || 'Verifique o console'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-96 overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Números de Série</h3>
              <p className="text-sm text-slate-600 mt-1">
                {item.product_name} - Quantidade: {item.qty}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3">
            {serialNumbers.map((s, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600 w-8">
                  {index + 1}.
                </span>
                {!s.captured ? (
                  <>
                    <Input
                      placeholder={`Número de série ${index + 1}`}
                      value={s.serial}
                      onChange={(e) => handleSerialChange(index, e.target.value)}
                      className="flex-1"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSerial(index)}
                      autoFocus={index === 0}
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAddSerial(index)}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                      <p className="text-sm font-mono text-emerald-700">{s.serial}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveSerial(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-6">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              Salvar Todos
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}