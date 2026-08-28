import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Zap,
  Plus, Edit2, Trash2, BarChart3, Target, Activity, Calculator, ChevronDown, Package
} from 'lucide-react';
import { toast } from 'sonner';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const fmt = (v, decimals = 2) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtMoney = (v) =>
  'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color }) {
  const colorMap = {
    emerald: { border: 'border-emerald-100', bg: 'bg-emerald-50',  text: 'text-emerald-600', icon: 'text-emerald-500' },
    amber:   { border: 'border-amber-100',   bg: 'bg-amber-50',    text: 'text-amber-600',   icon: 'text-amber-500' },
    rose:    { border: 'border-rose-100',     bg: 'bg-rose-50',     text: 'text-rose-600',    icon: 'text-rose-500' },
    blue:    { border: 'border-blue-100',     bg: 'bg-blue-50',     text: 'text-blue-600',    icon: 'text-blue-500' },
    indigo:  { border: 'border-indigo-100',   bg: 'bg-indigo-50',   text: 'text-indigo-600',  icon: 'text-indigo-500' },
    purple:  { border: 'border-purple-100',   bg: 'bg-purple-50',   text: 'text-purple-600',  icon: 'text-purple-500' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`bg-white border ${c.border} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300`}>
      <div className="flex justify-between items-start mb-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <div className={`p-2 ${c.bg} rounded-xl`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
      </div>
      <p className={`text-2xl font-black ${c.text}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-1 font-medium">{sub}</p>}
    </div>
  );
}

// ─── Entry Form (Uncontrolled inputs via FormData) ───────────────────────────
function EntryForm({ entry: initialEntry, companyId, onClose, onSaved, allEntries = [] }) {
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [month, setMonth] = useState(initialEntry?.month ?? currentMonth);
  const [year,  setYear]  = useState(initialEntry?.year  ?? currentYear);
  const [saving, setSaving] = useState(false);
  const [currentEntry, setCurrentEntry] = useState(initialEntry);

  const queryClient = useQueryClient();

  useEffect(() => {
    const found = allEntries.find(e => e.month === month && e.year === year);
    setCurrentEntry(found || null);
  }, [month, year, allEntries]);

  // Clean form input key for proper parsing (handles 1.500,50 -> 1500.5)
  const parseNum = (str) => {
    if (!str) return 0;
    const clean = str.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    const formData = new FormData(e.target);
    const payload = {
      company_id: companyId,
      month,
      year,
      revenue:            parseNum(formData.get('revenue')),
      manufacturing_cost: parseNum(formData.get('manufacturing_cost')),
      variable_costs:     parseNum(formData.get('variable_costs')),
      fixed_costs:        parseNum(formData.get('fixed_costs')),
      mod_salaries:       parseNum(formData.get('mod_salaries')),
      mod_charges:        parseNum(formData.get('mod_charges')),
      mod_benefits:       parseNum(formData.get('mod_benefits')),
      mod_overtime:       parseNum(formData.get('mod_overtime')),
      workers_count:      parseNum(formData.get('workers_count')),
      total_hours_worked: parseNum(formData.get('total_hours_worked')),
      units_produced:     parseNum(formData.get('units_produced')),
      notes:              formData.get('notes') || '',
    };

    try {
      if (currentEntry?.id) {
        await base44.entities.CostEntry.update(currentEntry.id, payload);
      } else {
        await base44.entities.CostEntry.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['cost-entries', companyId] });
      toast.success(currentEntry?.id ? 'Lançamento atualizado!' : 'Lançamento registrado!');
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar. A tabela CostEntry precisa existir no banco.');
    } finally {
      setSaving(false);
    }
  };

  const cls = (hasPrefix) =>
    `w-full bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none ` +
    `focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all py-2.5 shadow-sm ` +
    (hasPrefix ? 'pl-8 pr-3' : 'px-3');

  const Field = ({ label, name, prefix = '', hint = '' }) => (
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{label}</label>
      {hint && <p className="text-[9px] text-slate-600 mb-1">{hint}</p>}
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">{prefix}</span>}
        <input
          name={name}
          type="text"
          inputMode="decimal"
          className={cls(!!prefix)}
          defaultValue={currentEntry ? String(currentEntry[name] ?? 0) : '0'}
          onFocus={e => e.target.select()}
          placeholder="0"
        />
      </div>
    </div>
  );

  const Section = ({ title, color, children }) => {
    const bar = { indigo:'bg-indigo-500', emerald:'bg-emerald-500', amber:'bg-amber-500', blue:'bg-blue-500' };
    const txt = { indigo:'text-indigo-400', emerald:'text-emerald-400', amber:'text-amber-400', blue:'text-blue-400' };
    return (
      <div>
        <h3 className={`text-xs font-black ${txt[color]} uppercase tracking-widest mb-3 flex items-center gap-2`}>
          <span className={`w-1 h-4 ${bar[color]} rounded-full`} /> {title}
        </h3>
        {children}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-gray-50 border border-slate-200 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-100 p-6 flex justify-between items-center shrink-0 bg-white rounded-t-3xl text-slate-800">
          <div>
            <h2 className="text-lg font-black">{currentEntry?.id ? 'Editar Lançamento' : 'Novo Lançamento de Custos'}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">KPIs gerados automaticamente</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Body */}
        {/* Note we use key={currentEntry?.id} here to force input remounting when the selected period brings a different record */}
        <div key={currentEntry?.id || `${month}-${year}`} className="overflow-y-auto p-6 space-y-6 flex-1">
          <Section title="Período" color="indigo">
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Mês</label>
                <div className="relative">
                  <select className="w-full bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 px-3 py-2.5 appearance-none shadow-sm"
                    value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Ano</label>
                <input type="number" className="w-full bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 px-3 py-2.5 shadow-sm"
                  value={year} onChange={e => setYear(parseInt(e.target.value) || currentYear)} />
              </div>
            </div>
          </Section>

          <Section title="Faturamento e Custos" color="emerald">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Faturamento Bruto" name="revenue" prefix="R$" />
              <Field label="Custo Fabril Total" name="manufacturing_cost" prefix="R$" hint="Custo total da produção no período" />
              <Field label="Custos Variáveis" name="variable_costs" prefix="R$" hint="Matéria-prima, embalagem, comissões" />
              <Field label="Custos Fixos" name="fixed_costs" prefix="R$" hint="Aluguel, luz, seguros, adm. fixa" />
            </div>
          </Section>

          <Section title="Mão de Obra Direta (MOD)" color="amber">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Salários (MOD)" name="mod_salaries" prefix="R$" />
              <Field label="Encargos Sociais" name="mod_charges" prefix="R$" hint="INSS, FGTS, IRRF, RAT, etc." />
              <Field label="Benefícios" name="mod_benefits" prefix="R$" hint="VT, VR, plano de saúde, etc." />
              <Field label="Horas Extras" name="mod_overtime" prefix="R$" />
            </div>
          </Section>

          <Section title="Produtividade e Volume" color="blue">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Nº de Colaboradores" name="workers_count" />
              <Field label="Horas Trabalhadas (Total)" name="total_hours_worked" hint="Soma de todas as horas" />
              <Field label="Unidades Produzidas" name="units_produced" />
            </div>
          </Section>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Observações</label>
            <textarea name="notes" rows={3} placeholder="Informações adicionais..."
              className="w-full bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 px-3 py-2.5 resize-none shadow-sm"
              defaultValue={currentEntry?.notes || ''} />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-6 flex gap-3 justify-end shrink-0 bg-white rounded-b-3xl">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-600 border border-slate-200 rounded-xl transition-all">Cancelar</button>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm disabled:opacity-50">
            {saving ? 'Salvando...' : currentEntry?.id ? 'Atualizar Lançamento' : 'Salvar Lançamento'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xl">
      <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-bold" style={{ color: p.color }}>
          {p.name}: {p.value > 1000 ? fmtMoney(p.value) : fmt(p.value) + (String(p.name).includes('%') ? '%' : '')}
        </p>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CostManagement() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['cost-entries', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('CostEntry').select('*').eq('company_id', companyId)
        .order('year', { ascending: false }).order('month', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId
  });

  const { data: products = [] } = useQuery({
    queryKey: ['product-margins', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.from('ProductMargin').select('*').eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CostEntry.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cost-entries', companyId] }); toast.success('Excluído'); }
  });

  const yearEntries = useMemo(() =>
    entries.filter(e => e.year === selectedYear).sort((a, b) => a.month - b.month),
    [entries, selectedYear]);

  const lastEntry = useMemo(() => yearEntries[yearEntries.length - 1] || null, [yearEntries]);

  const kpis = useMemo(() => {
    if (!lastEntry) return null;
    const { revenue = 0, variable_costs = 0, fixed_costs = 0, manufacturing_cost = 0,
      mod_salaries = 0, mod_charges = 0, mod_benefits = 0, mod_overtime = 0,
      total_hours_worked = 0, units_produced = 0, workers_count = 0 } = lastEntry;
    const totalMOD = mod_salaries + mod_charges + mod_benefits + mod_overtime;
    const grossMargin = revenue > 0 ? ((revenue - variable_costs) / revenue) * 100 : 0;
    const netMargin   = revenue > 0 ? ((revenue - variable_costs - fixed_costs) / revenue) * 100 : 0;
    const breakEven   = grossMargin > 0 ? fixed_costs / (grossMargin / 100) : 0;
    const fixedAbsorption = units_produced > 0 ? fixed_costs / units_produced : 0;
    const costPerHour  = total_hours_worked > 0 ? totalMOD / total_hours_worked : 0;
    const unitsPerHour = total_hours_worked > 0 ? units_produced / total_hours_worked : 0;
    const modShare     = manufacturing_cost > 0 ? (totalMOD / manufacturing_cost) * 100 : 0;
    const manufacturingRatio = revenue > 0 ? (manufacturing_cost / revenue) * 100 : 0;
    return { revenue, totalMOD, grossMargin, netMargin, breakEven, fixedAbsorption,
      costPerHour, unitsPerHour, modShare, manufacturingRatio,
      workers_count, totalHours: total_hours_worked, unitsProduced: units_produced,
      mod_salaries, mod_charges, mod_benefits, mod_overtime };
  }, [lastEntry]);

  const ytd = useMemo(() => ({
    totRevenue: yearEntries.reduce((s, e) => s + (e.revenue || 0), 0),
    totMOD:     yearEntries.reduce((s, e) => s + (e.mod_salaries||0)+(e.mod_charges||0)+(e.mod_benefits||0)+(e.mod_overtime||0), 0),
    totManuf:   yearEntries.reduce((s, e) => s + (e.manufacturing_cost || 0), 0),
    totFixed:   yearEntries.reduce((s, e) => s + (e.fixed_costs || 0), 0),
    totUnits:   yearEntries.reduce((s, e) => s + (e.units_produced || 0), 0),
    totHours:   yearEntries.reduce((s, e) => s + (e.total_hours_worked || 0), 0),
  }), [yearEntries]);

  const chartData = useMemo(() => yearEntries.map(e => {
    const totalMOD    = (e.mod_salaries||0)+(e.mod_charges||0)+(e.mod_benefits||0)+(e.mod_overtime||0);
    const grossMargin = e.revenue > 0 ? ((e.revenue - (e.variable_costs||0)) / e.revenue) * 100 : 0;
    const netMargin   = e.revenue > 0 ? ((e.revenue - (e.variable_costs||0) - (e.fixed_costs||0)) / e.revenue) * 100 : 0;
    const breakEven   = grossMargin > 0 ? (e.fixed_costs||0) / (grossMargin / 100) : 0;
    const unitsPerHour = e.total_hours_worked > 0 ? (e.units_produced||0) / e.total_hours_worked : 0;
    return {
      month: MONTHS[(e.month||1)-1],
      'Faturamento': e.revenue || 0,
      'Custo Fabril': e.manufacturing_cost || 0,
      'MOD Total': totalMOD,
      'Margem Bruta %': parseFloat(grossMargin.toFixed(1)),
      'Margem Líquida %': parseFloat(netMargin.toFixed(1)),
      'Break-even': breakEven,
      'Un/Hora': parseFloat(unitsPerHour.toFixed(2)),
    };
  }), [yearEntries]);

  const openForm = (entry = null) => { setEditingEntry(entry); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingEntry(null); };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'mod',       label: 'Mão de Obra (MOD)', icon: Users },
    { id: 'entries',   label: 'Lançamentos', icon: Calculator },
  ];

  return (
    <div className="bg-gray-50 min-h-screen text-slate-800">
      <div className="max-w-[1800px] mx-auto p-4 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Gestão de Custos</h1>
            <p className="text-xs text-slate-400 mt-0.5">Dashboard de Rentabilidade · MOD · Break-even · Absorção de Custos</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select className="appearance-none bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none pl-4 pr-8 py-2.5 font-bold shadow-sm"
                value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
                {[currentYear, currentYear-1, currentYear-2].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
            <button onClick={() => openForm()}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm">
              <Plus className="h-4 w-4" /> Novo Lançamento
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white border border-slate-200 p-1 rounded-xl gap-1 w-fit shadow-sm">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* ── DASHBOARD ───────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {isLoading ? (
              <div className="text-center text-slate-400 py-20">Carregando...</div>
            ) : yearEntries.length === 0 ? (
              <div className="text-center py-24 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <Calculator className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-bold text-lg">Nenhum dado lançado para {selectedYear}</p>
                <p className="text-slate-400 text-sm mt-2">Clique em "Novo Lançamento" para começar</p>
                <button onClick={() => openForm()} className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all">
                  <Plus className="h-4 w-4 inline mr-2" />Primeiro Lançamento
                </button>
              </div>
            ) : <>
              {lastEntry && (
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Último período —
                  <span className="text-indigo-600 ml-1">{MONTHS[(lastEntry.month||1)-1]}/{lastEntry.year}</span>
                </p>
              )}

              {kpis && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard title="Faturamento" value={fmtMoney(kpis.revenue)} icon={DollarSign} color="emerald" />
                  <KpiCard title="Margem Bruta" value={`${fmt(kpis.grossMargin)}%`} sub="Faturamento − Custos Variáveis" icon={TrendingUp} color={kpis.grossMargin>=40?'emerald':kpis.grossMargin>=20?'amber':'rose'} />
                  <KpiCard title="Margem Líquida" value={`${fmt(kpis.netMargin)}%`} sub="Após custos fixos" icon={Activity} color={kpis.netMargin>=15?'emerald':kpis.netMargin>=5?'amber':'rose'} />
                  <KpiCard title="Custo Fabril / Fat." value={`${fmt(kpis.manufacturingRatio)}%`} sub="Peso do custo de produção" icon={BarChart3} color="blue" />
                </div>
              )}

              {/* Product Margins Health (Integration) */}
              {products.length > 0 && (
                <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-2xl">
                      <Package className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Saúde do Portfólio de Produtos</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Margem média calculada sobre <span className="font-bold text-slate-700">{products.length}</span> produtos ativos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Margem Bruta Média</p>
                    <p className="text-2xl font-black text-indigo-600">
                      {fmt(products.reduce((acc, p) => acc + (p.net_revenue > 0 ? ((p.net_revenue - p.variable_cost) / p.net_revenue) * 100 : 0), 0) / products.length)}%
                    </p>
                  </div>
                </div>
              )}

              {kpis && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Break-even */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="h-5 w-5 text-rose-400" />
                      <h3 className="text-sm font-bold text-slate-700">Ponto de Equilíbrio (Break-even)</h3>
                    </div>
                    <p className="text-3xl font-black text-rose-500">{fmtMoney(kpis.breakEven)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Faturamento mínimo para cobrir todos os custos fixos</p>
                    {kpis.revenue > 0 && (
                      <div className="mt-4">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                          <span>Cobertura</span>
                          <span className={kpis.revenue >= kpis.breakEven ? 'text-emerald-600' : 'text-rose-500'}>
                            {kpis.revenue >= kpis.breakEven ? '✓ Acima do ponto' : '✗ Abaixo do ponto'}
                          </span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2">
                          <div className={`h-2 rounded-full ${kpis.revenue >= kpis.breakEven ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min((kpis.revenue / Math.max(kpis.breakEven, 1)) * 100, 100)}%` }} />
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1">
                          {kpis.revenue >= kpis.breakEven
                            ? `Superávit de ${fmtMoney(kpis.revenue - kpis.breakEven)}`
                            : `Déficit de ${fmtMoney(kpis.breakEven - kpis.revenue)}`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Absorção Custos Fixos */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-5 w-5 text-amber-400" />
                      <h3 className="text-sm font-bold text-slate-700">Absorção de Custos Fixos</h3>
                    </div>
                    <p className="text-3xl font-black text-amber-500">{fmtMoney(kpis.fixedAbsorption)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Custo fixo por unidade produzida</p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="bg-amber-50 rounded-xl p-3">
                        <p className="text-[9px] text-slate-500 font-bold uppercase">Total Custos Fixos</p>
                        <p className="text-sm font-black text-amber-300">{fmtMoney(lastEntry?.fixed_costs || 0)}</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3">
                        <p className="text-[9px] text-slate-500 font-bold uppercase">Unidades Produzidas</p>
                        <p className="text-sm font-black text-amber-300">{fmt(kpis.unitsProduced, 0)} un</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart: Fat vs Custo Fabril */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Faturamento vs Custo Fabril — {selectedYear}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gCust" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)"/>
                    <XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'#94a3b8',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>'R$'+(v/1000).toFixed(0)+'k'}/>
                    <Tooltip content={<CustomTooltip/>}/><Legend wrapperStyle={{fontSize:'10px',fontWeight:700}}/>
                    <Area type="monotone" dataKey="Faturamento" stroke="#10b981" fill="url(#gFat)" strokeWidth={2} dot={false}/>
                    <Area type="monotone" dataKey="Custo Fabril" stroke="#f59e0b" fill="url(#gCust)" strokeWidth={2} dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Chart: Margens */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Evolução das Margens (%) — {selectedYear}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)"/>
                    <XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'#94a3b8',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>v+'%'}/>
                    <Tooltip content={<CustomTooltip/>}/><Legend wrapperStyle={{fontSize:'10px',fontWeight:700}}/>
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3"/>
                    <Line type="monotone" dataKey="Margem Bruta %" stroke="#10b981" strokeWidth={2} dot={{fill:'#10b981',r:3}}/>
                    <Line type="monotone" dataKey="Margem Líquida %" stroke="#6366f1" strokeWidth={2} dot={{fill:'#6366f1',r:3}}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Chart: Break-even */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Break-even vs Faturamento Real — {selectedYear}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)"/>
                    <XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'#94a3b8',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>'R$'+(v/1000).toFixed(0)+'k'}/>
                    <Tooltip content={<CustomTooltip/>}/><Legend wrapperStyle={{fontSize:'10px',fontWeight:700}}/>
                    <Bar dataKey="Faturamento" fill="#10b981" radius={[4,4,0,0]} opacity={0.8}/>
                    <Bar dataKey="Break-even" fill="#f43f5e" radius={[4,4,0,0]} opacity={0.6}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* YTD */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Acumulado do Ano (YTD) — {selectedYear}</h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: 'Faturamento Total',  val: fmtMoney(ytd.totRevenue), color: 'text-emerald-400' },
                    { label: 'Custo Fabril Total', val: fmtMoney(ytd.totManuf),   color: 'text-amber-400' },
                    { label: 'MOD Acumulada',      val: fmtMoney(ytd.totMOD),     color: 'text-blue-400' },
                    { label: 'Custos Fixos Totais',val: fmtMoney(ytd.totFixed),   color: 'text-rose-400' },
                    { label: 'Unidades Produzidas',val: fmt(ytd.totUnits,0)+' un',color: 'text-purple-400' },
                    { label: 'Horas Trabalhadas',  val: fmt(ytd.totHours,0)+' h', color: 'text-indigo-400' },
                  ].map((item, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-4">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">{item.label}</p>
                      <p className={`text-lg font-black ${item.color}`}>{item.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>}
          </div>
        )}

        {/* ── MOD ─────────────────────────────────────────────────── */}
        {activeTab === 'mod' && (
          <div className="space-y-8">
            {isLoading ? <div className="text-center py-20 text-slate-400">Carregando...</div>
            : yearEntries.length === 0 ? <div className="text-center py-24 text-slate-400">Sem dados para {selectedYear}</div>
            : <>
              {kpis && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard title="MOD Mensal" value={fmtMoney(kpis.totalMOD)} sub={`${MONTHS[(lastEntry?.month||1)-1]}/${lastEntry?.year}`} icon={Users} color="blue" />
                  <KpiCard title="MOD Acumulada (YTD)" value={fmtMoney(ytd.totMOD)} sub={`Acumulado ${selectedYear}`} icon={TrendingUp} color="indigo" />
                  <KpiCard title="Custo / Homem-Hora" value={fmtMoney(kpis.costPerHour)} sub="MOD ÷ Horas trabalhadas" icon={Activity} color="amber" />
                  <KpiCard title="Produtividade Un/H-H" value={`${fmt(kpis.unitsPerHour,2)} un/h`} sub="Unidades por hora trabalhada" icon={Zap} color="emerald" />
                </div>
              )}

              {kpis && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Composição MOD */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                      Composição da MOD — {MONTHS[(lastEntry?.month||1)-1]}/{lastEntry?.year}
                    </h3>
                    <div className="space-y-3">
                      {[
                        { label:'Salários',         val: kpis.mod_salaries,  color:'bg-blue-500' },
                        { label:'Encargos Sociais', val: kpis.mod_charges,   color:'bg-indigo-500' },
                        { label:'Benefícios',       val: kpis.mod_benefits,  color:'bg-purple-500' },
                        { label:'Horas Extras',     val: kpis.mod_overtime,  color:'bg-amber-500' },
                      ].map((item, i) => {
                        const pct = kpis.totalMOD > 0 ? (item.val / kpis.totalMOD) * 100 : 0;
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                              <span>{item.label}</span>
                              <span>{fmtMoney(item.val)} <span className="text-slate-500">({fmt(pct)}%)</span></span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 flex justify-between">
                      <span className="text-xs font-black text-slate-500">TOTAL MOD</span>
                      <span className="text-sm font-black text-blue-600">{fmtMoney(kpis.totalMOD)}</span>
                    </div>
                  </div>

                  {/* Indicadores */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Indicadores de Produtividade</h3>
                    <div className="space-y-3">
                      {[
                        { label:'Colaboradores (MOD)',      val: fmt(kpis.workers_count,0)+' pessoas', icon:Users,     color:'text-blue-400' },
                        { label:'Horas Trabalhadas',        val: fmt(kpis.totalHours,0)+' h',          icon:Activity,  color:'text-indigo-400' },
                        { label:'Unidades Produzidas',      val: fmt(kpis.unitsProduced,0)+' un',      icon:Zap,       color:'text-emerald-400' },
                        { label:'MOD % do Custo Fabril',    val: fmt(kpis.modShare)+'%',               icon:BarChart3, color:'text-amber-400' },
                        { label:'Custo MOD / Colaborador',  val: fmtMoney(kpis.workers_count > 0 ? kpis.totalMOD / kpis.workers_count : 0), icon:DollarSign, color:'text-rose-400' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                          <div className="flex items-center gap-3">
                            <item.icon className={`h-4 w-4 ${item.color}`} />
                            <span className="text-xs font-bold text-slate-600">{item.label}</span>
                          </div>
                          <span className={`text-sm font-black ${item.color}`}>{item.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Chart MOD vs Fat */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">MOD Mensal vs Faturamento — {selectedYear}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)"/>
                    <XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'#94a3b8',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>'R$'+(v/1000).toFixed(0)+'k'}/>
                    <Tooltip content={<CustomTooltip/>}/><Legend wrapperStyle={{fontSize:'10px',fontWeight:700}}/>
                    <Bar dataKey="Faturamento" fill="#10b981" radius={[4,4,0,0]} opacity={0.7}/>
                    <Bar dataKey="MOD Total" fill="#3b82f6" radius={[4,4,0,0]} opacity={0.9}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Produtividade */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Produtividade por Homem-Hora — {selectedYear}</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gProd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)"/>
                    <XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'#94a3b8',fontSize:10}} axisLine={false} tickLine={false}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Area type="monotone" dataKey="Un/Hora" stroke="#f59e0b" fill="url(#gProd)" strokeWidth={2} dot={{fill:'#f59e0b',r:4}}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>}
          </div>
        )}

        {/* ── LANÇAMENTOS ─────────────────────────────────────────── */}
        {activeTab === 'entries' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs font-bold text-slate-500">{entries.length} lançamentos registrados</p>
              <button onClick={() => openForm()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl transition-all">
                <Plus className="h-3.5 w-3.5" /> Novo Lançamento
              </button>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Período','Faturamento','Custo Fabril','Margem Bruta','MOD Total','Colaboradores','Unid. Prod.','Ações'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0
                    ? <tr><td colSpan={8} className="text-center py-12 text-slate-400">Nenhum lançamento ainda</td></tr>
                    : entries.map(e => {
                        const mod = (e.mod_salaries||0)+(e.mod_charges||0)+(e.mod_benefits||0)+(e.mod_overtime||0);
                        const gm  = e.revenue > 0 ? ((e.revenue-(e.variable_costs||0))/e.revenue)*100 : 0;
                        return (
                          <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 text-xs font-black text-slate-700">{MONTHS[(e.month||1)-1]}/{e.year}</td>
            <td className="px-4 py-4 text-xs font-bold text-emerald-600">{fmtMoney(e.revenue)}</td>
            <td className="px-4 py-4 text-xs font-bold text-amber-600">{fmtMoney(e.manufacturing_cost)}</td>
            <td className={`px-4 py-4 text-xs font-black ${gm>=30?'text-emerald-600':gm>=15?'text-amber-600':'text-rose-500'}`}>{fmt(gm)}%</td>
            <td className="px-4 py-4 text-xs font-bold text-blue-600">{fmtMoney(mod)}</td>
            <td className="px-4 py-4 text-xs text-slate-500">{e.workers_count||0}</td>
            <td className="px-4 py-4 text-xs text-slate-500">{fmt(e.units_produced||0,0)}</td>
                            <td className="px-4 py-4">
                              <div className="flex gap-2">
                                <button onClick={() => openForm(e)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
                                  <Edit2 className="h-3.5 w-3.5"/>
                                </button>
                                <button onClick={() => { if(confirm('Excluir?')) deleteMutation.mutate(e.id); }} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                                  <Trash2 className="h-3.5 w-3.5"/>
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

      {showForm && (
        <EntryForm 
          entry={editingEntry} 
          allEntries={entries}
          companyId={companyId} 
          onClose={closeForm} 
          onSaved={closeForm} 
        />
      )}
    </div>
  );
}
