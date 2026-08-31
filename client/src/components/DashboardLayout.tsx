/*
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Layout: Top navigation + content area with breadcrumb hierarchy
 * Colors: Warm white base, monet water-blue accent, concrete grey secondary
 * Typography: Noto Sans JP (body), Inter (data)
 */
import { Link, useLocation } from "wouter";
import { ChevronRight, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { SETTINGS_TAB, visibleMainTabs } from "@/lib/navItems";
import { IS_ADMIN_BUILD } from "@/lib/appRole";
import monetLogo from "@/assets/monet-logo.png";

const MONET_LOGO = monetLogo;

interface Breadcrumb {
  label: string;
  href?: string;
}

interface DashboardLayoutProps {
  children: ReactNode;
  breadcrumbs?: Breadcrumb[];
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  loading?: boolean;
}

export default function DashboardLayout({
  children,
  breadcrumbs = [],
  lastUpdated,
  onRefresh,
  loading,
}: DashboardLayoutProps) {
  const [location] = useLocation();
  // 広告・設定タブは管理者向けビルドにしか無い（スタッフ向けバンドルには存在しない）
  const isAdmin = IS_ADMIN_BUILD;
  const tabs = visibleMainTabs(isAdmin);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/85 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <Link href="/">
            <div className="flex items-center gap-3 group cursor-pointer">
              <img
                src={MONET_LOGO}
                alt="monet"
                className="h-9 w-auto object-contain"
              />
              <div className="flex flex-col">
                <span className="text-base font-bold text-foreground leading-tight">
                  monet
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight tracking-wider">
                  DASHBOARD
                </span>
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {tabs.map((tab) => (
              <Link key={tab.href} href={tab.href}>
                <span
                  className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                    tab.isActive(location) ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </span>
              </Link>
            ))}
            {isAdmin && (
              <>
                <div className="w-px h-5 bg-border/60" />
                <Link href={SETTINGS_TAB.href}>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70 hover:text-primary transition-colors px-2.5 py-1.5 rounded-md border border-border/50 hover:border-primary/30 hover:bg-primary/5">
                    <SETTINGS_TAB.icon className="w-3.5 h-3.5" />
                    {SETTINGS_TAB.label}
                  </span>
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                最終更新: {lastUpdated.toLocaleTimeString("ja-JP")}
              </span>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                title="データを更新"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="border-b border-border/40 bg-white/40">
          <div className="container py-3">
            <nav className="flex items-center gap-1.5 text-sm">
              <Link href="/">
                <span className="text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                  ホーム
                </span>
              </Link>
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                  {crumb.href ? (
                    <Link href={crumb.href}>
                      <span className="text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                        {crumb.label}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="container py-6 pb-24 md:pb-16"
      >
        {children}
      </motion.main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border/60 bg-white/95 backdrop-blur-md safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href}>
              <div
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-colors ${
                  tab.isActive(location) ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.shortLabel}</span>
              </div>
            </Link>
          ))}
          {isAdmin && (
            <Link href={SETTINGS_TAB.href}>
              <div className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-colors text-muted-foreground/60">
                <SETTINGS_TAB.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{SETTINGS_TAB.shortLabel}</span>
              </div>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
