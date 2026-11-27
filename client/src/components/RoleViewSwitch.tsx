/**
 * 管理者 / スタッフ の切替。
 * スタッフ向けビルドでは何も出さない（IS_ADMIN_BUILD が偽なので、この部品自体がバンドルから落ちる）。
 * ラベルは常に両方出し、狭い画面でも隠さない。
 */
import { useContext } from "react";
import { IS_ADMIN_BUILD } from "@/lib/appRole";
import { ViewRoleContext, useEffectiveRole } from "@/contexts/ViewRole";

export function RoleViewSwitch() {
  // スタッフ向けビルドでは描画しない。実行時に管理者コンテンツへ入る口も作らない。
  if (!IS_ADMIN_BUILD) return null;
  return <RoleViewSwitchControl />;
}

function RoleViewSwitchControl() {
  const { role, setRole } = useContext(ViewRoleContext);
  // 実効ロールと表示がずれていないことの確認用（スタッフ向けビルドでは到達しない）
  const effective = useEffectiveRole();
  const shown = effective;
  return (
    <div
      role="group"
      aria-label="表示の切替"
      className="inline-flex w-full max-w-[280px] items-stretch rounded-full border border-border bg-muted/70 p-0.5 text-sm font-semibold sm:w-auto"
    >
      <button
        type="button"
        aria-pressed={shown === "admin"}
        onClick={() => setRole("admin")}
        className={`min-h-[44px] flex-1 rounded-full px-4 transition-colors sm:flex-none ${
          shown === "admin"
            ? "bg-white text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        管理者
      </button>
      <button
        type="button"
        aria-pressed={shown === "staff"}
        onClick={() => setRole("staff")}
        className={`min-h-[44px] flex-1 rounded-full px-4 transition-colors sm:flex-none ${
          shown === "staff"
            ? "bg-white text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        スタッフ
      </button>
    </div>
  );
}
