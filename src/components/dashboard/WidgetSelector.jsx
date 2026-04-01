import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Package, Clock, ClipboardList, Factory, BarChart3 } from 'lucide-react';

const AVAILABLE_WIDGETS = [
  { 
    id: 'sales-kpi', 
    name: 'KPI de Vendas', 
    description: 'Total em vendas e pedidos confirmados',
    icon: ShoppingCart,
    size: 'small'
  },
  { 
    id: 'stock-status', 
    name: 'Status de Estoque', 
    description: 'Itens em estoque e alertas',
    icon: Package,
    size: 'small'
  },
  { 
    id: 'pending-items', 
    name: 'Pendente Armazenamento', 
    description: 'Itens aguardando alocação',
    icon: Clock,
    size: 'small'
  },
  { 
    id: 'open-requests', 
    name: 'Solicitações Abertas', 
    description: 'Materiais e serviços pendentes',
    icon: ClipboardList,
    size: 'small'
  },
  { 
    id: 'pending-production-requests', 
    name: 'Solicitações Pendentes', 
    description: 'Solicitações de produção em aberto',
    icon: Factory,
    size: 'large'
  },
  { 
    id: 'recent-orders', 
    name: 'Pedidos Recentes', 
    description: 'Últimos pedidos de venda',
    icon: ShoppingCart,
    size: 'large'
  },
  { 
    id: 'production-op', 
    name: 'Ordens de Produção', 
    description: 'OPs em andamento',
    icon: Factory,
    size: 'large'
  },
];

export default function WidgetSelector({ open, onClose, onAddWidget, existingWidgets }) {
  const availableToAdd = AVAILABLE_WIDGETS.filter(
    w => !existingWidgets.find(ew => ew.id === w.id)
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Widget</DialogTitle>
          <DialogDescription>
            Selecione um widget para adicionar ao seu dashboard
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4">
          {availableToAdd.map((widget) => {
            const Icon = widget.icon;
            return (
              <button
                key={widget.id}
                onClick={() => {
                  onAddWidget({ ...widget, position: existingWidgets.length });
                  onClose();
                }}
                className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-indigo-300 transition-all text-left"
              >
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Icon className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900">{widget.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{widget.description}</p>
                </div>
              </button>
            );
          })}
          {availableToAdd.length === 0 && (
            <div className="col-span-2 text-center py-8 text-slate-500">
              <p>Todos os widgets já foram adicionados</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}