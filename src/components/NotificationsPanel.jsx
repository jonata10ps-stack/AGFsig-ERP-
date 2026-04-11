import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44, supabase } from '@/api/base44Client';
import { Bell, X, AlertTriangle, Clock, Factory, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { differenceInDays, differenceInHours, parseISO } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

const severityConfig = {
  critical: { color: 'bg-red-50 border-l-4 border-red-500',     icon: <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" /> },
  high:     { color: 'bg-orange-50 border-l-4 border-orange-500', icon: <Clock className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" /> },
  medium:   { color: 'bg-yellow-50 border-l-4 border-yellow-500', icon: <Factory className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" /> },
  low:      { color: 'bg-blue-50 border-l-4 border-blue-500',    icon: <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" /> },
  info:     { color: 'bg-slate-50 border-l-4 border-slate-400',  icon: <Bell className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" /> },
};

const RECENT_HOURS = 48;

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

const PAGE_MODULE_MAP = {
  ProductionOrders: 'Producao',
  ProductionRequests: 'Producao',
  ProductionSchedule: 'Producao',
  FactoryDashboard: 'DashboardFabrica',
  InventoryMoves: 'Estoque',
  MaterialRequests: 'Estoque',
  ReceivingList: 'Estoque',
  StockBalances: 'Estoque',
  SalesOrders: 'Vendas',
  Quotes: 'Vendas',
  SalesAppointments: 'Vendas',
  ProspectionVisits: 'Agenda',
  ProspectionProjects: 'Agenda',
  DailyVehicleLog: 'Agenda',
  AfterSales: 'PosVendas',
  ServiceOrders: 'PosVendas',
  ServiceRequests: 'PosVendas',
  NonConformityReports: 'Qualidade',
  EngineeringProjects: 'Engenharia',
  EngineeringDashboard: 'Engenharia',
  Reports: 'Relatorios',
  StockReports: 'Relatorios'
};

function isRecent(dateStr) {
  if (!dateStr) return false;
  return differenceInHours(new Date(), parseISO(dateStr)) <= RECENT_HOURS;
}

// Componente de toast flutuante (fora do painel, canto superior direito)
export function NotificationToast({ notification, onDismiss }) {
  const cfg = severityConfig[notification?.severity] || severityConfig.info;
  return (
    <div
      className={`fixed top-20 right-4 z-[200] w-80 rounded-lg shadow-2xl border p-4 animate-in slide-in-from-right-4 fade-in duration-300 ${cfg.color}`}
    >
      <div className="flex items-start gap-3">
        {cfg.icon}
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
          <p className="text-xs text-slate-700 mt-1 leading-relaxed">{notification.message}</p>
        </div>
        <button onClick={onDismiss} className="text-slate-400 hover:text-slate-700 ml-1 flex-shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function NotificationsPanel({ open, onClose }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const companyId = user?.company_id || user?.current_company_id || null;
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  
  // Persiste IDs já vistos no localStorage para não repetir o Toast
  const shownToastIds = useRef(new Set(
    JSON.parse(localStorage.getItem('notif_seen_ids') || '[]')
  ));

  // Persiste IDs lidos/dismissed no localStorage para desaparecerem da lista
  const dismissedIds = useRef(new Set(
    JSON.parse(localStorage.getItem('notif_dismissed_ids') || '[]')
  ));



  const dismissToast = () => {
    clearTimeout(toastTimerRef.current);
    setToast(null);
  };

  const showToast = (notif) => {
    if (shownToastIds.current.has(notif.id)) return;
    shownToastIds.current.add(notif.id);
    localStorage.setItem('notif_seen_ids', JSON.stringify([...shownToastIds.current].slice(-200)));
    setToast(notif);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  };

  // Função para marcar como lida e fazer sumir
  const handleReadNotification = async (notif) => {
    if (!dismissedIds.current.has(notif.id)) {
      dismissedIds.current.add(notif.id);
      localStorage.setItem('notif_dismissed_ids', JSON.stringify([...dismissedIds.current].slice(-500)));
    }

    if (notif.isCustomNotification) {
      try {
        await base44.entities.Notification.update(notif.id, { 
          is_read: true, 
          read_at: new Date().toISOString() 
        });
      } catch (e) {
        console.error('Erro ao marcar notificação DB como lida:', e);
      }
    }

    // Remove localmente para resposta imediata na UI
    setNotifications(prev => prev.filter(n => n.id !== notif.id));
    onClose();
  };

  useEffect(() => {
    if (!companyId) return;

    const fetchNotifications = async () => {
      try {
        if (!user?.email || !companyId) return;
        setLoading(true);
        const cid = companyId;

        // Controle de acesso por módulo
        const userRole = String(user.role || '').toLowerCase();
        const rawModules = user.allowed_modules;
        
        const parseModules = (val) => {
          if (!val) return [];
          if (Array.isArray(val)) return val;
          try { 
            const p = JSON.parse(val); 
            return Array.isArray(p) ? p : []; 
          } catch (e) { 
            return String(val).split(',').map(s => s.trim()); 
          }
        };
        
        const allowedModules = new Set(parseModules(rawModules).map(m => String(m).toLowerCase()));
        const isAdmin = userRole === 'admin';

        const hasAccess = (page) => {
          if (isAdmin) return true;
          const moduleId = PAGE_MODULE_MAP[page];
          if (!moduleId) return true; 
          return allowedModules.has(moduleId.toLowerCase());
        };

        const productionAlertsAction = async () => {
          try {
            const { data, error } = await supabase.rpc('generate_production_alerts', { p_company_id: cid });
            if (error) throw error;
            return data?.alerts || [];
          } catch (e) {
            console.debug('RPC generate_production_alerts falhou:', e.message);
            return [];
          }
        };

        const [
          productionRequests,
          salesOrders,
          userNotifications,
          productionAlerts,
          productionOrders,
          inventoryMoves,
          quotes,
          appointments,
          productionSteps,
          products,
        ] = await Promise.all([
          base44.entities.ProductionRequest.filter({ company_id: cid }, '-created_date', 50),
          base44.entities.SalesOrder.filter({ company_id: cid }, '-created_date', 50),
          base44.entities.Notification.filter({ user_email: user.email, company_id: cid, is_read: false }, '-created_date', 50),
          productionAlertsAction(),
          base44.entities.ProductionOrder.filter({ company_id: cid }, '-created_date', 100),
          base44.entities.InventoryMove.filter({ company_id: cid }, '-created_date', 50),
          base44.entities.Quote.filter({ company_id: cid }, '-created_date', 30),
          base44.entities.SalesAppointment.filter({ company_id: cid }, '-created_date', 30),
          base44.entities.ProductionStep.filter({ company_id: cid }, '-created_at', 100),
          base44.entities.Product.filter({ company_id: cid }, 'sku', 500),
        ]);

        const productMap = Object.fromEntries((products || []).map(p => [p.id, p]));
        const notifs = [];

        // 1. Alertas de Produção (RPC)
        if (hasAccess('ProductionOrders')) {
          (productionAlerts || []).forEach((alert, idx) => {
            notifs.push({ 
              id: `prod-alert-${alert.related_op_id || idx}`, 
              title: alert.title, 
              message: alert.message, 
              severity: alert.severity || 'medium', 
              page: alert.page || 'ProductionOrders' 
            });
          });
        }

        // 2. Notificações Customizadas (Entidade DB)
        if (hasAccess('SalesAppointments')) {
          userNotifications?.forEach(notif => {
            notifs.push({ 
              id: notif.id, 
              title: notif.title, 
              message: notif.message, 
              severity: notif.type === 'VISITA_PROXIMA' ? 'high' : notif.type === 'VISITA_CANCELADA' ? 'critical' : 'medium', 
              page: 'SalesAppointments', 
              isCustomNotification: true 
            });
          });
        }

        // 3. Produção (OPs e Etapas)
        if (hasAccess('ProductionOrders')) {
          productionOrders?.forEach(op => {
            const label = `OP ${op.op_number || op.numero_op_externo || ''} — ${op.product_name}`;
            if (isRecent(op.created_date)) notifs.push({ id: `op-created-${op.id}`, title: 'Nova OP Aberta', message: label, severity: 'info', page: 'ProductionOrders' });
            if (op.status === 'ENCERRADA' && isRecent(op.closed_at || op.updated_date)) notifs.push({ id: `op-closed-${op.id}`, title: 'OP Encerrada', message: `${label} finalizada`, severity: 'low', page: 'ProductionOrders' });
          });

          productionSteps?.forEach(step => {
            if (step.status !== 'CONCLUIDA' && step.status !== 'PULADA' && step.scheduled_end_date) {
              const daysLate = differenceInDays(new Date(), parseISO(step.scheduled_end_date));
              if (daysLate > 0) notifs.push({ id: `step-late-${step.id}`, title: 'Atraso no Cronograma', message: `Etapa "${step.name}" atrasada ${daysLate} dia(s)`, severity: daysLate > 3 ? 'critical' : 'high', page: 'ProductionOrders' });
            }
          });

          productionRequests?.forEach(req => {
            if ((req.status === 'PENDENTE' || req.status === 'EM_PRODUCAO') && req.due_date) {
              const days = differenceInDays(parseISO(req.due_date), new Date());
              if (days < 0) notifs.push({ id: `pr-overdue-${req.id}`, title: 'Solicitação Atrasada', message: `${req.product_name} — ${Math.abs(days)} dias atrasado`, severity: 'critical', page: 'ProductionRequests' });
              else if (days === 0) notifs.push({ id: `pr-today-${req.id}`, title: 'Vencimento Hoje', message: `${req.product_name} — vence hoje`, severity: 'high', page: 'ProductionRequests' });
            }
          });
        }

        // 4. Estoque
        if (hasAccess('InventoryMoves')) {
          inventoryMoves?.forEach(move => {
            if (isRecent(move.created_date)) {
              const typeLabel = { ENTRADA: 'Entrada de Estoque', SAIDA: 'Saída de Estoque', AJUSTE: 'Ajuste', BAIXA: 'Baixa ⚠️' }[move.type] || move.type;
              const prod = productMap[move.product_id];
              const sku = prod?.sku || move.product_sku || '';
              const message = `${sku ? `${sku} | ` : ''}${typeLabel} | Qtd: ${move.qty}`;
              notifs.push({ id: `inv-${move.id}`, title: typeLabel, message, severity: move.type === 'BAIXA' ? 'medium' : 'info', page: 'InventoryMoves' });
            }
          });
        }

        // 5. Vendas
        if (hasAccess('SalesOrders')) {
          salesOrders?.forEach(order => {
            if (isRecent(order.created_date)) notifs.push({ id: `so-new-${order.id}`, title: 'Novo Pedido', message: `${order.order_number || ''} — ${order.client_name}`, severity: 'info', page: 'SalesOrders' });
            if (order.status !== 'CANCELADO' && order.status !== 'EXPEDIDO' && order.delivery_date) {
              const days = differenceInDays(parseISO(order.delivery_date), new Date());
              if (days < 0) notifs.push({ id: `so-overdue-${order.id}`, title: 'Pedido Atrasado', message: `${order.client_name} — ${Math.abs(days)} dias atrasado`, severity: 'critical', page: 'SalesOrders' });
              else if (days === 0) notifs.push({ id: `so-today-${order.id}`, title: 'Entrega Hoje', message: `${order.client_name} — entrega hoje`, severity: 'high', page: 'SalesOrders' });
            }
          });

          quotes?.forEach(quote => {
            if (isRecent(quote.created_date)) notifs.push({ id: `quote-new-${quote.id}`, title: 'Novo Orçamento', message: `${quote.quote_number || ''} — ${quote.client_name || ''}`, severity: 'info', page: 'Quotes' });
          });

          appointments?.forEach(appt => {
            if (isRecent(appt.created_date)) notifs.push({ id: `appt-new-${appt.id}`, title: 'Nova Agenda', message: `${appt.title}`, severity: 'info', page: 'SalesAppointments' });
          });
        }

        // Filtragem final: Remover duplicados, Remover Dismissed (Lidos) e Ordenar
        const unique = [];
        const seen = new Set();
        
        notifs
          .sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4))
          .forEach(n => {
            if (!seen.has(n.id) && !dismissedIds.current.has(n.id)) {
              unique.push(n);
              seen.add(n.id);
            }
          });

        setNotifications(unique.slice(0, 30));

        // Toast Automático (apenas para o primeiro item crítico/alto novo ainda não visto nesta sessão)
        const top = unique.find(n => !shownToastIds.current.has(n.id));
        if (top) showToast(top);

      } catch (error) {
        console.error('Erro ao buscar notificações:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 180000); 
    return () => clearInterval(interval);
  }, [companyId]);

  return (
    <>
      {/* Toast flutuante automático (5s) */}
      {toast && <NotificationToast notification={toast} onDismiss={dismissToast} />}

      {/* Painel de notificações */}
      {open && (
        <div className="absolute right-0 mt-2 w-[420px] bg-white rounded-lg shadow-xl border border-slate-200 z-50 max-h-[560px] flex flex-col">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <h3 className="font-semibold text-slate-900">Notificações ({notifications.length})</h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-6 text-center text-slate-500 text-sm">Carregando...</div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma notificação pendente</p>
                <p className="text-[10px] mt-1">Recém lidas ou filtradas por módulo</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notif) => {
                  const cfg = severityConfig[notif.severity] || severityConfig.info;
                  return (
                    <Link
                      key={notif.id}
                      to={createPageUrl(notif.page)}
                      onClick={() => handleReadNotification(notif)}
                      className={`block px-4 py-3 hover:brightness-95 transition-all ${cfg.color}`}
                    >
                      <div className="flex items-start gap-3">
                        {cfg.icon}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{notif.message}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}