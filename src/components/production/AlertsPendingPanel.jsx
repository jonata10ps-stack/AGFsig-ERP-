import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import AlertBadge from './AlertBadge';
import moment from 'moment';

export default function AlertsPendingPanel({ alertSteps, onReschedule }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (alertSteps.length === 0) return null;

  const dangerAlerts = alertSteps.filter(s => s.alert.type === 'danger');
  const warningAlerts = alertSteps.filter(s => s.alert.type === 'warning');

  return (
    <Card className="border-red-200 bg-gradient-to-r from-red-50 via-orange-50 to-red-50 overflow-hidden">
      <CardHeader 
        className="cursor-pointer hover:bg-red-100/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500 flex items-center justify-center">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-red-900 flex items-center gap-2">
                Alertas Pendentes
                <Badge className="bg-red-600 hover:bg-red-700">
                  {alertSteps.length}
                </Badge>
              </CardTitle>
              <p className="text-sm text-red-700 mt-1">
                {dangerAlerts.length} críticos • {warningAlerts.length} avisos
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-red-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-red-600" />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3">
          {dangerAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-red-900 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Críticos ({dangerAlerts.length})
              </h4>
              {dangerAlerts.map(step => (
                <AlertRow key={step.id} step={step} onReschedule={onReschedule} />
              ))}
            </div>
          )}

          {warningAlerts.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-red-200">
              <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Avisos ({warningAlerts.length})
              </h4>
              {warningAlerts.map(step => (
                <AlertRow key={step.id} step={step} onReschedule={onReschedule} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function AlertRow({ step, onReschedule }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border-l-4 transition-all hover:shadow-md ${
      step.alert.type === 'danger'
        ? 'bg-red-100 border-red-500 hover:bg-red-100/80'
        : 'bg-amber-100 border-amber-500 hover:bg-amber-100/80'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900">
            OP {step.op?.numero_op_externo} - Seq {step.sequence}
          </span>
          <span className="text-sm text-slate-700 truncate">
            {step.name}
          </span>
          <Badge className={step.statusInfo.color} variant="outline">
            {step.statusInfo.label}
          </Badge>
        </div>
        <div className="text-xs text-slate-700 mt-1 space-y-0.5">
          <p>Recurso: {step.resource_name || '-'}</p>
          <p>Prazo: {moment(step.scheduled_end_date).format('DD/MM/YYYY')} 
            {step.alert.type === 'danger' && (
              <span className="text-red-600 font-semibold ml-2">Atrasada</span>
            )}
            {step.alert.type === 'warning' && (
              <span className="text-amber-600 font-semibold ml-2">Vence em 3 dias</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-3">
        <AlertBadge 
          step={step}
          onReschedule={onReschedule}
        />
      </div>
    </div>
  );
}