import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch, Router as WouterRouter, useLocation } from "wouter";
import type { ComponentType } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import { IS_ADMIN_BUILD, staffModeRedirect } from "./lib/appRole";
import { useEffectiveRole, ViewRoleProvider } from "./contexts/ViewRole";
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
import GoogleMap from "./pages/GoogleMap";
import AutoTasks from "./pages/AutoTasks";
import NextReservationBoost from "./pages/NextReservationBoost";
import NextReservationBoostPerson from "./pages/NextReservationBoostPerson";
import EmploymentRanking from "./pages/EmploymentRanking";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminAlerts from "./pages/admin/AdminAlerts";
import AdminStores from "./pages/admin/AdminStores";
import AdminStaff from "./pages/admin/AdminStaff";
import AdminSurveys from "./pages/admin/AdminSurveys";

/**
 * 管理者ビルドで「スタッフ」表示のときは、スタッフ向けサイトに無い画面を開かせない。
 * ページ本体の参照は IS_ADMIN_BUILD の枝だけ。スタッフ向けビルドでは未使用としてバンドルから落ちる。
 */
function AdminOnly({ component: Page }: { component: ComponentType }) {
  const role = useEffectiveRole();
  const [location] = useLocation();
  const to = staffModeRedirect(location, role);
  if (to) return <Redirect to={to} replace />;
  return <Page />;
}

function gate(Page: ComponentType) {
  return function GatedAdminPage() {
    return <AdminOnly component={Page} />;
  };
}

const HomeGate = IS_ADMIN_BUILD ? gate(Home) : () => null;
const StoreDetailGate = IS_ADMIN_BUILD ? gate(StoreDetail) : () => null;
const SurveyDetailGate = IS_ADMIN_BUILD ? gate(SurveyDetail) : () => null;
const NpsOverviewGate = IS_ADMIN_BUILD ? gate(NpsOverview) : () => null;
const EmploymentGate = IS_ADMIN_BUILD ? gate(EmploymentRanking) : () => null;
const NextReservationGate = IS_ADMIN_BUILD ? gate(NextReservationBoost) : () => null;
const NextReservationPersonGate = IS_ADMIN_BUILD ? gate(NextReservationBoostPerson) : () => null;
const AdsGate = IS_ADMIN_BUILD ? gate(Ads) : () => null;
const GoogleMapGate = IS_ADMIN_BUILD ? gate(GoogleMap) : () => null;
const AutoTasksGate = IS_ADMIN_BUILD ? gate(AutoTasks) : () => null;
const AdminLoginGate = IS_ADMIN_BUILD ? gate(AdminLogin) : () => null;
const AdminAlertsGate = IS_ADMIN_BUILD ? gate(AdminAlerts) : () => null;
const AdminStoresGate = IS_ADMIN_BUILD ? gate(AdminStores) : () => null;
const AdminStaffGate = IS_ADMIN_BUILD ? gate(AdminStaff) : () => null;
const AdminSurveysGate = IS_ADMIN_BUILD ? gate(AdminSurveys) : () => null;

function Router() {
  // 表示を切り替えたらページ状態（期間の初期値など）をスタッフ向け／管理者向けの初期状態に戻す
  const role = useEffectiveRole();
  return (
    <>
      <ScrollToTop />
      <Switch key={role}>
        {/*
          店舗一覧・店舗詳細は管理者だけ（2026-10-02 林さん指示）。
          スタッフ向けでは「/」（ロゴ・パンくずの「ホーム」）をスタッフ一覧へ送る。
          管理者ビルドのスタッフ表示でも同じ送り先（店舗ごとの売上を出さない）。
        */}
        {IS_ADMIN_BUILD ? (
          <Route path="/" component={HomeGate} />
        ) : (
          <Route path="/">
            <Redirect to="/staff" replace />
          </Route>
        )}
        {IS_ADMIN_BUILD && <Route path="/store/:storeId" component={StoreDetailGate} />}
        <Route path="/staff" component={StaffList} />
        <Route path="/staff/:storeId/:staffId" component={StaffDetail} />
        <Route path="/survey" component={SurveyList} />
        {/* 店舗単位のアンケートも管理者だけ。スタッフ向けで直接開かれたらアンケート一覧へ戻す（2026-10-02 林さん指示） */}
        {IS_ADMIN_BUILD ? (
          <Route path="/survey/:storeId" component={SurveyDetailGate} />
        ) : (
          <Route path="/survey/:storeId">
            <Redirect to="/survey" replace />
          </Route>
        )}
        <Route path="/counseling" component={Counseling} />
        {IS_ADMIN_BUILD && <Route path="/store/:storeId/nps" component={NpsOverviewGate} />}

        {/*
          雇用形態別の売上・広告・設定は管理者向けビルドにだけ登録する。
          スタッフ向けビルドではルートが存在しないので、URL を直打ちしても 404 になる。
          管理者ビルドのスタッフ表示ではルートは残るが、中身は出さずスタッフの画面へ戻す。
        */}
        {IS_ADMIN_BUILD && <Route path="/employment" component={EmploymentGate} />}
        {IS_ADMIN_BUILD && <Route path="/next-reservation" component={NextReservationGate} />}
        {IS_ADMIN_BUILD && <Route path="/next-reservation/:store/:name" component={NextReservationPersonGate} />}
        {IS_ADMIN_BUILD && <Route path="/ads" component={AdsGate} />}
        {IS_ADMIN_BUILD && <Route path="/google-map" component={GoogleMapGate} />}
        {IS_ADMIN_BUILD && <Route path="/auto-tasks" component={AutoTasksGate} />}
        {IS_ADMIN_BUILD && <Route path="/admin/login" component={AdminLoginGate} />}
        {IS_ADMIN_BUILD && <Route path="/admin" component={AdminAlertsGate} />}
        {IS_ADMIN_BUILD && <Route path="/admin/stores" component={AdminStoresGate} />}
        {IS_ADMIN_BUILD && <Route path="/admin/staff" component={AdminStaffGate} />}
        {IS_ADMIN_BUILD && <Route path="/admin/surveys" component={AdminSurveysGate} />}

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
        <ViewRoleProvider>
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
        </ViewRoleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
