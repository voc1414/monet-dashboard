import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * ルート遷移時にページトップにスクロールするコンポーネント
 */
export default function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location]);

  return null;
}
