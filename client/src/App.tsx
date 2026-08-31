import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Router as WouterRouter } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import { IS_ADMIN_BUILD } from "./lib/appRole";
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
        {/* スタッフ向け（ログイン不要）。広告は管理者だけ */}
        <Route path="/" component={Home} />
        <Route path="/store/:storeId" component={StoreDetail} />
        <Route path="/staff" component={StaffList} />
        <Route path="/staff/:storeId/:staffId" component={StaffDetail} />
        <Route path="/survey" component={SurveyList} />
        <Route path="/survey/:storeId" component={SurveyDetail} />
        <Route path="/counseling" component={Counseling} />
        <Route path="/store/:storeId/nps" component={NpsOverview} />

        {/*
          広告と設定は管理者向けビルドにだけ登録する。
          スタッフ向けビルドではルートが存在しないので、URL を直打ちしても 404 になる。
        */}
        {IS_ADMIN_BUILD && <Route path="/ads" component={Ads} />}
        {IS_ADMIN_BUILD && <Route path="/admin/login" component={AdminLogin} />}
        {IS_ADMIN_BUILD && <Route path="/admin" component={AdminAlerts} />}
        {IS_ADMIN_BUILD && <Route path="/admin/stores" component={AdminStores} />}
        {IS_ADMIN_BUILD && <Route path="/admin/staff" component={AdminStaff} />}
        {IS_ADMIN_BUILD && <Route path="/admin/surveys" component={AdminSurveys} />}

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
            {/* GitHub Pages のサブパス配信に対応（BASE_URL="/"のときは実質無効） */}
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </StoreDataProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
