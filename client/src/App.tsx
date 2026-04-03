import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import StoreDetail from "./pages/StoreDetail";
import NpsOverview from "./pages/NpsOverview";
import StaffList from "./pages/StaffList";
import SurveyList from "./pages/SurveyList";
import SurveyDetail from "./pages/SurveyDetail";
import StaffDetail from "./pages/StaffDetail";

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/store/:storeId" component={StoreDetail} />
        <Route path="/staff" component={StaffList} />
        <Route path="/staff/:staffId" component={StaffDetail} />
        <Route path="/survey" component={SurveyList} />
        <Route path="/survey/:storeId" component={SurveyDetail} />
        <Route path="/store/:storeId/nps" component={NpsOverview} />
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
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
