import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowRight, MapPin, Layers, FileText, ShoppingCart } from 'lucide-react';

/**
 * CommercialPipelineBadge
 * Props:
 *   visitId, visitDate, visitClientName  -- optional
 *   projectId, projectName               -- optional
 *   quoteId, quoteNumber                 -- optional
 *   orderId, orderNumber                 -- optional
 *   current: 'visit' | 'project' | 'quote' | 'order'  -- highlights the current step
 */
export default function CommercialPipelineBadge({
  visitId, visitDate, visitClientName,
  projectId, projectName,
  quoteId, quoteNumber,
  orderId, orderNumber,
  current,
}) {
  const steps = [];

  if (visitId || current === 'visit') {
    steps.push({
      key: 'visit',
      icon: MapPin,
      label: visitClientName ? `Visita: ${visitClientName}` : 'Visita',
      url: visitId ? createPageUrl('ProspectionVisitDetail') + `?id=${visitId}` : null,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      activeColor: 'bg-indigo-600 text-white border-indigo-600',
    });
  }

  if (projectId || current === 'project') {
    steps.push({
      key: 'project',
      icon: Layers,
      label: projectName ? `Projeto: ${projectName}` : 'Projeto',
      url: projectId ? createPageUrl('ProspectionProjects') : null,
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      activeColor: 'bg-purple-600 text-white border-purple-600',
    });
  }

  if (quoteId || current === 'quote') {
    steps.push({
      key: 'quote',
      icon: FileText,
      label: quoteNumber ? `Orçamento ${quoteNumber}` : 'Orçamento',
      url: quoteId ? createPageUrl('QuoteDetail') + `?id=${quoteId}` : null,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      activeColor: 'bg-blue-600 text-white border-blue-600',
    });
  }

  if (orderId || current === 'order') {
    steps.push({
      key: 'order',
      icon: ShoppingCart,
      label: orderNumber ? `Pedido ${orderNumber}` : 'Pedido de Venda',
      url: orderId ? createPageUrl('SalesOrderDetail') + `?id=${orderId}` : null,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      activeColor: 'bg-emerald-600 text-white border-emerald-600',
    });
  }

  if (steps.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-1">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isActive = step.key === current;
        const colorClass = isActive ? step.activeColor : step.color;

        const chip = (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium transition-colors ${colorClass} ${step.url && !isActive ? 'hover:opacity-80 cursor-pointer' : ''}`}
          >
            <Icon className="h-3 w-3 flex-shrink-0" />
            <span className="max-w-[120px] truncate">{step.label}</span>
          </div>
        );

        return (
          <React.Fragment key={step.key}>
            {step.url && !isActive ? (
              <Link to={step.url}>{chip}</Link>
            ) : chip}
            {i < steps.length - 1 && (
              <ArrowRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
