import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import NotificationsPanel from '@/components/NotificationsPanel';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Factory,
  BarChart3,
  Settings,
  Users,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Bell,
  Search,
  FileText,
  MapPin,
  ClipboardList,
  Truck,
  PackageCheck,
  GitBranch,
  History,
  Cog,
  CheckCircle2,
  AlertCircle,
  Calendar,
  RotateCcw,
  Book,
  Cpu,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import AccessControl from '@/components/AccessControl';
import CompanySelector from '@/components/CompanySelector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Toaster } from 'sonner';

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
  { name: 'Dashboard Fábrica', icon: Factory, page: 'FactoryDashboard' },
  { name: 'Gerador de Etiquetas', icon: Package, page: 'LabelGenerator' },
  { 
    name: 'Minha Agenda', 
    icon: Calendar,
    children: [
      { name: 'Agenda de Visitas', icon: Calendar, page: 'SalesAppointments' },
      { name: 'Dashboard Prospecção', icon: BarChart3, page: 'ProspectionDashboard' },
      { name: 'Prospecção', icon: Users, page: 'ProspectionVisits' },
      { name: 'Projetos', icon: Package, page: 'ProspectionProjects' },
      { name: 'Registro de KM', icon: Cog, page: 'DailyVehicleLog' },
    ]
  },
  { 
    name: 'Cadastros', 
    icon: FileText,
    moduleId: 'Cadastros',
    children: [
      { name: 'Produtos', icon: Package, page: 'Products' },
      { name: 'Clientes', icon: Users, page: 'Clients' },
      { name: 'Vendedores', icon: Users, page: 'Sellers' },
      { name: 'Armazéns', icon: Warehouse, page: 'Warehouses' },
      { name: 'Localizações', icon: MapPin, page: 'Locations' },
      { name: 'Centro de Custos', icon: Cog, page: 'CostCenters' },
      { name: 'Condições de Pagamento', icon: FileText, page: 'PaymentConditions' },
    ]
  },
  { 
    name: 'Vendas', 
    icon: ShoppingCart,
    moduleId: 'Vendas',
    children: [
      { name: 'Orçamentos', icon: FileText, page: 'Quotes' },
      { name: 'Pedidos', icon: ClipboardList, page: 'SalesOrders' },
      { name: 'Remessas', icon: Package, page: 'Shipments' },
      { name: 'Retornos', icon: RotateCcw, page: 'ShipmentReturns' },
      { name: 'Separação', icon: PackageCheck, page: 'Separation' },
      { name: 'Expedição', icon: Truck, page: 'Shipping' },
      { name: 'Reservas', icon: Package, page: 'Reservations' },
    ]
  },
  { 
    name: 'Estoque', 
    icon: Warehouse,
    moduleId: 'Estoque',
    children: [
      { name: 'Solicitações', icon: ClipboardList, page: 'MaterialRequests' },
      { name: 'Recebimentos', icon: PackageCheck, page: 'ReceivingList' },
      { name: 'Conferência', icon: CheckCircle2, page: 'ReceivingConferenceList' },
      { name: 'Alocação', icon: MapPin, page: 'StorageAllocation' },
      { name: 'Inventário', icon: ClipboardList, page: 'InventoryCount' },
      { name: 'Movimentações', icon: Truck, page: 'InventoryMoves' },
      { name: 'Saldos', icon: BarChart3, page: 'StockBalances' },
      { name: 'Empenho x Estoque', icon: AlertCircle, page: 'StockPledgeQuery' },
      { name: 'Localizador', icon: MapPin, page: 'StockLocator' },
      { name: 'Kardex', icon: FileText, page: 'Kardex' },
    ]
  },
  { 
    name: 'Produção', 
    icon: Factory,
    moduleId: 'Producao',
    children: [
      { name: 'Dashboard', icon: LayoutDashboard, page: 'ProductionDashboard' },
      { name: 'Solicitações', icon: ClipboardList, page: 'ProductionRequests' },
      { name: 'Ordens (OPs)', icon: Factory, page: 'ProductionOrders' },
      { name: 'Separação de BOM', icon: Package, page: 'BOMDeliveryPickingList' },
      { name: 'Controle de Consumo', icon: Package, page: 'OPConsumptionControl' },
      { name: 'Roteiros', icon: GitBranch, page: 'ProductionRoutes' },
      { name: 'Etapas de Roteiros', icon: GitBranch, page: 'ProductionRouteSteps' },
      { name: 'BOM', icon: FileText, page: 'BOMs' },
      { name: 'Recursos', icon: Cog, page: 'Resources' },
      { name: 'Simulação', icon: BarChart3, page: 'ProductionSimulation' },
      { name: 'Cronograma', icon: ClipboardList, page: 'ProductionSchedule' },
      { name: 'Importar Roteiros', icon: FileText, page: 'ImportRoutes' },
    ]
  },
  { 
    name: 'Pós-Vendas', 
    icon: Cog,
    moduleId: 'PosVendas',
    children: [
      { name: 'Dashboard', icon: LayoutDashboard, page: 'AfterSales' },
      { name: 'Solicitações', icon: ClipboardList, page: 'ServiceRequests' },
      { name: 'Ordens de Serviço', icon: Cog, page: 'ServiceOrders' },
      { name: 'Agenda', icon: Calendar, page: 'ServiceSchedule' },
      { name: 'Técnicos', icon: Users, page: 'Technicians' },
      { name: 'Devoluções', icon: Package, page: 'Returns' },
      { name: 'Controle de Séries', icon: Package, page: 'SerialNumberControl' },
      { name: 'Relatórios', icon: BarChart3, page: 'ServiceReports' },
      { name: 'Templates de Relatórios IA', icon: BarChart3, page: 'ReportTemplates' },
    ]
  },
  { 
    name: 'Qualidade', 
    icon: AlertCircle,
    moduleId: 'Qualidade',
    children: [
      { name: 'Não Conformidades', icon: AlertCircle, page: 'NonConformityReports' },
    ]
  },
  { 
    name: 'Relatórios', 
    icon: BarChart3,
    moduleId: 'Relatorios',
    children: [
      { name: 'Geral', icon: BarChart3, page: 'Reports' },
      { name: 'Estoque', icon: Package, page: 'StockReports' },
      { name: 'Itens Pendentes', icon: PackageCheck, page: 'PendingItemsReport' },
    ]
  },
  { name: 'Gestão de Usuários', icon: Users, page: 'UserManagement', adminOnly: true },
  { name: 'Empresas', icon: Users, page: 'CompanyManagement', adminOnly: true },
  { 
    name: 'Gerenciamento de Dados', 
    icon: Settings,
    moduleId: 'GerenciamentoDados',
    adminOnly: true,
    children: [
      { name: 'Dados Gerais', icon: Settings, page: 'DataManagement' },
      { name: 'Integração ERP', icon: Factory, page: 'ERPIntegration' },
      { name: 'Verificar Consistência', icon: AlertCircle, page: 'StockConsistencyCheck' },
      { name: 'Recalcular Saldos', icon: BarChart3, page: 'RecalculateStockBalance' },
      { name: 'Restaurar Dados', icon: Settings, page: 'RestoreCompanyData' },
      { name: 'Remover SKUs Duplicados', icon: Package, page: 'DeduplicateProducts' },
    ]
  },
  { 
    name: 'Engenharia', 
    icon: Cpu,
    moduleId: 'Engenharia',
    children: [
      { name: 'Dashboard', icon: LayoutDashboard, page: 'EngineeringDashboard' },
      { name: 'Projetos', icon: GitBranch, page: 'EngineeringProjects' },
      { name: 'Componentes', icon: Package, page: 'EngineeringComponents' },
      { name: 'Histórico de Componentes', icon: History, page: 'EngineeringComponentHistory' },
    ]
  },
  { name: 'Manual do ERP', icon: Book, page: 'Manual' },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [user, setUser] = useState(null);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);


  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.log('User not logged in');
      }
    };
    loadUser();
  }, []);

  const handleLogout = () => {
    base44.auth.logout();
  };

  const toggleMenu = (menuName) => {
    setExpandedMenu(expandedMenu === menuName ? null : menuName);
  };

  const NavItem = ({ item, mobile = false }) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenu === item.name;
    const Icon = item.icon;

    if (hasChildren) {
      return (
        <div className="space-y-1">
          <button
            onClick={() => !sidebarCollapsed && toggleMenu(item.name)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              sidebarCollapsed && !mobile && "justify-center px-0"
            )}
            title={sidebarCollapsed && !mobile ? item.name : undefined}
          >
            <span className="flex items-center gap-3">
              <Icon className={cn("h-5 w-5 shrink-0", sidebarCollapsed && !mobile && "h-6 w-6")} />
              {(!sidebarCollapsed || mobile) && <span className="truncate">{item.name}</span>}
            </span>
            {(!sidebarCollapsed || mobile) && (
              <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
            )}
          </button>
          {isExpanded && (!sidebarCollapsed || mobile) && (
            <div className="ml-4 pl-4 border-l border-slate-200 space-y-1">
              {item.children.map((child) => {
                const ChildIcon = child.icon;
                const isActive = currentPageName === child.page;
                return (
                  <Link
                    key={child.page}
                    to={createPageUrl(child.page)}
                    onClick={() => mobile && setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                      isActive
                        ? "bg-indigo-50 text-indigo-700 font-medium"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <ChildIcon className="h-4 w-4" />
                    {child.name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const isActive = currentPageName === item.page;
    return (
      <Link
        to={createPageUrl(item.page)}
        onClick={() => mobile && setSidebarOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          sidebarCollapsed && !mobile && "justify-center px-0 mx-auto w-12"
        )}
        title={sidebarCollapsed && !mobile ? item.name : undefined}
      >
        <Icon className={cn("h-5 w-5 shrink-0", sidebarCollapsed && !mobile && "h-6 w-6")} />
        {(!sidebarCollapsed || mobile) && <span className="truncate">{item.name}</span>}
      </Link>
    );
  };


  return (
    <AccessControl>
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full bg-white border-r border-slate-200 transform transition-all duration-300 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        sidebarCollapsed ? "lg:w-20" : "lg:w-72",
        !sidebarCollapsed && "w-72"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={cn(
            "flex items-center h-16 border-b border-slate-200 transition-all duration-300",
            sidebarCollapsed ? "justify-center" : "justify-between px-4"
          )}>
            <Link to={createPageUrl('Dashboard')} className={cn("flex items-center gap-3", sidebarCollapsed && "justify-center")}>
              <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-200 transform transition-transform hover:scale-105 active:scale-95">
                <Factory className="h-5 w-5 text-white" />
              </div>
              {!sidebarCollapsed && (
                <span className="text-lg font-bold text-slate-900 truncate animate-in fade-in slide-in-from-left-2 duration-300">AGFSig ERP</span>
              )}
            </Link>
            {!sidebarCollapsed && (
              <button 
                onClick={() => setSidebarCollapsed(true)} 
                className="hidden lg:flex p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                title="Recolher menu"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Collapsed Toggle Button */}
          {sidebarCollapsed && (
            <div className="hidden lg:flex justify-center py-4 border-b border-slate-50">
              <button 
                onClick={() => setSidebarCollapsed(false)} 
                className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm border border-slate-100"
                title="Expandir menu"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            </div>
          )}



          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation
              .map(item => {
                // If user is technician, prune children of Pós-Vendas
                if (user?.is_technician && item.moduleId === 'PosVendas') {
                  const techAllowedPages = ['ServiceSchedule', 'ServiceOrders'];
                  return {
                    ...item,
                    children: item.children?.filter(child => techAllowedPages.includes(child.page))
                  };
                }
                return item;
              })
              .filter(item => {
                // Get user permissions safely
                const userRole = user?.role;
                const rawModules = user?.allowed_modules;
                
                // Utility to parse array/JSON
                const parseModules = (val) => {
                  if (!val) return [];
                  if (Array.isArray(val)) return val;
                  if (typeof val === 'string' && val.startsWith('[')) {
                    try { return JSON.parse(val); } catch (e) { return []; }
                  }
                  if (typeof val === 'string') return val.split(',').map(s => s.trim());
                  return [];
                };
                
                const allowedModules = parseModules(rawModules).map(m => String(m).toLowerCase());

                // Admin sees everything
                if (String(userRole).toLowerCase() === 'admin') return true;
                
                // Admin-only items for admins only
                if (item.adminOnly) return false;
                
                // Dashboard and always visible items
                if (item.page === 'Dashboard' || !item.moduleId) return true;
                
                // Check module permissions (case insensitive)
                return allowedModules.includes(String(item.moduleId).toLowerCase());
              }).map((item, index) => (
                <NavItem key={`${item.name}-${item.page || index}`} item={item} mobile />
              ))}
          </nav>

          {/* User section */}
          {user && (
            <div className="p-4 border-t border-slate-200">
              <div className={cn("flex items-center gap-3 px-3 py-2", sidebarCollapsed && "justify-center px-0")}>
                <Avatar className="h-10 w-10 shrink-0 shadow-md ring-2 ring-white border border-slate-100 transition-transform hover:scale-110">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700 font-black text-xs">
                    {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                {!sidebarCollapsed && (
                  <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
                    <p className="text-sm font-bold text-slate-900 truncate">{user.full_name || 'Usuário'}</p>
                    <p className="text-[10px] text-slate-500 truncate font-medium">{user.email}</p>
                  </div>
                )}
              </div>
            </div>
          )}


        </div>
      </aside>

      {/* Main content */}
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
      )}>

        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-lg border-b border-slate-200">
          <div className="flex items-center justify-between h-full px-4 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
              >
                <Menu className="h-5 w-5 text-slate-600" />
              </button>
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="bg-transparent border-none outline-none text-sm w-48 text-slate-600 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-4 relative">
              <div className="max-w-[120px] sm:max-w-none">
                <CompanySelector />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative shrink-0"
                onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
              >
                <Bell className="h-5 w-5 text-slate-600" />
              </Button>
              <NotificationsPanel open={notificationPanelOpen} onClose={() => setNotificationPanelOpen(false)} />

              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm font-medium">
                          {user.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{user.full_name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Settings className="h-4 w-4 mr-2" />
                      Configurações
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
    </AccessControl>
  );
}