/*
 * 画面上部・下部に並ぶタブの正本（2026-08-31 スタッフ向け／管理者向けの仕分け）。
 *
 * ここ1箇所を直せば DashboardLayout（スタッフ向け）と AdminLayout（管理者の設定画面）の
 * 両方に効く。ページを物理的に複製せず、`adminOnly` の出し分けだけで仕分ける。
 *   - スタッフ向け … 店舗一覧／スタッフ一覧／アンケート／カウンセリング
 *   - 管理者向け   … 上記すべて ＋ 広告（Meta） ＋ 設定
 */
import {
  AlertTriangle,
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
    adminOnly: false,
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
