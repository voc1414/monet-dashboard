/**
 * 表示中の実効ロール。
 *
 * 正本は appRole.effectiveRole。
 *   - スタッフ向けビルド … 常に staff（切替UIも出さない。保存値は見ない）
 *   - 管理者向けビルド … 切替の状態。未保存なら admin
 *
 * 管理者専用ページの取り込みは App.tsx の IS_ADMIN_BUILD のまま。
 * ここを実行時の真偽値にすると、スタッフ向けバンドルに広告などが混ざる。
 */
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  IS_ADMIN_BUILD,
  VIEW_ROLE_STORAGE_KEY,
  effectiveRole,
  type AppRole,
} from "@/lib/appRole";

type ViewRoleContextValue = {
  role: AppRole;
  setRole: (role: AppRole) => void;
};

export const ViewRoleContext = createContext<ViewRoleContextValue>({
  role: IS_ADMIN_BUILD ? "admin" : "staff",
  setRole: () => {},
});

function readStoredRole(): string | null {
  if (!IS_ADMIN_BUILD) return null;
  try {
    return localStorage.getItem(VIEW_ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredRole(role: AppRole) {
  if (!IS_ADMIN_BUILD) return;
  try {
    localStorage.setItem(VIEW_ROLE_STORAGE_KEY, role);
  } catch {
    /* プライベートモード等では記憶しない。表示切替自体は動く */
  }
}

export function ViewRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<AppRole>(() => effectiveRole(IS_ADMIN_BUILD, readStoredRole()));

  const setRole = useCallback((next: AppRole) => {
    const applied = effectiveRole(IS_ADMIN_BUILD, next);
    setRoleState(applied);
    writeStoredRole(applied);
  }, []);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    // スタッフ向けサイトと同じ文字色（index.css の [data-role="staff"]）
    if (role === "staff") document.documentElement.dataset.role = "staff";
    else delete document.documentElement.dataset.role;
  }, [role]);

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);
  return <ViewRoleContext.Provider value={value}>{children}</ViewRoleContext.Provider>;
}

/** 今の画面を管理者として描くか、スタッフ向けと同じ中身で描くか */
export function useEffectiveRole(): AppRole {
  const { role } = useContext(ViewRoleContext);
  return effectiveRole(IS_ADMIN_BUILD, role);
}

export function useIsEffectiveAdmin(): boolean {
  return useEffectiveRole() === "admin";
}
