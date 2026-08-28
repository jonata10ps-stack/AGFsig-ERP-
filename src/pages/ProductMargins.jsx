import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { useCompanyId } from '@/components/useCompanyId';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
  Plus, Edit2, Trash2, Package, TrendingUp, DollarSign,
  BarChart3, ChevronDown, Lock, Search, AlertCircle, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v, d = 2) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtMoney = (v) =>
  'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (v) => `${fmt(v)}%`;

// Calcula margens a partir dos campos brutos
const calcMargins = (p) => {
  const netRevenue       = Number(p.net_revenue       || 0);
  const unitCost         = Number(p.unit_cost          || 0);
  const variableCost     = Number(p.variable_cost      || 0);
  const fixedAlloc       = Number(p.fixed_cost_alloc   || 0);
  const totalCost        = unitCost + fixedAlloc;
  const contributionMargin = netRevenue - variableCost;
  const grossMargin      = netRevenue > 0 ? (contributionMargin / netRevenue) * 100 : 0;
  const netMargin        = netRevenue > 0 ? ((netRevenue - totalCost) / netRevenue) * 100 : 0;
  const markup           = unitCost > 0 ? ((netRevenue - unitCost) / unitCost) * 100 : 0;
  return { netRevenue, unitCost, variableCost, fixedAlloc, totalCost, contributionMargin, grossMargin, netMargin, markup };
};

const MARGIN_COLORS = ['#10b981','#6366f1','#f59e0b','#3b82f6','#f43f5e','#8b5cf6','#14b8a6','#ec4899'];

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xl text-xs">
      <p className="font-black text-slate-600 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {typeof p.value === 'number' && Math.abs(p.value) > 10 ? fmtMoney(p.value) : fmtPct(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color, badge }) {
  const cm = {
    emerald: { border:'border-emerald-100', bg:'bg-emerald-50', text:'text-emerald-600', icon:'text-emerald-500' },
    amber:   { border:'border-amber-100',   bg:'bg-amber-50',   text:'text-amber-600',   icon:'text-amber-500' },
    rose:    { border:'border-rose-100',     bg:'bg-rose-50',    text:'text-rose-600',    icon:'text-rose-500' },
    blue:    { border:'border-blue-100',     bg:'bg-blue-50',    text:'text-blue-600',    icon:'text-blue-500' },
    indigo:  { border:'border-indigo-100',   bg:'bg-indigo-50',  text:'text-indigo-600',  icon:'text-indigo-500' },
  };
  const c = cm[color] || cm.blue;
  return (
    <div className={`bg-white border ${c.border} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all`}>
      <div className="flex justify-between items-start mb-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <div className={`p-2 ${c.bg} rounded-xl`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
      </div>
      <p className={`text-2xl font-black ${c.text}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-1 font-medium">{sub}</p>}
      {badge && (
        <span className={`inline-block mt-2 text-[9px] font-black px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
      )}
    </div>
  );
}

// ─── Product Form (Uncontrolled inputs via FormData) ───────────────────────────
function ProductForm({ product, companyId, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  // Clean form input key for proper parsing (handles 1.500,50 -> 1500.5)
  const parseNum = (str) => {
    if (!str) return 0;
    const clean = str.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const productName = formData.get('product_name');
    
    if (!productName) { 
      toast.error('Nome do produto é obrigatório'); 
      return; 
    }
    
    setSaving(true);
    const payload = {
      company_id: companyId,
      product_name:     productName,
      product_code:     formData.get('product_code') || '',
      category:         formData.get('category') || '',
      sale_price:       parseNum(formData.get('sale_price')),
      net_revenue:      parseNum(formData.get('net_revenue')),
      unit_cost:        parseNum(formData.get('unit_cost')),
      variable_cost:    parseNum(formData.get('variable_cost')),
      fixed_cost_alloc: parseNum(formData.get('fixed_cost_alloc')),
      notes:            formData.get('notes') || '',
    };
    
    try {
      if (product?.id) {
        await base44.entities.ProductMargin.update(product.id, payload);
      } else {
        await base44.entities.ProductMargin.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['product-margins', companyId] });
      toast.success(product?.id ? 'Produto atualizado!' : 'Produto cadastrado!');
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar. Verifique se a tabela ProductMargin existe no banco.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 py-2.5 px-3 transition-all';
  const Field = ({ label, name, hint, type = 'text', prefix }) => (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {hint && <p className="text-[9px] text-slate-400 mb-1">{hint}</p>}
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{prefix}</span>}
        <input
          name={name}
          type="text"
          inputMode={type === 'money' ? 'decimal' : undefined}
          className={`${inputCls} ${prefix ? 'pl-9' : ''}`}
          defaultValue={product?.[name] ?? (type === 'money' ? '0' : '')}
          onFocus={e => { if (type === 'money') e.target.select(); }}
          placeholder={type === 'money' ? '0' : ''}
        />
      </div>
    </div>
  );

  const Section = ({ title, color = 'indigo', children }) => {
    const colors = { indigo: 'text-indigo-600 bg-indigo-500', emerald: 'text-emerald-600 bg-emerald-500', amber: 'text-amber-600 bg-amber-500' };
    return (
      <div>
        <h3 className={`text-xs font-black ${colors[color].split(' ')[0]} uppercase tracking-widest mb-3 flex items-center gap-2`}>
          <span className={`w-1 h-4 ${colors[color].split(' ')[1]} rounded-full`} /> {title}
        </h3>
        {children}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSave} className="bg-gray-50 border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="bg-white border-b border-slate-100 px-6 py-5 flex justify-between items-center rounded-t-3xl">
          <div>
            <h2 className="text-base font-black text-slate-800">{product?.id ? 'Editar Produto' : 'Novo Produto — Margem'}</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">As margens são calculadas automaticamente</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          <Section title="Identificação" color="indigo">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Field label="Nome do Produto *" name="product_name" /></div>
              <Field label="Código" name="product_code" />
              <Field label="Categoria / Linha" name="category" />
            </div>
          </Section>

          <Section title="Receita" color="emerald">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Preço de Venda (Bruto)" name="sale_price" type="money" prefix="R$" hint="Preço cheio praticado" />
              <Field label="Receita Líquida" name="net_revenue" type="money" prefix="R$" hint="Após impostos, descontos e devoluções" />
            </div>
          </Section>

          <Section title="Custos" color="amber">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Custo Unitário (MOD + MP)" name="unit_cost" type="money" prefix="R$" hint="Mão de obra + matéria-prima por unidade" />
              <Field label="Custos Variáveis Unitários" name="variable_cost" type="money" prefix="R$" hint="Embalagem, comissão, frete por unidade" />
              <Field label="Rateio de Custos Fixos" name="fixed_cost_alloc" type="money" prefix="R$" hint="Parcela dos fixos absorvida por unidade" />
            </div>
          </Section>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Observações</label>
            <textarea name="notes" rows={2} placeholder="Notas adicionais..."
              className={inputCls + ' resize-none'} defaultValue={product?.notes || ''} />
          </div>
        </div>

        <div className="bg-white border-t border-slate-100 px-6 py-4 flex gap-3 justify-end rounded-b-3xl">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl transition-all">Cancelar</button>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm disabled:opacity-50">
            {saving ? 'Salvando...' : product?.id ? 'Atualizar Produto' : 'Salvar Produto'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProductMargins() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [search, setSearch]     = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser]         = useState(null);

  // Verifica perfil do usuário
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isManager = user && (
    String(user.role).toLowerCase() === 'admin' ||
    String(user.role).toLowerCase() === 'gestor' ||
    String(user.role).toLowerCase() === 'manager'
  );

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['product-margins', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('ProductMargin').select('*').eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductMargin.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-margins', companyId] });
      toast.success('Produto excluído');
    }
  });

  // Enriquecer com margens calculadas
  const enriched = useMemo(() => products.map(p => ({ ...p, ...calcMargins(p) })), [products]);

  const filtered = useMemo(() => {
    if (!search) return enriched;
    const q = search.toLowerCase();
    return enriched.filter(p =>
      p.product_name?.toLowerCase().includes(q) ||
      p.product_code?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  }, [enriched, search]);

  // KPIs Globais
  const kpis = useMemo(() => {
    if (!enriched.length) return null;
    const avgGross = enriched.reduce((s, p) => s + p.grossMargin, 0) / enriched.length;
    const avgNet   = enriched.reduce((s, p) => s + p.netMargin, 0)   / enriched.length;
    const avgMarkup = enriched.reduce((s, p) => s + p.markup, 0)     / enriched.length;
    const best  = [...enriched].sort((a, b) => b.netMargin  - a.netMargin)[0];
    const worst = [...enriched].sort((a, b) => a.netMargin  - b.netMargin)[0];
    return { avgGross, avgNet, avgMarkup, best, worst, total: enriched.length };
  }, [enriched]);

  // Chart: Margem por produto
  const barData = useMemo(() =>
    [...enriched].sort((a, b) => b.grossMargin - a.grossMargin).slice(0, 12).map(p => ({
      name: p.product_name?.length > 14 ? p.product_name.slice(0, 14) + '…' : p.product_name,
      'Margem Bruta %': parseFloat(p.grossMargin.toFixed(1)),
      'Margem Líquida %': parseFloat(p.netMargin.toFixed(1)),
    })), [enriched]);

  // Chart: Distribuição por faixa de margem
  const pieData = useMemo(() => {
    const faixas = { 'Alta (>40%)': 0, 'Média (20-40%)': 0, 'Baixa (<20%)': 0 };
    enriched.forEach(p => {
      if (p.grossMargin >= 40) faixas['Alta (>40%)']++;
      else if (p.grossMargin >= 20) faixas['Média (20-40%)']++;
      else faixas['Baixa (<20%)']++;
    });
    return Object.entries(faixas).map(([name, value]) => ({ name, value }));
  }, [enriched]);

  const openForm = (p = null) => { setEditing(p); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const marginColor = (v) => v >= 40 ? 'text-emerald-600' : v >= 20 ? 'text-amber-600' : 'text-rose-500';
  const marginBg    = (v) => v >= 40 ? 'bg-emerald-50 text-emerald-700' : v >= 20 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600';

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'produtos',  label: 'Produtos',  icon: Package },
  ];

  return (
    <div className="bg-gray-50 min-h-screen text-slate-800">
      <div className="max-w-[1800px] mx-auto p-4 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Margens de Produtos</h1>
            <p className="text-xs text-slate-400 mt-0.5">Rentabilidade por produto · Margem Bruta · Margem Líquida · Markup</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar produto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-700 w-52"
              />
            </div>
            {isManager ? (
              <button onClick={() => openForm()}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm">
                <Plus className="h-4 w-4" /> Novo Produto
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-xl">
                <Lock className="h-3.5 w-3.5" /> Somente leitura
              </div>
            )}
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

        {/* ── DASHBOARD ──────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {isLoading ? <div className="text-center py-20 text-slate-400">Carregando...</div>
            : enriched.length === 0 ? (
              <div className="text-center py-24 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-bold text-lg">Nenhum produto cadastrado ainda</p>
                <p className="text-slate-400 text-sm mt-2">
                  {isManager ? 'Clique em "Novo Produto" para começar' : 'Aguarde o gestor cadastrar os produtos'}
                </p>
                {isManager && (
                  <button onClick={() => openForm()} className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all">
                    <Plus className="h-4 w-4 inline mr-2" />Cadastrar Produto
                  </button>
                )}
              </div>
            ) : <>
              {/* KPIs */}
              {kpis && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard title="Produtos Cadastrados" value={kpis.total} icon={Package} color="indigo" sub="portfólio ativo" />
                  <KpiCard title="Margem Bruta Média" value={fmtPct(kpis.avgGross)} icon={TrendingUp}
                    color={kpis.avgGross>=40?'emerald':kpis.avgGross>=20?'amber':'rose'}
                    sub="média do portfólio"
                    badge={{ label: kpis.avgGross>=40?'Boa':'Atenção', color: kpis.avgGross>=40?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700' }} />
                  <KpiCard title="Margem Líquida Média" value={fmtPct(kpis.avgNet)} icon={DollarSign}
                    color={kpis.avgNet>=15?'emerald':kpis.avgNet>=5?'amber':'rose'}
                    sub="após todos os custos" />
                  <KpiCard title="Markup Médio" value={fmtPct(kpis.avgMarkup)} icon={BarChart3} color="blue" sub="margem sobre o custo" />
                </div>
              )}

              {/* Destaques */}
              {kpis?.best && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                      <h3 className="text-sm font-black text-slate-700">Produto Mais Rentável</h3>
                    </div>
                    <p className="text-xl font-black text-emerald-600">{kpis.best.product_name}</p>
                    <p className="text-xs text-slate-400 mt-1">{kpis.best.category || '—'} · Código: {kpis.best.product_code || '—'}</p>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {[
                        { label:'Margem Bruta', val: fmtPct(kpis.best.grossMargin) },
                        { label:'Margem Líq.',  val: fmtPct(kpis.best.netMargin) },
                        { label:'Markup',       val: fmtPct(kpis.best.markup) },
                      ].map((x,i) => (
                        <div key={i} className="bg-emerald-50 rounded-xl p-2 text-center">
                          <p className="text-[9px] text-slate-500 font-bold uppercase">{x.label}</p>
                          <p className="text-sm font-black text-emerald-600">{x.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-rose-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="h-5 w-5 text-rose-400" />
                      <h3 className="text-sm font-black text-slate-700">Produto com Menor Margem</h3>
                    </div>
                    <p className="text-xl font-black text-rose-500">{kpis.worst.product_name}</p>
                    <p className="text-xs text-slate-400 mt-1">{kpis.worst.category || '—'} · Código: {kpis.worst.product_code || '—'}</p>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {[
                        { label:'Margem Bruta', val: fmtPct(kpis.worst.grossMargin) },
                        { label:'Margem Líq.',  val: fmtPct(kpis.worst.netMargin) },
                        { label:'Markup',       val: fmtPct(kpis.worst.markup) },
                      ].map((x,i) => (
                        <div key={i} className="bg-rose-50 rounded-xl p-2 text-center">
                          <p className="text-[9px] text-slate-500 font-bold uppercase">{x.label}</p>
                          <p className="text-sm font-black text-rose-500">{x.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bar: Margens por produto */}
                <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Margem Bruta & Líquida por Produto</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={barData} layout="vertical" margin={{ left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fill:'#94a3b8', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => v+'%'} />
                      <YAxis type="category" dataKey="name" tick={{ fill:'#64748b', fontSize:10, fontWeight:600 }} axisLine={false} tickLine={false} width={110} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize:'10px', fontWeight:700 }} />
                      <Bar dataKey="Margem Bruta %" fill="#10b981" radius={[0,4,4,0]} maxBarSize={14} />
                      <Bar dataKey="Margem Líquida %" fill="#6366f1" radius={[0,4,4,0]} maxBarSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie: Distribuição */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Distribuição por Faixa</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={['#10b981','#f59e0b','#f43f5e'][i]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [v, 'produtos']} />
                      <Legend wrapperStyle={{ fontSize:'10px', fontWeight:700 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>}
          </div>
        )}

        {/* ── PRODUTOS ──────────────────────────────────────────── */}
        {activeTab === 'produtos' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs font-bold text-slate-400">
                {filtered.length} produto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
              </p>
              {isManager && (
                <button onClick={() => openForm()}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all">
                  <Plus className="h-3.5 w-3.5" /> Novo Produto
                </button>
              )}
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Produto','Código','Categoria','Rec. Líquida','Custo Unit.','Margem Bruta','Margem Líq.','Markup','Ações'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={9} className="text-center py-12 text-slate-400">Carregando...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-slate-400">Nenhum produto encontrado</td></tr>
                  ) : filtered.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4">
                        <p className="text-xs font-black text-slate-700">{p.product_name}</p>
                        {p.notes && <p className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[160px]">{p.notes}</p>}
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-slate-500">{p.product_code || '—'}</td>
                      <td className="px-4 py-4">
                        {p.category
                          ? <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{p.category}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-emerald-600">{fmtMoney(p.netRevenue)}</td>
                      <td className="px-4 py-4 text-xs font-bold text-amber-600">{fmtMoney(p.unitCost)}</td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${marginBg(p.grossMargin)}`}>
                          {fmtPct(p.grossMargin)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${marginBg(p.netMargin)}`}>
                          {fmtPct(p.netMargin)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-blue-600">{fmtPct(p.markup)}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          {isManager ? (
                            <>
                              <button onClick={() => openForm(p)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => { if(confirm('Excluir este produto?')) deleteMutation.mutate(p.id); }}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[9px] text-slate-300 font-bold">leitura</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legenda de faixas */}
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-400 inline-block"/> Alta ≥ 40%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block"/> Média 20-40%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-rose-400 inline-block"/> Baixa &lt; 20%</span>
            </div>
          </div>
        )}
      </div>

      {showForm && isManager && (
        <ProductForm product={editing} companyId={companyId} onClose={closeForm} onSaved={closeForm} />
      )}
    </div>
  );
}
