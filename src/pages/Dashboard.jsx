import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, GripVertical, X, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import ProspectionDashboard from './ProspectionDashboard';

// Import widgets
import SalesKPIWidget from '../components/dashboard/widgets/SalesKPIWidget';
import StockStatusWidget from '../components/dashboard/widgets/StockStatusWidget';
import PendingItemsWidget from '../components/dashboard/widgets/PendingItemsWidget';
import OpenRequestsWidget from '../components/dashboard/widgets/OpenRequestsWidget';
import RecentOrdersWidget from '../components/dashboard/widgets/RecentOrdersWidget';
import ProductionOPWidget from '../components/dashboard/widgets/ProductionOPWidget';
import PendingProductionRequestsWidget from '../components/dashboard/widgets/PendingProductionRequestsWidget';
import WidgetSelector from '../components/dashboard/WidgetSelector';

const WIDGET_COMPONENTS = {
  'sales-kpi': SalesKPIWidget,
  'stock-status': StockStatusWidget,
  'pending-items': PendingItemsWidget,
  'open-requests': OpenRequestsWidget,
  'recent-orders': RecentOrdersWidget,
  'production-op': ProductionOPWidget,
  'pending-production-requests': PendingProductionRequestsWidget,
};

const DEFAULT_WIDGETS = [
  { id: 'sales-kpi', position: 0, size: 'small' },
  { id: 'stock-status', position: 1, size: 'small' },
  { id: 'pending-items', position: 2, size: 'small' },
  { id: 'open-requests', position: 3, size: 'small' },
  { id: 'pending-production-requests', position: 4, size: 'large' },
  { id: 'recent-orders', position: 5, size: 'large' },
  { id: 'production-op', position: 6, size: 'large' },
];

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [editMode, setEditMode] = useState(false);
  const [showSelector, setShowSelector] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['current-user-dashboard'],
    queryFn: () => base44.auth.me(),
  });

  const { data: config } = useQuery({
    queryKey: ['dashboard-config', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const currentCompanyId = localStorage.getItem('selectedCompanyId') || '';
      const configs = await base44.entities.DashboardConfig.filter({ user_id: user.id, company_id: currentCompanyId });
      return configs[0] || null;
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Atualizar a cada 60 segundos
  });

  useEffect(() => {
    if (config?.widgets && config.widgets.length > 0) {
      setWidgets(config.widgets);
    }
  }, [config]);

  const saveConfigMutation = useMutation({
    mutationFn: async (newWidgets) => {
      if (!user?.id) return;
      
      if (config?.id) {
        await base44.entities.DashboardConfig.update(config.id, { widgets: newWidgets });
      } else {
        const currentCompanyId = localStorage.getItem('selectedCompanyId') || '';
        await base44.entities.DashboardConfig.create({
          user_id: user.id,
          company_id: currentCompanyId,
          widgets: newWidgets,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-config'] });
      toast.success('Dashboard salvo!');
    },
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const newWidgets = Array.from(widgets);
    const [reordered] = newWidgets.splice(result.source.index, 1);
    newWidgets.splice(result.destination.index, 0, reordered);

    const updatedWidgets = newWidgets.map((w, index) => ({ ...w, position: index }));
    setWidgets(updatedWidgets);
    saveConfigMutation.mutate(updatedWidgets);
  };

  const handleRemoveWidget = (widgetId) => {
    const newWidgets = widgets.filter(w => w.id !== widgetId).map((w, index) => ({ ...w, position: index }));
    setWidgets(newWidgets);
    saveConfigMutation.mutate(newWidgets);
  };

  const handleAddWidget = (widget) => {
    const newWidgets = [...widgets, widget];
    setWidgets(newWidgets);
    saveConfigMutation.mutate(newWidgets);
  };

  const handleResetDefault = () => {
    setWidgets(DEFAULT_WIDGETS);
    saveConfigMutation.mutate(DEFAULT_WIDGETS);
  };

  const MAIN_MODULES = ['Cadastros', 'Vendas', 'Estoque', 'Producao', 'PosVendas', 'Qualidade', 'Relatorios', 'Engenharia', 'GerenciamentoDados'];
  const userRole = String(user?.role || '').toLowerCase();
  const userAllowed = Array.isArray(user?.allowed_modules) ? user.allowed_modules : [];
  const hasAnyMainModule = userRole === 'admin' || MAIN_MODULES.some(m => userAllowed.includes(m));
  
  // Aguardar carregamento do usuário antes de decidir
  if (!user) {
    return (
      <div className="flex items-center justify-center p-12 min-h-[400px]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!hasAnyMainModule) return <ProspectionDashboard />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-8 rounded-2xl shadow-lg mb-8 border border-white/10 group">
        {/* Decorative backdrop shapes */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out"></div>
        
        <div className="relative z-10 w-full flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-md pb-1">
              Dashboard
            </h1>
            <p className="text-indigo-100/90 font-medium text-sm md:text-base mt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]"></span>
              {editMode ? 'Modo de Edição — Arraste os painéis para reorganizar' : 'Visão estratégica e monitoramento em tempo real'}
            </p>
          </div>
          <div className="flex gap-3 mt-6 sm:mt-0">
            {editMode && (
              <>
                <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-none shadow-sm backdrop-blur-md" onClick={() => setShowSelector(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Widget
                </Button>
                <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-none shadow-sm backdrop-blur-md" onClick={handleResetDefault}>
                  Restaurar Padrão
                </Button>
              </>
            )}
            <Button
              className={editMode ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-transparent shadow-md' : 'bg-white text-indigo-600 hover:bg-slate-50 transition-all shadow-md hover:shadow-lg'}
              onClick={() => setEditMode(!editMode)}
            >
              <Settings className="h-4 w-4 mr-2" />
              {editMode ? 'Concluir Edição' : 'Personalizar'}
            </Button>
          </div>
        </div>
      </div>

      {/* Widgets Grid */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dashboard-widgets">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {widgets.map((widget, index) => {
                const WidgetComponent = WIDGET_COMPONENTS[widget.id];
                if (!WidgetComponent) return null;

                return (
                  <Draggable
                    key={widget.id}
                    draggableId={widget.id}
                    index={index}
                    isDragDisabled={!editMode}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`
                          ${widget.size === 'large' ? 'md:col-span-2' : 'md:col-span-1'}
                          ${snapshot.isDragging ? 'opacity-50' : ''}
                          relative
                        `}
                      >
                        {editMode && (
                          <div className="absolute top-2 right-2 z-10 flex gap-1">
                            <button
                              {...provided.dragHandleProps}
                              className="p-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical className="h-4 w-4 text-slate-400" />
                            </button>
                            <button
                              onClick={() => handleRemoveWidget(widget.id)}
                              className="p-1.5 bg-white rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200"
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </button>
                          </div>
                        )}
                        <WidgetComponent />
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {widgets.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
          <p className="text-slate-500 mb-4">Nenhum widget adicionado</p>
          <Button onClick={() => setShowSelector(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Primeiro Widget
          </Button>
        </div>
      )}

      {/* Widget Selector Dialog */}
      <WidgetSelector
        open={showSelector}
        onClose={() => setShowSelector(false)}
        onAddWidget={handleAddWidget}
        existingWidgets={widgets}
      />
    </div>
  );
}