/**
 * 集客広告 店舗診断（管理者ビルドだけ）。
 * 最初に出すのは院の判定とやること1行、それに全店の短い合計だけ。
 * 数字・ルール・確認中・データなし・前回比はタップで開く。
 */
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  CURRENT_ADS_DIAGNOSIS,
  storesInGradeOrder,
  type DiagnosisGrade,
  type DiagnosisStore,
} from "@/data/adsDiagnosis";

const GRADE_LABEL: Record<DiagnosisGrade, string> = {
  A: "A 枠不足",
  B: "B 広告・LP",
  C: "C",
};

const GRADE_PILL: Record<DiagnosisGrade, string> = {
  A: "bg-[#f8eef0] text-[#8d4452]",
  B: "bg-[#fbf3ea] text-[#8a5a28]",
  C: "bg-muted text-muted-foreground",
};

const GRADE_ROW: Record<DiagnosisGrade, string> = {
  A: "border-[#e7cfd4]",
  B: "border-[#eadcc8]",
  C: "border-border/50",
};

function yen(n: number): string {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

function numOrNone(n: number | null, suffix = ""): string {
  if (n == null) return "データなし";
  return `${n.toLocaleString("ja-JP")}${suffix}`;
}

function pctOrNone(n: number | null): string {
  if (n == null) return "データなし";
  return `${n}%`;
}

function Metric({
  label,
  value,
  source,
}: {
  label: string;
  value: string;
  source: string;
}) {
  return (
    <div className="min-w-0 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground tabular-nums [word-break:auto-phrase]">{value}</div>
      <div className="text-[10px] leading-snug text-muted-foreground [word-break:auto-phrase]">{source}</div>
    </div>
  );
}

function StoreRow({ store }: { store: DiagnosisStore }) {
  const [open, setOpen] = useState(false);
  const d = CURRENT_ADS_DIAGNOSIS;
  const src = (id: string) => {
    const s = d.sources.find((x) => x.id === id);
    return s ? `${s.label} · ${s.fetchedAt}` : "";
  };
  const slots =
    store.slotsNote ??
    (store.slotsCut == null
      ? "データなし"
      : `カット ${store.slotsCut}枠 ／ カット＋カラー ${store.slotsColor ?? "データなし"}枠`);
  return (
    <li className={`rounded-2xl border bg-white shadow-sm ${GRADE_ROW[store.grade]} ${store.grade === "C" ? "opacity-80" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[56px] items-start gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${GRADE_PILL[store.grade]}`}>
          {GRADE_LABEL[store.grade]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">{store.name}</span>
          <span className="mt-0.5 block text-xs text-foreground/80 [word-break:auto-phrase] [text-wrap:pretty]">{store.action}</span>
        </span>
        <ChevronRight className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-x-4 border-t border-border/40 px-4 pb-2 sm:grid-cols-3">
          <Metric label="登録単価" value={yen(store.costPerRegYen)} source={src("meta") + " ÷ " + "Lメッセージ"} />
          <Metric
            label="登録率"
            value={store.regRateNote ? `${store.regRateNote}（30日 ${pctOrNone(store.regRatePct)}）` : pctOrNone(store.regRatePct)}
            source={"登録 ÷ Metaリード · " + src("line")}
          />
          <Metric label="CTR" value={pctOrNone(store.ctrPct)} source={src("meta")} />
          <Metric label="CPM" value={yen(store.cpmYen)} source={src("meta")} />
          <Metric label="空き枠（2週間）" value={slots} source={src("slots")} />
          <Metric label="LP 95%到達" value={store.lpReachPct == null ? store.lpNote : `${store.lpReachPct}% ${store.lpNote}`} source={src("lp")} />
          <Metric label="広告費" value={yen(store.spendYen)} source={src("meta")} />
          <Metric label="リード" value={numOrNone(store.leads)} source={src("meta")} />
          <Metric label="LINE登録" value={numOrNone(store.lineReg)} source={src("line")} />
          <Metric label="新規来店" value={numOrNone(store.newVisits)} source={src("visits")} />
        </div>
      )}
    </li>
  );
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-border/60 bg-white px-4">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 flex-none transition-transform group-open:rotate-90" aria-hidden />
        {title}
      </summary>
      <div className="pb-4 text-sm text-foreground/80">{children}</div>
    </details>
  );
}

export default function AdsDiagnosis() {
  const d = CURRENT_ADS_DIAGNOSIS;
  const stores = storesInGradeOrder(d.stores);
  const counts = { A: 0, B: 0, C: 0 };
  for (const s of stores) counts[s.grade] += 1;

  return (
    <DashboardLayout breadcrumbs={[{ label: "店舗診断" }]}>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">集客広告 店舗診断</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            広告 {d.periodAds} ／ 空き枠 {d.periodSlots}
          </p>
        </div>

        <section className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm" data-testid="diagnosis-totals">
          <h2 className="mb-2 text-xs font-medium text-muted-foreground">全店合計</h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <dt className="text-[11px] text-muted-foreground">広告費</dt>
              <dd className="text-base font-bold tabular-nums">{yen(d.totals.spendYen)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">リード</dt>
              <dd className="text-base font-bold tabular-nums">{d.totals.leads.toLocaleString("ja-JP")}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">LINE登録</dt>
              <dd className="text-base font-bold tabular-nums">{d.totals.lineReg.toLocaleString("ja-JP")}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">登録単価</dt>
              <dd className="text-base font-bold tabular-nums">{yen(d.totals.costPerRegYen)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">登録率</dt>
              <dd className="text-base font-bold tabular-nums">{d.totals.regRatePct}%</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">A {counts.A} ／ B {counts.B} ／ C {counts.C}</p>
        </section>

        <ul className="space-y-2" data-testid="diagnosis-stores">
          {stores.map((store) => (
            <StoreRow key={store.name} store={store} />
          ))}
        </ul>

        <Fold title="判定ルール">
          <ol className="list-decimal space-y-1 pl-5">
            {d.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        </Fold>
        <Fold title="確認中（判定と合計には入れていない）">
          <ul className="space-y-1">
            {d.pending.map((item) => (
              <li key={item}>・{item}</li>
            ))}
          </ul>
        </Fold>
        <Fold title="データなし">
          <ul className="space-y-1">
            {d.missing.map((item) => (
              <li key={item}>・{item}</li>
            ))}
          </ul>
        </Fold>
        <Fold title="前回からの判定の変化">
          <ul className="space-y-1">
            {stores.filter((s) => s.history).map((s) => (
              <li key={s.name}>・{s.name}：{s.history}</li>
            ))}
            <li>・それ以外の院は、前回（11/20）の区分と同じ</li>
          </ul>
        </Fold>
      </div>
    </DashboardLayout>
  );
}
