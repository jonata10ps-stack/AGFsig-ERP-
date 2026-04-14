import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Zap,
  AlertTriangle, CheckCircle, Plus, Edit2, Trash2,
  BarChart3, Target, Activity, Calculator, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const fmt = (v, decimals = 2) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtMoney = (v) =>
  'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color, trend }) {
  return (
    <div className={`relative bg-white/[0.03] border border-white/10 rounded-2xl p-5 overflow-hidden group hover:border-${color}-500/40 transition-all duration-300`}>
      <div className={`absolute inset-0 bg-gradient-to-br from-${color}-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <div className={`p-2 bg-${color}-500/10 rounded-xl`}>
            <Icon className={`h-4 w-4 text-${color}-400`} />
          </div>
        </div>
        <p className={`text-2xl font-black text-${color}-400`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-1 font-semibold">{sub}</p>}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-[10px] font-bold ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}% vs mês anterior
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Entry Form ──────────────────────────────────────────────────────────────
function EntryForm({ entry, companyId, onClose, onSaved }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [form, setForm] = useState(entry || {
    year: currentYear,
    month: currentMonth,
    // Faturamento
    revenue: 0,
    // Custos variáveis
    variable_costs: 0,
    // Custos fixos
    fixed_costs: 0,
    // Custo fabril
    manufacturing_cost: 0,
    // MOD - Mão de Obra Direta
    mod_salaries: 0,
    mod_charges: 0,
    mod_benefits: 0,
    mod_overtime: 0,
    // Horas e produção
    total_hours_worked: 0,
    workers_count: 0,
    units_produced: 0,
    // Observações
    notes: ''
  });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: parseFloat(value) || value }));

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data, company_id: companyId };
      if (entry?.id) {
        return base44.entities.CostEntry.update(entry.id, payload);
      }
      return base44.entities.CostEntry.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-entries', companyId] });
      toast.success(entry?.id ? 'Lançamento atualizado!' : 'Lançamento registrado!');
      onSaved?.();
    },
    onError: () => toast.error('Erro ao salvar lançamento')
  });

  const Field = ({ label, field, prefix = '', hint = '' }) => (
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{label}</label>
      {hint && <p className="text-[9px] text-slate-600 mb-1">{hint}</p>}
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">{prefix}</span>}
        <input
          type="number"
          className={`w-full bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all py-2.5 ${prefix ? 'pl-8 pr-3' : 'px-3'}`}
          value={form[field]}
          onChange={e => set(field, e.target.value)}
          step="0.01"
          min="0"
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1117] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#0D1117] border-b border-white/10 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-white">
              {entry?.id ? 'Editar Lançamento' : 'Novo Lançamento de Custos'}
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Os KPIs são gerados automaticamente</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Período */}
          <div>
            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-indigo-500 rounded-full" /> Período
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Mês</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/50 px-3 py-2.5"
                  value={form.month}
                  onChange={e => set('month', parseInt(e.target.value))}
                >
                  {MONTHS.map((m, i) => <option key={i} value={i + 1} className="bg-[#0D1117]">{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Ano</label>
                <input
                  type="number"
                  className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/50 px-3 py-2.5"
                  value={form.year}
                  onChange={e => set('year', parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Faturamento e Custos */}
          <div>
            <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-emerald-500 rounded-full" /> Faturamento e Custos
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Faturamento Bruto" field="revenue" prefix="R$" />
              <Field label="Custo Fabril Total" field="manufacturing_cost" prefix="R$" hint="Custo total da produção no período" />
              <Field label="Custos Variáveis" field="variable_costs" prefix="R$" hint="Matéria-prima, embalagem, comissões" />
              <Field label="Custos Fixos" field="fixed_costs" prefix="R$" hint="Aluguel, luz, seguros, adm. fixa" />
            </div>
          </div>

          {/* MOD - Mão de Obra Direta */}
          <div>
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-amber-500 rounded-full" /> Mão de Obra Direta (MOD)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Salários (MOD)" field="mod_salaries" prefix="R$" />
              <Field label="Encargos Sociais" field="mod_charges" prefix="R$" hint="INSS, FGTS, IRRF, RAT, etc." />
              <Field label="Benefícios" field="mod_benefits" prefix="R$" hint="VT, VR, plano de saúde, etc." />
              <Field label="Horas Extras" field="mod_overtime" prefix="R$" />
            </div>
          </div>

          {/* Produtividade */}
          <div>
            <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded-full" /> Produtividade e Volume
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Nº de Colaboradores (MOD)" field="workers_count" />
              <Field label="Horas Trabalhadas (Total)" field="total_hours_worked" hint="Soma de todas as horas do período" />
              <Field label="Unidades Produzidas" field="units_produced" />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Observações</label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/50 px-3 py-2.5 resize-none"
              rows={3}
              placeholder="Informações adicionais sobre este período..."
              value={form.notes || ''}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#0D1117] border-t border-white/10 p-6 flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-white border border-white/10 rounded-xl transition-all hover:border-white/30">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            className="px-6 py-2.5 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar Lançamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#161B22] border border-white/10 rounded-xl p-3 shadow-xl">
      <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-bold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? fmtMoney(p.value) : fmt(p.value) + (p.name?.includes('%') ? '%' : '')}
        </p>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CostManagement() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Buscar lançamentos
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['cost-entries', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('CostEntry')
        .select('*')
        .eq('company_id', companyId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CostEntry.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-entries', companyId] });
      toast.success('Lançamento excluído');
    }
  });

  // Filtrar por ano selecionado
  const yearEntries = useMemo(() =>
    entries.filter(e => e.year === selectedYear).sort((a, b) => a.month - b.month),
    [entries, selectedYear]
  );

  // Dados do último mês disponível
  const lastEntry = useMemo(() => yearEntries[yearEntries.length - 1] || null, [yearEntries]);

  // KPIs do último mês
  const kpis = useMemo(() => {
    if (!lastEntry) return null;
    const { revenue, variable_costs, fixed_costs, manufacturing_cost, mod_salaries, mod_charges, mod_benefits, mod_overtime, total_hours_worked, units_produced, workers_count } = lastEntry;

    const totalMOD = (mod_salaries || 0) + (mod_charges || 0) + (mod_benefits || 0) + (mod_overtime || 0);
    const totalCosts = (variable_costs || 0) + (fixed_costs || 0);
    const grossMargin = revenue > 0 ? ((revenue - (variable_costs || 0)) / revenue) * 100 : 0;
    const netMargin = revenue > 0 ? ((revenue - totalCosts) / revenue) * 100 : 0;
    const breakEven = grossMargin > 0 ? (fixed_costs || 0) / (grossMargin / 100) : 0;
    const fixedAbsorption = units_produced > 0 ? (fixed_costs || 0) / units_produced : 0;
    const costPerHour = total_hours_worked > 0 ? totalMOD / total_hours_worked : 0;
    const unitsPerHour = total_hours_worked > 0 ? units_produced / total_hours_worked : 0;
    const modShare = manufacturing_cost > 0 ? (totalMOD / manufacturing_cost) * 100 : 0;
    const manufacturingRatio = revenue > 0 ? (manufacturing_cost / revenue) * 100 : 0;

    return {
      revenue, totalMOD, grossMargin, netMargin, breakEven,
      fixedAbsorption, costPerHour, unitsPerHour, modShare,
      manufacturingRatio, totalCosts, workers_count: workers_count || 0,
      totalHours: total_hours_worked || 0, unitsProduced: units_produced || 0
    };
  }, [lastEntry]);

  // YTD - Acumulado do ano
  const ytd = useMemo(() => {
    const totRevenue = yearEntries.reduce((s, e) => s + (e.revenue || 0), 0);
    const totMOD = yearEntries.reduce((s, e) => s + (e.mod_salaries || 0) + (e.mod_charges || 0) + (e.mod_benefits || 0) + (e.mod_overtime || 0), 0);
    const totManuf = yearEntries.reduce((s, e) => s + (e.manufacturing_cost || 0), 0);
    const totFixed = yearEntries.reduce((s, e) => s + (e.fixed_costs || 0), 0);
    const totUnits = yearEntries.reduce((s, e) => s + (e.units_produced || 0), 0);
    const totHours = yearEntries.reduce((s, e) => s + (e.total_hours_worked || 0), 0);
    return { totRevenue, totMOD, totManuf, totFixed, totUnits, totHours };
  }, [yearEntries]);

  // Chart data - últimos 12 meses
  const chartData = useMemo(() => yearEntries.map(e => {
    const totalMOD = (e.mod_salaries || 0) + (e.mod_charges || 0) + (e.mod_benefits || 0) + (e.mod_overtime || 0);
    const grossMargin = e.revenue > 0 ? ((e.revenue - (e.variable_costs || 0)) / e.revenue) * 100 : 0;
    const netMargin = e.revenue > 0 ? ((e.revenue - (e.variable_costs || 0) - (e.fixed_costs || 0)) / e.revenue) * 100 : 0;
    const breakEven = grossMargin > 0 ? (e.fixed_costs || 0) / (grossMargin / 100) : 0;
    const costPerHour = e.total_hours_worked > 0 ? totalMOD / e.total_hours_worked : 0;
    const unitsPerHour = e.total_hours_worked > 0 ? (e.units_produced || 0) / e.total_hours_worked : 0;
    return {
      month: MONTHS[(e.month || 1) - 1],
      'Faturamento': e.revenue || 0,
      'Custo Fabril': e.manufacturing_cost || 0,
      'Custos Fixos': e.fixed_costs || 0,
      'MOD Total': totalMOD,
      'Margem Bruta %': parseFloat(grossMargin.toFixed(1)),
      'Margem Líquida %': parseFloat(netMargin.toFixed(1)),
      'Break-even': breakEven,
      'Custo/Hora': parseFloat(costPerHour.toFixed(2)),
      'Un/Hora': parseFloat(unitsPerHour.toFixed(2)),
    };
  }), [yearEntries]);

  const years = [...new Set(entries.map(e => e.year))].sort((a, b) => b - a);

  return (
    <div className="bg-[#0A0C10] min-h-screen text-slate-200">
      <div className="max-w-[1800px] mx-auto p-4 lg:p-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
              <div className="w-1.5 h-8 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
              Gestão de Custos
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1 ml-4">
              Dashboard de Rentabilidade · MOD · Break-even · Absorção de Custos
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Year Selector */}
            <div className="relative">
              <select
                className="appearance-none bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/50 pl-4 pr-8 py-2.5 font-bold"
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
              >
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <option key={y} value={y} className="bg-[#0D1117]">{y}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
            <button
              onClick={() => { setEditingEntry(null); setShowForm(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-indigo-500/20"
            >
              <Plus className="h-4 w-4" /> Novo Lançamento
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10 gap-1 w-fit">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'mod', label: 'Mão de Obra (MOD)', icon: Users },
            { id: 'entries', label: 'Lançamentos', icon: Calculator },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black rounded-xl transition-all ${activeTab === t.id ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: DASHBOARD ──────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {isLoading ? (
              <div className="text-center text-slate-500 py-20">Carregando dados...</div>
            ) : yearEntries.length === 0 ? (
              <div className="text-center py-24 bg-white/[0.02] border border-white/5 rounded-3xl">
                <Calculator className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 font-bold text-lg">Nenhum dado lançado para {selectedYear}</p>
                <p className="text-slate-600 text-sm mt-2">Clique em "Novo Lançamento" para começar</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black rounded-xl transition-all"
                >
                  <Plus className="h-4 w-4 inline mr-2" />Primeiro Lançamento
                </button>
              </div>
            ) : (
              <>
                {/* Mês de referência */}
                {lastEntry && (
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    ↓ Indicadores do último período lançado —
                    <span className="text-indigo-400 ml-1">{MONTHS[(lastEntry.month || 1) - 1]}/{lastEntry.year}</span>
                  </p>
                )}

                {/* KPIs Principais */}
                {kpis && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard title="Faturamento" value={fmtMoney(kpis.revenue)} icon={DollarSign} color="emerald" />
                    <KpiCard title="Margem Bruta" value={`${fmt(kpis.grossMargin)}%`} sub="(Faturamento - Custos Variáveis)" icon={TrendingUp} color={kpis.grossMargin >= 40 ? 'emerald' : kpis.grossMargin >= 20 ? 'amber' : 'rose'} />
                    <KpiCard title="Margem Líquida" value={`${fmt(kpis.netMargin)}%`} sub="(Após custos fixos)" icon={Activity} color={kpis.netMargin >= 15 ? 'emerald' : kpis.netMargin >= 5 ? 'amber' : 'rose'} />
                    <KpiCard title="Custo Fabril / Faturamento" value={`${fmt(kpis.manufacturingRatio)}%`} sub="Peso do custo de produção" icon={BarChart3} color="blue" />
                  </div>
                )}

                {/* Break-even + Absorção */}
                {kpis && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Ponto de Equilíbrio */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Target className="h-5 w-5 text-rose-400" />
                        <h3 className="text-sm font-black text-white">Ponto de Equilíbrio (Break-even)</h3>
                      </div>
                      <p className="text-3xl font-black text-rose-400">{fmtMoney(kpis.breakEven)}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Faturamento mínimo para cobrir todos os custos fixos</p>
                      {kpis.revenue > 0 && (
                        <div className="mt-4">
                          <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                            <span>Cobertura do Break-even</span>
                            <span className={kpis.revenue >= kpis.breakEven ? 'text-emerald-400' : 'text-rose-400'}>
                              {kpis.revenue >= kpis.breakEven ? '✓ Acima do ponto' : '✗ Abaixo do ponto'}
                            </span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${kpis.revenue >= kpis.breakEven ? 'bg-emerald-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min((kpis.revenue / Math.max(kpis.breakEven, 1)) * 100, 100)}%` }}
                            />
                          </div>
                          <p className="text-[9px] text-slate-600 mt-1">
                            {kpis.revenue >= kpis.breakEven
                              ? `Superávit de ${fmtMoney(kpis.revenue - kpis.breakEven)}`
                              : `Déficit de ${fmtMoney(kpis.breakEven - kpis.revenue)}`}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Absorção de Custos Fixos */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Zap className="h-5 w-5 text-amber-400" />
                        <h3 className="text-sm font-black text-white">Absorção de Custos Fixos</h3>
                      </div>
                      <p className="text-3xl font-black text-amber-400">{fmtMoney(kpis.fixedAbsorption)}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Custo fixo por unidade produzida</p>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="bg-white/5 rounded-xl p-3">
                          <p className="text-[9px] text-slate-500 font-bold uppercase">Total Custos Fixos</p>
                          <p className="text-sm font-black text-amber-300">{fmtMoney(lastEntry?.fixed_costs || 0)}</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3">
                          <p className="text-[9px] text-slate-500 font-bold uppercase">Unidades Produzidas</p>
                          <p className="text-sm font-black text-amber-300">{fmt(kpis.unitsProduced, 0)} un</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Gráfico: Faturamento vs Custo Fabril */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
                    Faturamento vs Custo Fabril — {selectedYear}
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gCust" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => 'R$' + (v/1000).toFixed(0) + 'k'} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                      <Area type="monotone" dataKey="Faturamento" stroke="#10b981" fill="url(#gFat)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="Custo Fabril" stroke="#f59e0b" fill="url(#gCust)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráfico: Margens */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
                    Evolução das Margens (%) — {selectedYear}
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="Margem Bruta %" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                      <Line type="monotone" dataKey="Margem Líquida %" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráfico Break-even */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
                    Break-even vs Faturamento Real — {selectedYear}
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => 'R$' + (v/1000).toFixed(0) + 'k'} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                      <Bar dataKey="Faturamento" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.8} />
                      <Bar dataKey="Break-even" fill="#f43f5e" radius={[4, 4, 0, 0]} opacity={0.6} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* YTD Summary */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                    Acumulado do Ano (YTD) — {selectedYear}
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { label: 'Faturamento Total', val: fmtMoney(ytd.totRevenue), color: 'text-emerald-400' },
                      { label: 'Custo Fabril Total', val: fmtMoney(ytd.totManuf), color: 'text-amber-400' },
                      { label: 'MOD Acumulada', val: fmtMoney(ytd.totMOD), color: 'text-blue-400' },
                      { label: 'Custos Fixos Totais', val: fmtMoney(ytd.totFixed), color: 'text-rose-400' },
                      { label: 'Unidades Produzidas', val: fmt(ytd.totUnits, 0) + ' un', color: 'text-purple-400' },
                      { label: 'Horas Trabalhadas', val: fmt(ytd.totHours, 0) + ' h', color: 'text-indigo-400' },
                    ].map((item, i) => (
                      <div key={i} className="bg-white/5 rounded-xl p-4">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">{item.label}</p>
                        <p className={`text-lg font-black ${item.color}`}>{item.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB: MOD ──────────────────────────────────────────── */}
        {activeTab === 'mod' && (
          <div className="space-y-8">
            {isLoading ? (
              <div className="text-center text-slate-500 py-20">Carregando...</div>
            ) : yearEntries.length === 0 ? (
              <div className="text-center py-24 text-slate-500">Sem dados lançados para {selectedYear}</div>
            ) : (
              <>
                {kpis && (
                  <>
                    {/* KPIs MOD */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <KpiCard title="MOD Mensal Total" value={fmtMoney(kpis.totalMOD)} sub={`Ref: ${MONTHS[(lastEntry?.month || 1) - 1]}/${lastEntry?.year}`} icon={Users} color="blue" />
                      <KpiCard title="MOD Acumulada (YTD)" value={fmtMoney(ytd.totMOD)} sub={`Acumulado ${selectedYear}`} icon={TrendingUp} color="indigo" />
                      <KpiCard title="Custo por Homem-Hora" value={fmtMoney(kpis.costPerHour)} sub="MOD ÷ Horas trabalhadas" icon={Activity} color="amber" />
                      <KpiCard title="Produtividade (Un/H-H)" value={`${fmt(kpis.unitsPerHour, 2)} un/h`} sub="Unidades por hora trabalhada" icon={Zap} color="emerald" />
                    </div>

                    {/* Breakdown MOD do último mês */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                          Composição da MOD — {MONTHS[(lastEntry?.month || 1) - 1]}/{lastEntry?.year}
                        </h3>
                        <div className="space-y-3">
                          {[
                            { label: 'Salários', val: lastEntry?.mod_salaries || 0, color: 'bg-blue-500' },
                            { label: 'Encargos Sociais', val: lastEntry?.mod_charges || 0, color: 'bg-indigo-500' },
                            { label: 'Benefícios', val: lastEntry?.mod_benefits || 0, color: 'bg-purple-500' },
                            { label: 'Horas Extras', val: lastEntry?.mod_overtime || 0, color: 'bg-amber-500' },
                          ].map((item, i) => {
                            const pct = kpis.totalMOD > 0 ? (item.val / kpis.totalMOD) * 100 : 0;
                            return (
                              <div key={i}>
                                <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                                  <span>{item.label}</span>
                                  <span>{fmtMoney(item.val)} <span className="text-slate-500">({fmt(pct)}%)</span></span>
                                </div>
                                <div className="w-full bg-white/5 rounded-full h-2">
                                  <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between">
                          <span className="text-xs font-black text-slate-400">TOTAL MOD</span>
                          <span className="text-sm font-black text-blue-400">{fmtMoney(kpis.totalMOD)}</span>
                        </div>
                      </div>

                      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                          Indicadores de Produtividade
                        </h3>
                        <div className="space-y-4">
                          {[
                            { label: 'Colaboradores (MOD)', val: fmt(kpis.workers_count, 0) + ' pessoas', icon: Users, color: 'text-blue-400' },
                            { label: 'Horas Trabalhadas', val: fmt(kpis.totalHours, 0) + ' h', icon: Activity, color: 'text-indigo-400' },
                            { label: 'Unidades Produzidas', val: fmt(kpis.unitsProduced, 0) + ' un', icon: Zap, color: 'text-emerald-400' },
                            { label: 'MOD como % do Custo Fabril', val: fmt(kpis.modShare) + '%', icon: BarChart3, color: 'text-amber-400' },
                            { label: 'Custo MOD / Colaborador', val: fmtMoney(kpis.workers_count > 0 ? kpis.totalMOD / kpis.workers_count : 0), icon: DollarSign, color: 'text-rose-400' },
                          ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                              <div className="flex items-center gap-3">
                                <item.icon className={`h-4 w-4 ${item.color}`} />
                                <span className="text-xs font-bold text-slate-300">{item.label}</span>
                              </div>
                              <span className={`text-sm font-black ${item.color}`}>{item.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Gráfico MOD vs Faturamento */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
                    MOD Mensal vs Faturamento — {selectedYear}
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => 'R$' + (v/1000).toFixed(0) + 'k'} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                      <Bar dataKey="Faturamento" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.7} />
                      <Bar dataKey="MOD Total" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.9} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráfico Produtividade */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
                    Produtividade por Homem-Hora (Un/H-H) — {selectedYear}
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gProd" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="Un/Hora" stroke="#f59e0b" fill="url(#gProd)" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB: LANÇAMENTOS ──────────────────────────────────── */}
        {activeTab === 'entries' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs font-bold text-slate-500">{entries.length} lançamentos registrados</p>
              <button
                onClick={() => { setEditingEntry(null); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Novo Lançamento
              </button>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    {['Período', 'Faturamento', 'Custo Fabril', 'Margem Bruta', 'MOD Total', 'Colaboradores', 'Unid. Prod.', 'Ações'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-slate-600">Nenhum lançamento ainda</td></tr>
                  ) : entries.map(e => {
                    const totalMOD = (e.mod_salaries || 0) + (e.mod_charges || 0) + (e.mod_benefits || 0) + (e.mod_overtime || 0);
                    const grossMargin = e.revenue > 0 ? ((e.revenue - (e.variable_costs || 0)) / e.revenue) * 100 : 0;
                    return (
                      <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-4 text-xs font-black text-white">{MONTHS[(e.month || 1) - 1]}/{e.year}</td>
                        <td className="px-4 py-4 text-xs font-bold text-emerald-400">{fmtMoney(e.revenue)}</td>
                        <td className="px-4 py-4 text-xs font-bold text-amber-400">{fmtMoney(e.manufacturing_cost)}</td>
                        <td className={`px-4 py-4 text-xs font-black ${grossMargin >= 30 ? 'text-emerald-400' : grossMargin >= 15 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {fmt(grossMargin)}%
                        </td>
                        <td className="px-4 py-4 text-xs font-bold text-blue-400">{fmtMoney(totalMOD)}</td>
                        <td className="px-4 py-4 text-xs text-slate-400">{e.workers_count || 0}</td>
                        <td className="px-4 py-4 text-xs text-slate-400">{fmt(e.units_produced || 0, 0)}</td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingEntry(e); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => { if (confirm('Excluir este lançamento?')) deleteMutation.mutate(e.id); }} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <EntryForm
          entry={editingEntry}
          companyId={companyId}
          onClose={() => { setShowForm(false); setEditingEntry(null); }}
          onSaved={() => { setShowForm(false); setEditingEntry(null); }}
        />
      )}
    </div>
  );
}
