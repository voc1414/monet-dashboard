/*
 * 画面上部・下部に並ぶタブの正本（2026-08-31 スタッフ向け／管理者向けの仕分け）。
 *
 * ここ1箇所を直せば DashboardLayout（スタッフ向け）と AdminLayout（管理者の設定画面）の
 * 両方に効く。ページを物理的に複製せず、`adminOnly` の出し分けだけで仕分ける。
 *   - スタッフ向け … スタッフ一覧／アンケート／カウンセリング（店舗一覧は 2026-10-02 から管理者だけ）
 *   - 管理者向け   … 上記すべて ＋ 雇用形態別の売上 ＋ 広告（Meta） ＋ 設定
 */
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Home,
  Megaphone,
  MessageSquareText,
  Settings,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  /** PC 用ラベル */
  label: string;
  /** モバイル下部ナビ用の短いラベル */
  shortLabel: string;
  icon: LucideIcon;
  /** 管理者にだけ見せるタブか */
  adminOnly: boolean;
  /** 現在地判定。wouter の location（base を除いたパス）を受ける */
  isActive: (location: string) => boolean;
}

/** 主タブ。並び順そのままに表示する */
export const MAIN_TABS: NavItem[] = [
  {
    href: "/",
    label: "店舗一覧",
    shortLabel: "店舗一覧",
    icon: Home,
    // 店舗ごとの売上はスタッフに見せない（2026-10-02 林さん指示）
    adminOnly: true,
    // 店舗詳細も「店舗一覧」の下と見なす（NPS は別画面なので除く）
    isActive: (l) => l === "/" || (l.startsWith("/store") && !l.includes("/nps")),
  },
  {
    href: "/staff",
    label: "スタッフ一覧",
    shortLabel: "スタッフ",
    icon: Users,
    adminOnly: false,
    isActive: (l) => l.startsWith("/staff"),
  },
  {
    href: "/survey",
    label: "アンケート",
    shortLabel: "アンケート",
    icon: ClipboardList,
    adminOnly: false,
    isActive: (l) => l.startsWith("/survey"),
  },
  {
    href: "/counseling",
    label: "カウンセリング",
    shortLabel: "カウンセリング",
    icon: MessageSquareText,
    adminOnly: false,
    isActive: (l) => l.startsWith("/counseling"),
  },
  {
    href: "/employment",
    label: "雇用形態別の売上",
    shortLabel: "雇用形態",
    icon: BarChart3,
    // 雇用形態は人事情報。スタッフ同士で見えると比較・詮索の元になるので管理者だけ（2026-09-01）
    adminOnly: true,
    isActive: (l) => l.startsWith("/employment"),
  },
  {
    href: "/ads",
    label: "広告（Meta）",
    shortLabel: "広告",
    icon: Megaphone,
    // 広告費・CPA は店舗スタッフに見せない（2026-08-31 林さん指示）
    adminOnly: true,
    isActive: (l) => l.startsWith("/ads"),
  },
];

/** 「設定」タブ。中身は下の SETTINGS_PAGES */
export const SETTINGS_TAB: NavItem = {
  href: "/admin",
  label: "設定",
  shortLabel: "設定",
  icon: Settings,
  adminOnly: true,
  isActive: (l) => l.startsWith("/admin"),
};

export interface SettingsPage {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 完全一致で現在地判定するか（/admin は前方一致だと全ページに当たる） */
  exact: boolean;
}

/** 設定タブの中身＝従来の管理ページ4枚 */
export const SETTINGS_PAGES: SettingsPage[] = [
  { href: "/admin", label: "アラート一覧", icon: AlertTriangle, exact: true },
  { href: "/admin/stores", label: "店舗情報", icon: Store, exact: false },
  { href: "/admin/staff", label: "スタッフ情報", icon: Users, exact: false },
  { href: "/admin/surveys", label: "アンケート情報", icon: ClipboardList, exact: false },
];

/** 権限に応じて出してよい主タブだけを返す */
export function visibleMainTabs(isAdmin: boolean): NavItem[] {
  return MAIN_TABS.filter((tab) => isAdmin || !tab.adminOnly);
}

/**
 * 「設定」タブを画面に出すか（2026-09-13 から false）。
 *
 * 設定の4枚（SETTINGS_PAGES）は AdminLayout がサーバAPI（/api/trpc の admin.me）で
 * ログイン状態を確かめる作りだが、本番は GitHub Pages の静的配信でそのAPIが無い
 * （本番実測: /monet-dashboard/api/trpc/admin.me → 404）。
 * 結果、押すとログイン画面へ飛ばされ、ID/パスワードを入れても照合する相手がいないので
 * 設定画面には入れない（ログイン画面から「ダッシュボードに戻る」で戻ることはできる）。
 *
 * 中身の管理はすべて Notion へ移っており、この画面から設定できることは本番では効かない。
 *   - 店舗マスタ・スタッフの在籍/退職 … Notion が正本（isRetiredStaff は DB優先・マスタfallback で、
 *     本番は DB が無いため常に Notion 由来の staffMaster.ts が効く）
 *   - 名前マッピング … 本番で効くのはコード側の2層だけ。staffNameAlias.ts の内蔵表と、
 *     stylistAlias.ts が Notion の「かな」から機械生成する別名（DBの stylist_aliases は注入されない）
 *   - 店舗情報ページ … 編集UIはあるが保存は未実装（AdminStores の saveEdit は「準備中です」を出すだけ）
 *
 * サーバを立て直して設定画面を復活させるときは true に戻す。ページ本体とルートは残してある。
 * そのとき server/navItems.test.ts の「管理者向けビルドでも出さない」も同時に直すこと
 * （直さないと CI が赤くなる）。
 */
export const SETTINGS_TAB_ENABLED = false;

/** 設定タブを出してよいか。管理者向けビルドで、かつ設定画面が実際に使えるときだけ */
export function shouldShowSettingsTab(isAdmin: boolean): boolean {
  return SETTINGS_TAB_ENABLED && isAdmin;
}
