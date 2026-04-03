import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Bell, X, AlertTriangle, Clock, Factory, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { differenceInDays, differenceInHours, parseISO } from 'date-fns';

const severityConfig = {
  critical: { color: 'bg-red-50 border-l-4 border-red-500',     icon: <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" /> },
  high:     { color: 'bg-orange-50 border-l-4 border-orange-500', icon: <Clock className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" /> },
  medium:   { color: 'bg-yellow-50 border-l-4 border-yellow-500', icon: <Factory className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" /> },
  low:      { color: 'bg-blue-50 border-l-4 border-blue-500',    icon: <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" /> },
  info:     { color: 'bg-slate-50 border-l-4 border-slate-400',  icon: <Bell className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" /> },
};

const RECENT_HOURS = 48;

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
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  // Persiste IDs já vistos no localStorage para não repetir após reload
  const shownToastIds = useRef(new Set(
    JSON.parse(localStorage.getItem('notif_seen_ids') || '[]')
  ));

  useEffect(() => {
    base44.auth.me().then(u => {
      const cid = u?.current_company_id || u?.company_ids?.[0] || u?.company_id || null;
      setCompanyId(cid);
    }).catch(() => {});
  }, []);

  const dismissToast = () => {
    clearTimeout(toastTimerRef.current);
    setToast(null);
  };

  const showToast = (notif) => {
    if (shownToastIds.current.has(notif.id)) return;
    shownToastIds.current.add(notif.id);
    // Persiste no localStorage para não reaparecer após reload
    localStorage.setItem('notif_seen_ids', JSON.stringify([...shownToastIds.current].slice(-200)));
    setToast(notif);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    if (!companyId) return;

    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const user = await base44.auth.me();
        const cid = user?.current_company_id || user?.company_ids?.[0] || user?.company_id;
        if (!cid) return;

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
          base44.functions.invoke('generateProductionAlerts', {}).then(r => r.data?.alerts || []).catch(e => {
            console.warn('Edge Function generateProductionAlerts falhou (CORS ou inexistente):', e);
            return [];
          }),
          base44.entities.ProductionOrder.filter({ company_id: cid }, '-created_date', 100),
          base44.entities.InventoryMove.filter({ company_id: cid }, '-created_date', 50),
          base44.entities.Quote.filter({ company_id: cid }, '-created_date', 30),
          base44.entities.SalesAppointment.filter({ company_id: cid }, '-created_date', 30),
          base44.entities.ProductionStep.filter({ company_id: cid }, '-created_at', 100),
          base44.entities.Product.filter({ company_id: cid }, 'sku', 500),
        ]);

        const productionAlertsSafe = (productionAlerts && Array.isArray(productionAlerts)) ? productionAlerts : [];
        const productMap = Object.fromEntries((products || []).map(p => [p.id, p]));

        const notifs = [];

        productionAlertsSafe.forEach((alert, idx) => {
          notifs.push({ id: `prod-alert-${idx}-${alert.related_op_id || idx}`, title: alert.title, message: alert.message, severity: alert.severity || 'medium', page: alert.page || 'ProductionOrders' });
        });

        userNotifications?.forEach(notif => {
          notifs.push({ id: notif.id, title: notif.title, message: notif.message, severity: notif.type === 'VISITA_PROXIMA' ? 'high' : notif.type === 'VISITA_CANCELADA' ? 'critical' : 'medium', page: 'SalesAppointments', isCustomNotification: true });
        });

        productionOrders?.forEach(op => {
          const label = `OP ${op.op_number || op.numero_op_externo || ''} — ${op.product_name}`;
          if (isRecent(op.created_date)) notifs.push({ id: `op-created-${op.id}`, title: 'Nova OP Aberta', message: label, severity: 'info', page: 'ProductionOrders' });
          if (op.status === 'EM_ANDAMENTO' && isRecent(op.updated_date)) notifs.push({ id: `op-started-${op.id}`, title: 'OP Iniciada', message: `${label} em andamento`, severity: 'low', page: 'ProductionOrders' });
          if (op.status === 'ENCERRADA' && isRecent(op.closed_at || op.updated_date)) notifs.push({ id: `op-closed-${op.id}`, title: 'OP Encerrada', message: `${label} — Produzido: ${op.qty_produced}`, severity: 'low', page: 'ProductionOrders' });
          if (op.qty_produced > 0 && isRecent(op.updated_date) && op.status !== 'ENCERRADA') notifs.push({ id: `op-produced-${op.id}`, title: 'Registro de Produção', message: `${label}: ${op.qty_produced}/${op.qty_planned} produzidos`, severity: 'info', page: 'ProductionOrders' });
        });

        productionSteps?.forEach(step => {
          if (step.status !== 'CONCLUIDA' && step.status !== 'PULADA' && step.scheduled_end_date) {
            const daysLate = differenceInDays(new Date(), parseISO(step.scheduled_end_date));
            if (daysLate > 0) notifs.push({ id: `step-late-${step.id}`, title: 'Atraso no Cronograma', message: `Etapa "${step.name}" atrasada ${daysLate} dia(s)`, severity: daysLate > 3 ? 'critical' : 'high', page: 'ProductionOrders' });
          }
        });

        inventoryMoves?.forEach(move => {
          if (isRecent(move.created_date)) {
            const typeLabel = { ENTRADA: 'Entrada de Estoque', SAIDA: 'Saída de Estoque', TRANSFERENCIA: 'Transferência', RESERVA: 'Reserva', SEPARACAO: 'Separação', PRODUCAO_ENTRADA: 'Entrada de Produção', PRODUCAO_CONSUMO: 'Consumo de Produção', AJUSTE: 'Ajuste de Estoque', BAIXA: 'Baixa de Estoque' }[move.type] || move.type;
            // Busca SKU do produto nas notificações (produto já pode estar na movimentação via related fields ou não)
            const prod = productMap[move.product_id];
            const sku = prod?.sku || move.product_sku || '';
            const skuInfo = sku ? `${sku} | ` : '';
            const message = `${skuInfo}${typeLabel} | Qtd: ${move.qty}${move.reason ? ` | ${move.reason}` : ''}`;
            notifs.push({ id: `inv-${move.id}`, title: typeLabel, message, severity: move.type === 'BAIXA' || move.type === 'SAIDA' ? 'medium' : 'info', page: 'InventoryMoves' });
          }
        });

        salesOrders?.forEach(order => {
          if (isRecent(order.created_date)) notifs.push({ id: `so-new-${order.id}`, title: 'Novo Pedido', message: `${order.order_number || ''} — ${order.client_name}`, severity: 'low', page: 'SalesOrders' });
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
          if (isRecent(appt.created_date)) notifs.push({ id: `appt-new-${appt.id}`, title: 'Nova Agenda', message: `${appt.title}${appt.client_name ? ` — ${appt.client_name}` : ''}`, severity: 'info', page: 'SalesAppointments' });
        });

        productionRequests?.forEach(req => {
          if ((req.status === 'PENDENTE' || req.status === 'EM_PRODUCAO') && req.due_date) {
            const days = differenceInDays(parseISO(req.due_date), new Date());
            if (days < 0) notifs.push({ id: `pr-overdue-${req.id}`, title: 'Solicitação Atrasada', message: `${req.product_name} — ${Math.abs(days)} dias atrasado`, severity: 'critical', page: 'ProductionRequests' });
            else if (days === 0) notifs.push({ id: `pr-today-${req.id}`, title: 'Vencimento Hoje', message: `${req.product_name} — vence hoje`, severity: 'high', page: 'ProductionRequests' });
            else if (days <= 2) notifs.push({ id: `pr-soon-${req.id}`, title: 'Vencimento Próximo', message: `${req.product_name} — vence em ${days} dia(s)`, severity: 'medium', page: 'ProductionRequests' });
          }
        });

        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        notifs.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));
        const seen = new Set();
        const unique = [];
        notifs.forEach(n => { if (!seen.has(n.id)) { unique.push(n); seen.add(n.id); } });

        setNotifications(unique.slice(0, 30));

        // Mostrar toast automático para qualquer notificação ainda não exibida (prioridade: critical > high > medium > low > info)
        const top = unique.find(n => !shownToastIds.current.has(n.id));
        if (top) showToast(top);

      } catch (error) {
        console.error('Erro ao buscar notificações:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
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
              <div className="p-6 text-center text-slate-500">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notif) => {
                  const cfg = severityConfig[notif.severity] || severityConfig.info;
                  return (
                    <Link
                      key={notif.id}
                      to={createPageUrl(notif.page)}
                      onClick={async () => {
                        if (notif.isCustomNotification) {
                          await base44.entities.Notification.update(notif.id, { is_read: true, read_at: new Date().toISOString() });
                        }
                        onClose();
                      }}
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