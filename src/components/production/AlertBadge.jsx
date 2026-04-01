import React, { useState } from 'react';
import { Bell, AlertCircle, Clock, Zap } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import moment from 'moment';

export default function AlertBadge({ step, onReschedule }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!step.alert) return null;

  const alertConfig = {
    danger: {
      icon: AlertCircle,
      color: 'text-red-600 bg-red-50',
      title: 'Etapa Atrasada',
      description: 'Esta etapa ultrapassou a data prevista de conclusão',
      actions: ['Reagendar para priorizar', 'Aumentar recursos']
    },
    warning: {
      icon: Clock,
      color: 'text-amber-600 bg-amber-50',
      title: 'Prazo Próximo',
      description: 'Esta etapa vence nos próximos 3 dias',
      actions: ['Acelerar produção', 'Reagendar se necessário']
    }
  };

  const config = alertConfig[step.alert.type] || alertConfig.warning;
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <button
            className={`p-2 rounded-lg transition-all hover:scale-110 ${config.color}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
          >
            <Icon className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="w-72 p-0" side="right">
          <div className={`${config.color} rounded-lg p-4 border border-red-200`}>
            <div className="flex items-start gap-3 mb-3">
              <Icon className="h-5 w-5 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-sm">{config.title}</p>
                <p className="text-xs opacity-75 mt-1">{config.description}</p>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-current opacity-50">
              <p className="text-xs font-semibold">Ações Sugeridas:</p>
              {config.actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (action.includes('Reagendar')) {
                      onReschedule?.(step);
                    }
                    setIsOpen(false);
                  }}
                  className="w-full text-left text-xs p-2 rounded hover:bg-white hover:bg-opacity-30 transition-colors"
                >
                  • {action}
                </button>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-current opacity-50 text-xs space-y-1">
              <p><strong>Data Prevista:</strong> {moment(step.scheduled_end_date).format('DD/MM/YYYY')}</p>
              <p><strong>Sequência:</strong> {step.sequence}</p>
              <p><strong>Recurso:</strong> {step.resource_name || '-'}</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}