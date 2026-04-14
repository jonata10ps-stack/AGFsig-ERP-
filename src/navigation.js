import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Factory,
  BarChart3,
  Settings,
  Users,
  FileText,
  DollarSign,
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
  TrendingUp,
  Book,
  Cpu
} from 'lucide-react';

export const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
  { name: 'Dashboard Fábrica', icon: Factory, page: 'FactoryDashboard', moduleId: 'DashboardFabrica' },
  { name: 'Gerador de Etiquetas', icon: Package, page: 'LabelGenerator', moduleId: 'Etiquetas' },
  { 
    name: 'Comercial', 
    icon: Calendar,
    moduleId: 'Agenda',
    children: [
      { name: 'Agenda de Visitas', icon: Calendar, page: 'SalesAppointments' },
      { name: 'Tabela de Preços', icon: DollarSign, page: 'PriceList' },
      { name: 'Dashboard Prospecção', icon: BarChart3, page: 'ProspectionDashboard' },
      { name: 'Meus Números', icon: BarChart3, page: 'MyNumbersDashboard' },
      { name: 'Prospecção', icon: Users, page: 'ProspectionVisits' },
      { name: 'Projetos', icon: Package, page: 'ProspectionProjects' },
      { name: 'Registro de KM', icon: Cog, page: 'DailyVehicleLog' },
      { name: 'Gestão de Metas', icon: CheckCircle2, page: 'SellerGoalsManagement', managerOnly: true },
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
      { name: 'Controle de Qualidade', icon: BarChart3, page: 'AfterSalesQuality' },
      { name: 'Relatórios', icon: BarChart3, page: 'ServiceReports' },
      { name: 'Templates de Relatórios IA', icon: BarChart3, page: 'ReportTemplates' },
    ]
  },
  {
    name: 'Gestão de Custos',
    icon: TrendingUp,
    moduleId: 'GestaoCustos',
    children: [
      { name: 'Dashboard de Rentabilidade', icon: BarChart3, page: 'CostManagement' },
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
