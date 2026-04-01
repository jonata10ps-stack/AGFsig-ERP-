import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = user.current_company_id || user.company_ids?.[0];
  if (!companyId) return Response.json({ alerts: [] });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const twoDaysFromNow = new Date(today);
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

  // Fetch steps and orders in parallel
  const [steps, orders] = await Promise.all([
    base44.asServiceRole.entities.ProductionStep.filter({ company_id: companyId }, '-created_date', 2000),
    base44.asServiceRole.entities.ProductionOrder.filter({ company_id: companyId }, '-created_date', 1000),
  ]);

  const ordersMap = Object.fromEntries(orders.map(o => [o.id, o]));

  const alerts = [];

  for (const step of steps) {
    const op = ordersMap[step.op_id];
    if (!op) continue;

    // Skip cancelled/closed ops
    if (['CANCELADA', 'ENCERRADA'].includes(op.status)) continue;
    // Skip completed steps
    if (['CONCLUIDA', 'PULADA', 'CANCELADA'].includes(step.status)) continue;

    if (!step.scheduled_end_date) continue;

    const endDate = new Date(step.scheduled_end_date);
    endDate.setHours(0, 0, 0, 0);

    const opLabel = op.numero_op_externo || op.op_number || 'OP';

    if (endDate < today) {
      // Overdue step
      const daysLate = Math.round((today - endDate) / (1000 * 60 * 60 * 24));
      alerts.push({
        type: 'ETAPA_ATRASADA',
        title: `Etapa Atrasada — ${opLabel}`,
        message: `Etapa "${step.name}" está ${daysLate} dia(s) atrasada. Produto: ${op.product_name}`,
        severity: 'critical',
        related_op_id: op.id,
        related_step_id: step.id,
        page: 'ProductionSchedule',
      });
    } else if (endDate <= twoDaysFromNow) {
      // About to be late
      const daysLeft = Math.round((endDate - today) / (1000 * 60 * 60 * 24));
      alerts.push({
        type: 'ETAPA_PRESTES_ATRASAR',
        title: `Etapa Vence em Breve — ${opLabel}`,
        message: `Etapa "${step.name}" vence em ${daysLeft === 0 ? 'hoje' : daysLeft + ' dia(s)'}. Produto: ${op.product_name}`,
        severity: 'high',
        related_op_id: op.id,
        related_step_id: step.id,
        page: 'ProductionSchedule',
      });
    }
  }

  // Critical OP status changes: OPs paused or overdue due_date
  for (const op of orders) {
    if (op.status === 'CANCELADA') continue;
    if (op.status === 'PAUSADA') {
      alerts.push({
        type: 'OP_STATUS_CRITICA',
        title: `OP Pausada — ${op.numero_op_externo || op.op_number}`,
        message: `A OP de "${op.product_name}" está PAUSADA. Verifique o motivo.`,
        severity: 'high',
        related_op_id: op.id,
        page: 'ProductionOrders',
      });
    }
    if (op.due_date && op.status !== 'ENCERRADA') {
      const due = new Date(op.due_date);
      due.setHours(0, 0, 0, 0);
      if (due < today) {
        const daysLate = Math.round((today - due) / (1000 * 60 * 60 * 24));
        alerts.push({
          type: 'OP_STATUS_CRITICA',
          title: `OP com Prazo Vencido — ${op.numero_op_externo || op.op_number}`,
          message: `A OP de "${op.product_name}" está ${daysLate} dia(s) atrasada.`,
          severity: 'critical',
          related_op_id: op.id,
          page: 'ProductionOrders',
        });
      }
    }
  }

  // Sort by severity
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

  return Response.json({ alerts: alerts.slice(0, 30) });
});