import React, { useState } from 'react';
import { Plus, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const TIPO_LABELS = {
  ENTRADA: { label: 'Entrada', color: 'bg-blue-100 text-blue-700' },
  PARCELA: { label: 'Parcela', color: 'bg-indigo-100 text-indigo-700' },
  SALDO: { label: 'Saldo', color: 'bg-amber-100 text-amber-700' },
};

const defaultParcela = () => ({ tipo: 'PARCELA', percentual: '', dias: '', descricao: '' });

export default function PaymentConditionForm({ condition, onSave, onCancel, loading }) {
  const [form, setForm] = useState(() => ({
    code: condition?.code || '',
    name: condition?.name || '',
    description: condition?.description || '',
    discount_percentage: condition?.discount_percentage ?? 0,
    interest_percentage: condition?.interest_percentage ?? 0,
    active: condition?.active ?? true,
    parcelas: condition?.parcelas?.length
      ? condition.parcelas.map(p => ({ ...p }))
      : [{ tipo: 'PARCELA', percentual: 100, dias: 30, descricao: '' }],
  }));

  const totalPercentual = form.parcelas.reduce((s, p) => s + (parseFloat(p.percentual) || 0), 0);

  const addParcela = (tipo = 'PARCELA') => {
    setForm(f => ({ ...f, parcelas: [...f.parcelas, { tipo, percentual: '', dias: '', descricao: '' }] }));
  };

  const removeParcela = (idx) => {
    setForm(f => ({ ...f, parcelas: f.parcelas.filter((_, i) => i !== idx) }));
  };

  const updateParcela = (idx, field, value) => {
    setForm(f => {
      const parcelas = f.parcelas.map((p, i) => i === idx ? { ...p, [field]: value } : p);
      return { ...f, parcelas };
    });
  };

  const handleQuickFill = (tipo) => {
    if (tipo === 'avista') {
      setForm(f => ({ ...f, parcelas: [{ tipo: 'PARCELA', percentual: 100, dias: 0, descricao: 'À vista' }] }));
    } else if (tipo === 'entrada30') {
      setForm(f => ({ ...f, parcelas: [
        { tipo: 'ENTRADA', percentual: 30, dias: 0, descricao: 'Entrada' },
        { tipo: 'SALDO', percentual: 70, dias: 30, descricao: 'Saldo' },
      ]}));
    } else if (tipo === '3x') {
      setForm(f => ({ ...f, parcelas: [
        { tipo: 'PARCELA', percentual: 33.33, dias: 30, descricao: '1ª parcela' },
        { tipo: 'PARCELA', percentual: 33.33, dias: 60, descricao: '2ª parcela' },
        { tipo: 'PARCELA', percentual: 33.34, dias: 90, descricao: '3ª parcela' },
      ]}));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      toast.error('Preencha código e nome');
      return;
    }
    if (form.parcelas.length === 0) {
      toast.error('Adicione ao menos uma parcela');
      return;
    }
    const invalid = form.parcelas.some(p => !p.percentual || p.dias === '' || p.dias === undefined);
    if (invalid) {
      toast.error('Preencha percentual e dias de todas as parcelas');
      return;
    }
    if (Math.abs(totalPercentual - 100) > 0.1) {
      toast.error(`O total dos percentuais deve ser 100%. Atual: ${totalPercentual.toFixed(2)}%`);
      return;
    }
    onSave({ ...form, parcelas: form.parcelas.map(p => ({ ...p, percentual: parseFloat(p.percentual), dias: parseInt(p.dias) })) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Código *</Label>
          <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="Ex: CP001" />
        </div>
        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Entrada + 30 dias" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição opcional" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Desconto (%)</Label>
          <Input type="number" min="0" max="100" step="0.01" value={form.discount_percentage}
            onChange={e => setForm(f => ({ ...f, discount_percentage: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div className="space-y-2">
          <Label>Juros (% a.m.)</Label>
          <Input type="number" min="0" max="100" step="0.01" value={form.interest_percentage}
            onChange={e => setForm(f => ({ ...f, interest_percentage: parseFloat(e.target.value) || 0 }))} />
        </div>
      </div>

      {/* Atalhos */}
      <div className="space-y-2">
        <Label>Atalhos</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => handleQuickFill('avista')}>À vista</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleQuickFill('entrada30')}>Entrada 30% + Saldo 30d</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleQuickFill('3x')}>3x mensal</Button>
        </div>
      </div>

      {/* Parcelas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Parcelas</Label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addParcela('ENTRADA')}>+ Entrada</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addParcela('PARCELA')}>+ Parcela</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addParcela('SALDO')}>+ Saldo</Button>
          </div>
        </div>

        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-2 text-xs font-medium text-slate-500">
            <div className="col-span-3">Tipo</div>
            <div className="col-span-3">% do Total</div>
            <div className="col-span-3">Dias (venc.)</div>
            <div className="col-span-2">Descrição</div>
            <div className="col-span-1"></div>
          </div>

          {form.parcelas.map((p, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-lg p-2">
              <div className="col-span-3">
                <Select value={p.tipo} onValueChange={v => updateParcela(idx, 'tipo', v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTRADA">Entrada</SelectItem>
                    <SelectItem value="PARCELA">Parcela</SelectItem>
                    <SelectItem value="SALDO">Saldo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <div className="relative">
                  <Input
                    type="number" min="0" max="100" step="0.01"
                    className="h-8 text-xs pr-6"
                    value={p.percentual}
                    onChange={e => updateParcela(idx, 'percentual', e.target.value)}
                    placeholder="0"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                </div>
              </div>
              <div className="col-span-3">
                <div className="relative">
                  <Input
                    type="number" min="0"
                    className="h-8 text-xs pr-6"
                    value={p.dias}
                    onChange={e => updateParcela(idx, 'dias', e.target.value)}
                    placeholder="0"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">d</span>
                </div>
              </div>
              <div className="col-span-2">
                <Input
                  className="h-8 text-xs"
                  value={p.descricao}
                  onChange={e => updateParcela(idx, 'descricao', e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="col-span-1 flex justify-center">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600"
                  onClick={() => removeParcela(idx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Total indicator */}
        <div className={`flex items-center justify-between px-2 py-2 rounded-lg text-sm font-medium ${Math.abs(totalPercentual - 100) <= 0.1 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <span className="flex items-center gap-1">
            {Math.abs(totalPercentual - 100) > 0.1 && <AlertCircle className="h-4 w-4" />}
            Total dos percentuais:
          </span>
          <span>{totalPercentual.toFixed(2)}% {Math.abs(totalPercentual - 100) <= 0.1 ? '✓' : '(deve ser 100%)'}</span>
        </div>
      </div>

      {/* Preview */}
      {form.parcelas.length > 0 && Math.abs(totalPercentual - 100) <= 0.1 && (
        <div className="bg-slate-50 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-600">Preview (sobre R$ 10.000,00):</p>
          <div className="space-y-1">
            {form.parcelas.map((p, idx) => {
              const valor = (parseFloat(p.percentual) || 0) / 100 * 10000;
              const conf = TIPO_LABELS[p.tipo] || TIPO_LABELS.PARCELA;
              return (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <Badge className={`text-xs px-1.5 py-0 ${conf.color}`}>{conf.label}</Badge>
                  <span className="text-slate-500">{p.dias === 0 || p.dias === '0' ? 'No ato' : `${p.dias} dias`}</span>
                  <span className="font-medium">R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  {p.descricao && <span className="text-slate-400">— {p.descricao}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
      </DialogFooter>
    </form>
  );
}