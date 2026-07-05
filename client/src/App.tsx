import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import { ThemeProvider } from "./contexts/ThemeContext";
import { StaffStatusProvider } from "./hooks/useStaffStatus";
import { StoreDataProvider } from "./components/StoreDataProvider";
import Home from "./pages/Home";
import StoreDetail from "./pages/StoreDetail";
import NpsOverview from "./pages/NpsOverview";
import StaffList from "./pages/StaffList";
import SurveyList from "./pages/SurveyList";
import SurveyDetail from "./pages/SurveyDetail";
import StaffDetail from "./pages/StaffDetail";
import Counseling from "./pages/Counseling";
import Ads from "./pages/Ads";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminAlerts from "./pages/admin/AdminAlerts";
import AdminStores from "./pages/admin/AdminStores";
import AdminStaff from "./pages/admin/AdminStaff";
import AdminSurveys from "./pages/admin/AdminSurveys";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <>
      <ScrollToTop />
      <Switch>
        {/* Public Dashboard Routes */}
        <Route path="/" component={Home} />
        <Route path="/store/:storeId" component={StoreDetail} />
        <Route path="/staff" component={StaffList} />
        <Route path="/staff/:storeId/:staffId" component={StaffDetail} />
        <Route path="/survey" component={SurveyList} />
        <Route path="/survey/:storeId" component={SurveyDetail} />
        <Route path="/counseling" component={Counseling} />
        <Route path="/ads" component={Ads} />
        <Route path="/store/:storeId/nps" component={NpsOverview} />

        {/* Admin Routes */}
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin" component={AdminAlerts} />
        <Route path="/admin/stores" component={AdminStores} />
        <Route path="/admin/staff" component={AdminStaff} />
        <Route path="/admin/surveys" component={AdminSurveys} />

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <StoreDataProvider>
            <StaffStatusProvider />
            <Toaster />
            <Router />
          </StoreDataProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
