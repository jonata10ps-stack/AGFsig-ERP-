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

  // "Minha Agenda" only: usuário não-admin sem nenhum módulo dos AVAILABLE_MODULES
  // (tem apenas acesso à agenda/prospecção)
  const MAIN_MODULES = ['Cadastros', 'Vendas', 'Estoque', 'Producao', 'PosVendas', 'Qualidade', 'Relatorios', 'Engenharia', 'GerenciamentoDados'];
  const hasAnyMainModule = user?.role === 'admin' || MAIN_MODULES.some(m => user?.allowed_modules?.includes(m));
  
  // Aguardar carregamento do usuário antes de decidir
  if (!user) return null;
  
  if (!hasAnyMainModule) return <ProspectionDashboard />;

  return (
    <div className="min-h-screen space-y-8 pb-12">
      {/* Premium Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-5">
           <div className="p-4 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl shadow-xl shadow-indigo-100">
              <LayoutDashboard className="h-8 w-8 text-white" />
           </div>
           <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                Olá, {user?.name?.split(' ')[0] || 'Gestor'}!
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-slate-500 font-medium text-sm">
                  {editMode ? 'Modo de personalização ativo' : 'Seu painel está atualizado e operacional'}
                </p>
              </div>
           </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {editMode ? (
            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" onClick={() => setShowSelector(true)} className="rounded-2xl border-slate-200">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
              <Button variant="outline" onClick={handleResetDefault} className="rounded-2xl border-slate-200">
                Restaurar
              </Button>
            </div>
          ) : (
            <div className="hidden lg:flex flex-col items-end mr-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status do Sistema</p>
              <p className="text-sm font-bold text-emerald-600">Online & Sincronizado</p>
            </div>
          )}
          
          <Button
            variant={editMode ? 'default' : 'outline'}
            onClick={() => setEditMode(!editMode)}
            className={`rounded-2xl transition-all duration-300 ${editMode ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100' : 'border-slate-200 hover:bg-slate-50'}`}
          >
            <Settings className={`h-4 w-4 mr-2 ${editMode ? 'animate-spin' : ''}`} />
            {editMode ? 'Concluir' : 'Personalizar'}
          </Button>
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