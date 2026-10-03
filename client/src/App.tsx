import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch, Router as WouterRouter } from "wouter";
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
import NextReservationBoost from "./pages/NextReservationBoost";
import NextReservationBoostPerson from "./pages/NextReservationBoostPerson";
import EmploymentRanking from "./pages/EmploymentRanking";
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
        {/*
          店舗一覧・店舗詳細は管理者だけ（2026-10-02 林さん指示）。
          スタッフ向けでは「/」（ロゴ・パンくずの「ホーム」）をスタッフ一覧へ送る。
        */}
        {IS_ADMIN_BUILD ? (
          <Route path="/" component={Home} />
        ) : (
          <Route path="/">
            <Redirect to="/staff" replace />
          </Route>
        )}
        {IS_ADMIN_BUILD && <Route path="/store/:storeId" component={StoreDetail} />}
        <Route path="/staff" component={StaffList} />
        <Route path="/staff/:storeId/:staffId" component={StaffDetail} />
        <Route path="/survey" component={SurveyList} />
        {/* 店舗単位のアンケートも管理者だけ。スタッフ向けで直接開かれたらアンケート一覧へ戻す（2026-10-02 林さん指示） */}
        {IS_ADMIN_BUILD ? (
          <Route path="/survey/:storeId" component={SurveyDetail} />
        ) : (
          <Route path="/survey/:storeId">
            <Redirect to="/survey" replace />
          </Route>
        )}
        <Route path="/counseling" component={Counseling} />
        {IS_ADMIN_BUILD && <Route path="/store/:storeId/nps" component={NpsOverview} />}

        {/*
          雇用形態別の売上・広告・設定は管理者向けビルドにだけ登録する。
          スタッフ向けビルドではルートが存在しないので、URL を直打ちしても 404 になる。
        */}
        {IS_ADMIN_BUILD && <Route path="/employment" component={EmploymentRanking} />}
        {IS_ADMIN_BUILD && <Route path="/next-reservation" component={NextReservationBoost} />}
        {IS_ADMIN_BUILD && <Route path="/next-reservation/:store/:name" component={NextReservationBoostPerson} />}
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
