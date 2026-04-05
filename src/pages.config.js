/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AfterSales from './pages/AfterSales';
import BOMDeliveryPicking from './pages/BOMDeliveryPicking';
import BOMDeliveryPickingList from './pages/BOMDeliveryPickingList';
import BOMDetail from './pages/BOMDetail';
import BOMs from './pages/BOMs';
import Clients from './pages/Clients';
import CompanyManagement from './pages/CompanyManagement';
import ConfigurationHistory from './pages/ConfigurationHistory';
import ConfigurationTesting from './pages/ConfigurationTesting';
import CostCenters from './pages/CostCenters';
import CreateInventoryMove from './pages/CreateInventoryMove';
import DailyVehicleLog from './pages/DailyVehicleLog';
import Dashboard from './pages/Dashboard';
import DataConsistencyFix from './pages/DataConsistencyFix';
import DataManagement from './pages/DataManagement';
import DeleteCompanyData from './pages/DeleteCompanyData';
import ERPIntegration from './pages/ERPIntegration';
import EngineeringComponentHistory from './pages/EngineeringComponentHistory';
import EngineeringComponents from './pages/EngineeringComponents';
import EngineeringDashboard from './pages/EngineeringDashboard';
import EngineeringProjectDetail from './pages/EngineeringProjectDetail';
import EngineeringProjects from './pages/EngineeringProjects';
import ImportBOMs from './pages/ImportBOMs';
import ImportRoutes from './pages/ImportRoutes';
import InventoryCount from './pages/InventoryCount';
import InventoryCountDetail from './pages/InventoryCountDetail';
import InventoryMoves from './pages/InventoryMoves';
import InventoryReceive from './pages/InventoryReceive';
import Kardex from './pages/Kardex';
import LabelGenerator from './pages/LabelGenerator';
import Locations from './pages/Locations';
import Manual from './pages/Manual';
import MaterialRequestDetail from './pages/MaterialRequestDetail';
import MaterialRequests from './pages/MaterialRequests';
import NonConformityReports from './pages/NonConformityReports';
import OPConsumptionControl from './pages/OPConsumptionControl';
import PaymentConditions from './pages/PaymentConditions';
import PickingOptimized from './pages/PickingOptimized';
import ProductionDashboard from './pages/ProductionDashboard';
import ProductionOrderDetail from './pages/ProductionOrderDetail';
import ProductionOrders from './pages/ProductionOrders';
import ProductionRequests from './pages/ProductionRequests';
import ProductionRouteSteps from './pages/ProductionRouteSteps';
import ProductionRoutes from './pages/ProductionRoutes';
import ProductionSchedule from './pages/ProductionSchedule';
import ProductionSimulation from './pages/ProductionSimulation';
import ProductionSyncFix from './pages/ProductionSyncFix';
import Products from './pages/Products';
import ProspectionDashboard from './pages/ProspectionDashboard';
import ProspectionProjects from './pages/ProspectionProjects';
import ProspectionVisitDetail from './pages/ProspectionVisitDetail';
import ProspectionVisitForm from './pages/ProspectionVisitForm';
import ProspectionVisits from './pages/ProspectionVisits';
import QuoteDetail from './pages/QuoteDetail';
import Quotes from './pages/Quotes';
import RecalculateProductBalance from './pages/RecalculateProductBalance';
import RecalculateStockBalance from './pages/RecalculateStockBalance';
import PendingItemsReport from './pages/PendingItemsReport';
import ReceivingConference from './pages/ReceivingConference';
import ReceivingConferenceList from './pages/ReceivingConferenceList';
import ReceivingList from './pages/ReceivingList';
import ReportGenerator from './pages/ReportGenerator';
import ReportTemplates from './pages/ReportTemplates';
import Reports from './pages/Reports';
import Reservations from './pages/Reservations';
import Resources from './pages/Resources';
import RestoreCompanyData from './pages/RestoreCompanyData';
import ReturnDetail from './pages/ReturnDetail';
import Returns from './pages/Returns';
import ReverseInventoryMoves from './pages/ReverseInventoryMoves';
import RouteSteps from './pages/RouteSteps';
import SalesAppointments from './pages/SalesAppointments';
import SalesOrderDetail from './pages/SalesOrderDetail';
import SalesOrders from './pages/SalesOrders';
import SalesOrdersMissing from './pages/SalesOrdersMissing';
import Sellers from './pages/Sellers';
import Separation from './pages/Separation';
import SerialNumberControl from './pages/SerialNumberControl';
import ServiceOrderDetail from './pages/ServiceOrderDetail';
import ServiceOrders from './pages/ServiceOrders';
import ServiceReports from './pages/ServiceReports';
import ServiceRequests from './pages/ServiceRequests';
import ServiceSchedule from './pages/ServiceSchedule';
import ShipmentReturns from './pages/ShipmentReturns';
import Shipments from './pages/Shipments';
import Shipping from './pages/Shipping';
import StockBalances from './pages/StockBalances';
import StockConsistencyCheck from './pages/StockConsistencyCheck';
import StockLocator from './pages/StockLocator';
import StockPledgeQuery from './pages/StockPledgeQuery';
import StockReports from './pages/StockReports';
import StorageAllocation from './pages/StorageAllocation';
import StorageScanner from './pages/StorageScanner';
import SystemConfiguration from './pages/SystemConfiguration';
import Technicians from './pages/Technicians';
import UserManagement from './pages/UserManagement';
import Warehouses from './pages/Warehouses';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AfterSales": AfterSales,
    "BOMDeliveryPicking": BOMDeliveryPicking,
    "BOMDeliveryPickingList": BOMDeliveryPickingList,
    "BOMDetail": BOMDetail,
    "BOMs": BOMs,
    "Clients": Clients,
    "CompanyManagement": CompanyManagement,
    "ConfigurationHistory": ConfigurationHistory,
    "ConfigurationTesting": ConfigurationTesting,
    "CostCenters": CostCenters,
    "CreateInventoryMove": CreateInventoryMove,
    "DailyVehicleLog": DailyVehicleLog,
    "Dashboard": Dashboard,
    "DataConsistencyFix": DataConsistencyFix,
    "DataManagement": DataManagement,
    "DeleteCompanyData": DeleteCompanyData,
    "ERPIntegration": ERPIntegration,
    "EngineeringComponentHistory": EngineeringComponentHistory,
    "EngineeringComponents": EngineeringComponents,
    "EngineeringDashboard": EngineeringDashboard,
    "EngineeringProjectDetail": EngineeringProjectDetail,
    "EngineeringProjects": EngineeringProjects,
    "ImportBOMs": ImportBOMs,
    "ImportRoutes": ImportRoutes,
    "InventoryCount": InventoryCount,
    "InventoryCountDetail": InventoryCountDetail,
    "InventoryMoves": InventoryMoves,
    "InventoryReceive": InventoryReceive,
    "Kardex": Kardex,
    "LabelGenerator": LabelGenerator,
    "Locations": Locations,
    "Manual": Manual,
    "MaterialRequestDetail": MaterialRequestDetail,
    "MaterialRequests": MaterialRequests,
    "NonConformityReports": NonConformityReports,
    "OPConsumptionControl": OPConsumptionControl,
    "PaymentConditions": PaymentConditions,
    "PendingItemsReport": PendingItemsReport,
    "PickingOptimized": PickingOptimized,
    "ProductionDashboard": ProductionDashboard,
    "ProductionOrderDetail": ProductionOrderDetail,
    "ProductionOrders": ProductionOrders,
    "ProductionRequests": ProductionRequests,
    "ProductionRouteSteps": ProductionRouteSteps,
    "ProductionRoutes": ProductionRoutes,
    "ProductionSchedule": ProductionSchedule,
    "ProductionSimulation": ProductionSimulation,
    "ProductionSyncFix": ProductionSyncFix,
    "Products": Products,
    "ProspectionDashboard": ProspectionDashboard,
    "ProspectionProjects": ProspectionProjects,
    "ProspectionVisitDetail": ProspectionVisitDetail,
    "ProspectionVisitForm": ProspectionVisitForm,
    "ProspectionVisits": ProspectionVisits,
    "QuoteDetail": QuoteDetail,
    "Quotes": Quotes,
    "RecalculateProductBalance": RecalculateProductBalance,
    "RecalculateStockBalance": RecalculateStockBalance,
    "ReceivingConference": ReceivingConference,
    "ReceivingConferenceList": ReceivingConferenceList,
    "ReceivingList": ReceivingList,
    "ReportGenerator": ReportGenerator,
    "ReportTemplates": ReportTemplates,
    "Reports": Reports,
    "Reservations": Reservations,
    "Resources": Resources,
    "RestoreCompanyData": RestoreCompanyData,
    "ReturnDetail": ReturnDetail,
    "Returns": Returns,
    "ReverseInventoryMoves": ReverseInventoryMoves,
    "RouteSteps": RouteSteps,
    "SalesAppointments": SalesAppointments,
    "SalesOrderDetail": SalesOrderDetail,
    "SalesOrders": SalesOrders,
    "SalesOrdersMissing": SalesOrdersMissing,
    "Sellers": Sellers,
    "Separation": Separation,
    "SerialNumberControl": SerialNumberControl,
    "ServiceOrderDetail": ServiceOrderDetail,
    "ServiceOrders": ServiceOrders,
    "ServiceReports": ServiceReports,
    "ServiceRequests": ServiceRequests,
    "ServiceSchedule": ServiceSchedule,
    "ShipmentReturns": ShipmentReturns,
    "Shipments": Shipments,
    "Shipping": Shipping,
    "StockBalances": StockBalances,
    "StockConsistencyCheck": StockConsistencyCheck,
    "StockLocator": StockLocator,
    "StockPledgeQuery": StockPledgeQuery,
    "StockReports": StockReports,
    "StorageAllocation": StorageAllocation,
    "StorageScanner": StorageScanner,
    "SystemConfiguration": SystemConfiguration,
    "Technicians": Technicians,
    "UserManagement": UserManagement,
    "Warehouses": Warehouses,
}

export const pagesConfig = {
    mainPage: "ProductionOrderDetail",
    Pages: PAGES,
    Layout: __Layout,
};