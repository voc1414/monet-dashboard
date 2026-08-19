/*
 * データ点検パネル — 「今日、直すことがあるか」を先に一言で出す。
 *
 * 2026-08-19〜20 に見つかった不具合は全部「silent に数字が壊れる」種類だった:
 *   ・名寄せが外れて売上が ¥0 表示（サロンボードに着地していなかった）
 *   ・同名別人のNPSが混ざる
 *   ・ファンくるの担当者が敬称つきで紐づかない
 * どれも画面上は普通に見えるので気づけない。ここで機械的に検出する。
 */
import { useMemo, useState } from "react";
import { ChevronDown, CircleCheck, AlertTriangle } from "lucide-react";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useSalonBoardStylistData, stylistKey } from "@/hooks/useSalonBoardStylistData";
import { useNpsData } from "@/hooks/useNpsData";
import { canonicalizeStaffName, normalizeStaffKey } from "@/lib/staffNameAlias";
import { isRetiredStaff } from "@/lib/newBadge";

/** 日次で入るデータの許容遅れ（日）。これを超えたら赤。 */
const STALE_DAYS = 14;
/** 月次で入るデータの許容遅れ（月）。前月までは正常とみなす。 */
const STALE_MONTHS = 2;

type Issue = { kind: string; detail: string };

// 「予約なし枠」など、人ではない担当名。重複していても問題ではない。
const NOT_A_PERSON = ["フリー", "free", "選択しない"];

function ymOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthsAgo(ym: string, base: string): number {
  const [y1, m1] = ym.split("-").map(Number);
  const [y2, m2] = base.split("-").map(Number);
  if (!y1 || !y2) return 99;
  return (y2 - y1) * 12 + (m2 - m1);
}

export default function DataHealthPanel() {
  const [open, setOpen] = useState(false);
  const { rawData: reports, loading: l1 } = useMonthlyReport();
  const { data: stylistRows, loading: l2 } = useSalonBoardStylistData();
  const { records: npsRecords, loading: l3 } = useNpsData();
  const loading = l1 || l2 || l3;

  const { freshness, issues, notes } = useMemo(() => {
    const today = new Date();
    const todayYm = ymOf(today);
    const fresh: { name: string; latest: string; ok: boolean; note: string }[] = [];
    const found: Issue[] = []; // 直すもの
    const notes: string[] = []; // 直すものではないが知っておく情報

    // ---- 鮮度 ----
    const sbLatest = stylistRows.map((r) => r.yearMonth).sort().pop() || "";
    if (sbLatest) {
      const lag = monthsAgo(sbLatest, todayYm);
      fresh.push({ name: "サロンボード実績", latest: sbLatest, ok: lag < STALE_MONTHS, note: `${lag}ヶ月前まで` });
      if (lag >= STALE_MONTHS) found.push({ kind: "データが止まっている", detail: `サロンボード実績が ${sbLatest} で止まっています（${lag}ヶ月前）` });
    }
    const repLatest = reports.map((r) => r.answerDate || "").sort().pop() || "";
    if (repLatest) {
      const d = new Date(repLatest.slice(0, 10));
      const days = Math.floor((today.getTime() - d.getTime()) / 86400000);
      const ok = days <= 45; // 月末報告書は月初に集まるので45日を上限にする
      fresh.push({ name: "月末報告書", latest: repLatest.slice(0, 10), ok, note: `${days}日前` });
      if (!ok) found.push({ kind: "データが止まっている", detail: `月末報告書が ${days}日 届いていません（最終 ${repLatest.slice(0, 10)}）` });
    }
    const npsLatest = npsRecords.map((r) => r.date || "").sort().pop() || "";
    if (npsLatest) {
      const d = new Date(npsLatest.replace(/\//g, "-").slice(0, 10));
      const days = Math.floor((today.getTime() - d.getTime()) / 86400000);
      const ok = days <= STALE_DAYS;
      fresh.push({ name: "NPS（口コミ）", latest: npsLatest.slice(0, 10), ok, note: `${days}日前` });
      if (!ok) found.push({ kind: "データが止まっている", detail: `NPSが ${days}日 増えていません（最終 ${npsLatest.slice(0, 10)}）` });
    }

    // ---- 整合: 月末報告書の氏名がサロンボード実績に着地するか ----
    // 着地しないと「実績なし」と判定され、売上が ¥0 で表示される（月末報告書にはフォールバックしない仕様）。
    const boardKeys = new Set(stylistRows.map((r) => `${r.storeName}__${stylistKey(r.stylist)}`));
    const seen = new Set<string>();
    for (const r of reports) {
      const name = canonicalizeStaffName(r.name);
      const store = r.storeNormalized;
      if (!name || !store) continue;
      const id = `${store}__${name}`;
      if (seen.has(id)) continue;
      seen.add(id);
      // 集計対象外・退職者は着地しなくて当然なので除く
      if (isRetiredStaff(name, store, "")) continue;
      if (!boardKeys.has(`${store}__${stylistKey(name)}`)) {
        found.push({ kind: "サロンボードに着地しない", detail: `${store} / ${name}（売上が ¥0 表示になります）` });
      }
    }

    // ---- 整合: 同じ表示名が複数店舗にいる（別人が混ざる元） ----
    const byName = new Map<string, Set<string>>();
    for (const r of stylistRows) {
      const k = stylistKey(r.stylist);
      if (!k) continue;
      const set = byName.get(k) || new Set<string>();
      set.add(r.storeName);
      byName.set(k, set);
    }
    for (const [k, stores] of Array.from(byName.entries())) {
      if (stores.size > 1 && !NOT_A_PERSON.includes(k)) {
        // これは直すものではなく「構造的にそうなっている」事実。
        // 警告に混ぜると毎回赤くなって誰も見なくなるので、情報として置くだけにする。
        notes.push(`${k}（${Array.from(stores).join(" / ")}）`);
      }
    }

    // ---- 整合: NPSの担当名が名簿に着地するか ----
    const roster = new Set(reports.map((r) => normalizeStaffKey(canonicalizeStaffName(r.name))));
    const npsSeen = new Set<string>();
    for (const r of npsRecords) {
      const staff = (r.staff || "").trim();
      if (!staff || staff === "選択しない") continue;
      const k = normalizeStaffKey(staff);
      if (roster.has(k)) continue;
      const id = `${k}__${r.storeShort}`;
      if (npsSeen.has(id)) continue;
      npsSeen.add(id);
      found.push({ kind: "NPSが誰にも紐づかない", detail: `${r.storeShort} / ${staff}` });
    }

    return { freshness: fresh, issues: found, notes };
  }, [reports, stylistRows, npsRecords]);

  if (loading) return null;

  const grouped = issues.reduce<Record<string, string[]>>((a, i) => {
    (a[i.kind] = a[i.kind] || []).push(i.detail);
    return a;
  }, {});
  const ok = issues.length === 0;

  return (
    <div className={`rounded-2xl border shadow-sm mb-6 ${ok ? "border-emerald-200 bg-emerald-50/50" : "border-amber-300 bg-amber-50/60"}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {ok ? (
          <CircleCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
        )}
        <span className="font-semibold text-sm text-foreground">
          {ok ? "データ点検：問題ありません" : `データ点検：確認したいことが ${issues.length} 件あります`}
        </span>
        <ChevronDown className={`w-4 h-4 ml-auto text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 text-sm">
          {Object.entries(grouped).map(([kind, list]) => (
            <div key={kind}>
              <div className="font-semibold text-foreground mb-1">
                {kind}（{list.length}件）
              </div>
              <ul className="space-y-0.5 text-muted-foreground">
                {list.slice(0, 12).map((d, i) => (
                  <li key={i}>・{d}</li>
                ))}
                {list.length > 12 && <li>・ほか {list.length - 12} 件</li>}
              </ul>
            </div>
          ))}

          {notes.length > 0 && (
            <div>
              <div className="font-semibold text-foreground mb-1">
                参考：同じ表示名が複数店舗にいます（{notes.length}件）
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                別人なので、突合は必ず「店舗＋表示名」の組で行う必要があります。異常ではありません。
              </p>
              <ul className="space-y-0.5 text-muted-foreground">
                {notes.map((n, i) => (
                  <li key={i}>・{n}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="font-semibold text-foreground mb-1">データの新しさ</div>
            <ul className="space-y-0.5 text-muted-foreground">
              {freshness.map((f) => (
                <li key={f.name}>
                  {f.ok ? "🟢" : "🔴"} {f.name}：{f.latest}（{f.note}）
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
            判定：日次で入るデータは{STALE_DAYS}日、月次のものは{STALE_MONTHS}ヶ月、月末報告書は45日を超えて更新が無ければ赤。
            「サロンボードに着地しない」は名寄せが外れているサインで、放置すると売上が ¥0 のまま表示されます。
          </p>
        </div>
      )}
    </div>
  );
}
