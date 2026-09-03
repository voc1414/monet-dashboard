import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { LogOut, Shield, ChevronRight, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Button } from "@/components/ui/button";
import { MAIN_TABS, SETTINGS_PAGES, SETTINGS_TAB } from "@/lib/navItems";

import monetLogo from "@/assets/monet-logo.png";

const MONET_LOGO = monetLogo;

interface Breadcrumb {
  label: string;
  href?: string;
}

interface AdminLayoutProps {
  children: ReactNode;
  breadcrumbs?: Breadcrumb[];
  title?: string;
}

/*
 * 管理者向け画面（＝「設定」タブの中身）。
 * タブの並びは client/src/lib/navItems.ts が正本。ここは「設定」が現在地の状態で
 * 主タブ（店舗一覧／スタッフ一覧／アンケート／カウンセリング／広告）を同じ並びで見せ、
 * その下に設定の中身（従来の管理ページ4枚）をサブタブとして並べる。
 */
export default function AdminLayout({ children, breadcrumbs = [], title }: AdminLayoutProps) {
  const [location] = useLocation();
  const { logout, loading } = useAdminAuth({ redirectOnUnauthenticated: true });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string, exact: boolean) => {
    if (exact) return location === href;
    return location.startsWith(href);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/85 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link href="/admin">
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
                  <span className="text-[10px] leading-tight tracking-wider flex items-center gap-1">
                    <Shield className="w-3 h-3 text-primary" />
                    <span className="text-primary font-semibold">ADMIN</span>
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Desktop Nav（管理者は主タブ全部＋広告＋設定が並ぶ） */}
          <nav className="hidden lg:flex items-center gap-1">
            {MAIN_TABS.map((tab) => (
              <Link key={tab.href} href={tab.href}>
                {/* xl 未満は短いラベル（タブが増えると1行に収まらない・2026-09-01） */}
                <span className="flex items-center gap-1.5 xl:gap-2 whitespace-nowrap px-2 xl:px-3 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50">
                  <tab.icon className="w-4 h-4 shrink-0" />
                  <span className="xl:hidden">{tab.shortLabel}</span>
                  <span className="hidden xl:inline">{tab.label}</span>
                </span>
              </Link>
            ))}
            <span className="flex items-center gap-1.5 xl:gap-2 whitespace-nowrap px-2 xl:px-3 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary">
              <SETTINGS_TAB.icon className="w-4 h-4 shrink-0" />
              {SETTINGS_TAB.label}
            </span>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={loading}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">ログアウト</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Dropdown */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:hidden border-b border-border/40 bg-white/95 backdrop-blur-md z-40"
        >
          <div className="container py-2 space-y-1">
            <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground/70">
              設定
            </p>
            {SETTINGS_PAGES.map((item) => (
              <Link key={item.href} href={item.href}>
                <div
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href, item.exact)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            ))}
            <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground/70">
              ダッシュボード
            </p>
            {MAIN_TABS.map((tab) => (
              <Link key={tab.href} href={tab.href}>
                <div
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50"
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* 設定の中身（従来の管理ページ4枚）。狭い画面では横スクロールさせる */}
      <div className="border-b border-border/40 bg-white/60">
        <div className="container">
          <nav className="flex items-center gap-1 overflow-x-auto py-2">
            {SETTINGS_PAGES.map((item) => (
              <Link key={item.href} href={item.href}>
                <span
                  className={`flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive(item.href, item.exact)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="border-b border-border/40 bg-white/40">
          <div className="container py-3">
            <nav className="flex items-center gap-1.5 text-sm">
              <Link href={SETTINGS_TAB.href}>
                <span className="text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                  {SETTINGS_TAB.label}
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
        {title && (
          <h1 className="text-xl font-bold text-foreground mb-6">{title}</h1>
        )}
        {children}
      </motion.main>
    </div>
  );
}
