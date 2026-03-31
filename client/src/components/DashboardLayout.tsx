/*
 * Design: Atelier Blanc — クリーンアトリエ
 * Layout: Top navigation + content area with breadcrumb hierarchy
 * Colors: Warm white base, rose taupe accent, sage green secondary
 * Typography: Cormorant Garamond (headings), Noto Sans JP (body), JetBrains Mono (data)
 */
import { Link, useLocation } from "wouter";
import { ChevronRight, RefreshCw, Home, BarChart3, Users } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

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

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/80 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <Link href="/">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-[#9B8579] flex items-center justify-center">
                <span className="text-white text-sm font-bold">m</span>
              </div>
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
            <Link href="/">
              <span
                className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-foreground ${
                  location === "/" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <Home className="w-4 h-4" />
                店舗一覧
              </span>
            </Link>
            <Link href="/staff">
              <span
                className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-foreground ${
                  location === "/staff" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <Users className="w-4 h-4" />
                スタッフ一覧
              </span>
            </Link>
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
                <span className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  ホーム
                </span>
              </Link>
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                  {crumb.href ? (
                    <Link href={crumb.href}>
                      <span className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
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
        className="container py-6 pb-16"
      >
        {children}
      </motion.main>
    </div>
  );
}
