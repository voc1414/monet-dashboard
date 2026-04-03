import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Store,
  Users,
  ClipboardList,
  LogOut,
  Home,
  Shield,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Button } from "@/components/ui/button";

const MONET_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/monet-logo_cd6a82da.png";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface AdminLayoutProps {
  children: ReactNode;
  breadcrumbs?: Breadcrumb[];
  title?: string;
}

const NAV_ITEMS = [
  { href: "/admin", label: "アラート一覧", icon: AlertTriangle, exact: true },
  { href: "/admin/stores", label: "店舗情報", icon: Store, exact: false },
  { href: "/admin/staff", label: "スタッフ情報", icon: Users, exact: false },
  { href: "/admin/surveys", label: "アンケート情報", icon: ClipboardList, exact: false },
];

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
              className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
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

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href}>
                <span
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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

          <div className="flex items-center gap-2">
            <Link href="/">
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1.5 rounded-lg hover:bg-accent/50">
                <Home className="w-3.5 h-3.5" />
                ダッシュボード
              </span>
            </Link>
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
          className="md:hidden border-b border-border/40 bg-white/95 backdrop-blur-md z-40"
        >
          <div className="container py-2 space-y-1">
            {NAV_ITEMS.map((item) => (
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
            <Link href="/">
              <div
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50"
              >
                <Home className="w-4 h-4" />
                ダッシュボードに戻る
              </div>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="border-b border-border/40 bg-white/40">
          <div className="container py-3">
            <nav className="flex items-center gap-1.5 text-sm">
              <Link href="/admin">
                <span className="text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                  管理画面
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
