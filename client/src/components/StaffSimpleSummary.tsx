/*
 * スタッフ向けビルド専用の要約（2026-10-02 林さん指示 GF-MDASH-M14）。
 * 次回予約率・稼働率・NPSスコアを1枠ずつ縦に並べ、枠の中に大きい数字と「よかった点・改善点」を出す。
 * 管理者向けビルドでは使わない（総合点・既存アドバイスのまま）。
 * 色は「数字＋判定バッジ」と改善点の強調語だけに付け、箱やリンクはグレーにそろえる（2026-10-02 林さん指示）。
 */
import { AlertTriangle, CalendarCheck, Gauge, BarChart3, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import type { StoreStats, NpsRecord } from "@/hooks/useNpsData";
import { generateStoreAdvice } from "@/lib/npsAdvice";
import { getNpsClass } from "@/lib/npsClass";
import { RESERVATION_MANUAL_URL } from "@/lib/staffAdvice";
import {
  reservationGoodImprove,
  utilizationGoodImprove,
  RESERVATION_TARGET,
  UTILIZATION_EXCELLENT,
  UTILIZATION_OK,
} from "@/lib/staffSimpleAdvice";
import type { GoodImprove } from "@/lib/staffSimpleAdvice";

const EX = "#2D9C8F";
const OK = "#E5B85C";
const NG = "#C75C5C";

type Level = { color: string; label: string } | null;

function reservationLevel(rate: number): Level {
  if (rate >= RESERVATION_TARGET) return { color: EX, label: "エクセレント" };
  // 70.1%以上で適正（2026-10-03 林さん指示 GF-MDASH-M16。70%以下は要改善＝次回予約強化の対象と一致）
  if (rate > 70) return { color: OK, label: "適正" };
  return { color: NG, label: "要改善" };
}

function utilizationLevel(rate: number): Level {
  if (rate >= UTILIZATION_EXCELLENT) return { color: EX, label: "エクセレント" };
  if (rate >= UTILIZATION_OK) return { color: OK, label: "適正" };
  return { color: NG, label: "要改善" };
}

function BigNumber({
  value, unit, level, extra,
}: { value: string | null; unit?: string; level: Level; extra?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 mb-2.5">
      <div
        className="font-mono-data text-4xl font-extrabold leading-none tracking-tight"
        style={{ color: level?.color }}
      >
        {value ?? "—"}
        {value !== null && unit && <span className="text-lg font-bold">{unit}</span>}
      </div>
      {level && (
        <span
          className="inline-block text-[11px] font-bold text-white rounded-full px-2 py-px"
          style={{ backgroundColor: level.color }}
        >
          {level.label}
        </span>
      )}
      {extra}
    </div>
  );
}

/** **…** を赤字の太字にする */
function Emph({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <strong key={i} className="font-bold" style={{ color: NG }}>{p}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

function GoodImproveCard({
  icon, title, note, number, gi, link, accent,
}: {
  /** 枠の色（次回予約が連続で70%以下のときだけ） */
  accent?: string;
  icon: ReactNode;
  title: string;
  note?: string;
  number: ReactNode;
  /** よかった点・改善点を出せないときは null（数字だけ表示） */
  gi: GoodImprove | null;
  link?: { href: string; label: string };
}) {
  return (
    <section
      className={`bg-card rounded-2xl p-3.5 ${accent ? "border-2" : "border border-border/60"}`}
      style={accent ? { borderColor: accent } : undefined}
    >
      <h2 className="text-[15px] font-bold mb-2.5 flex items-center gap-1.5">
        {icon}
        {title}
        {note && <span className="ml-auto text-[11px] font-normal text-muted-foreground">{note}</span>}
      </h2>
      {number}
      {gi && <div className="flex flex-col gap-2 text-[13px] leading-relaxed">
        <div className="rounded-lg px-3 py-2.5 border border-muted" style={{ backgroundColor: "#FDFCFA" }}>
          <div className="text-[15px] font-bold mb-1 pb-1 border-b border-muted text-foreground [word-break:keep-all]">よかった点</div>
          {gi.good}
        </div>
        <div className="rounded-lg px-3 py-2.5 border border-muted" style={{ backgroundColor: "#FDFCFA" }}>
          <div className="text-[15px] font-bold mb-1 pb-1 border-b border-muted text-foreground [word-break:keep-all]">改善点</div>
          {gi.improve.lead && <p><Emph text={gi.improve.lead} /></p>}
          {gi.improve.bullets.length > 0 && (
            <ul className="list-disc pl-4 mt-1 space-y-1">
              {gi.improve.bullets.map((b, i) => <li key={i}><Emph text={b} /></li>)}
            </ul>
          )}
          {gi.improve.note && (
            <p className="mt-1.5 text-[12px]">※<Emph text={gi.improve.note} /></p>
          )}
          {gi.source && <div className="text-[10px] text-muted-foreground mt-1">出典：{gi.source}</div>}
          {link && (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs mt-1 text-foreground underline underline-offset-2"
            >
              {link.label}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>}
    </section>
  );
}

/**
 * 次回予約が70%以下で続いた月数（2ヶ月以上で表示。2026-10-03 林さん指示 GF-MDASH-M16）。
 * 2ヶ月＝黄、3ヶ月以上＝赤（管理者の次回予約強化タブと同じ色分け）。
 * 2026-10-05 見やすさ改善（林さん指示 案1〜4）：塗りつぶしの大きいアイコン・カード枠の色・月ごとの丸・一言メッセージ。
 */
function streakColor(streak: number): string | undefined {
  if (streak < 2) return undefined;
  return streak >= 3 ? NG : "#D99A2B";
}

function StreakIcon({ streak }: { streak: number }) {
  const color = streakColor(streak);
  if (!color) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-sm font-bold text-white rounded-full px-2.5 py-0.5 self-center"
      style={{ backgroundColor: color }}
      data-testid="reservation-streak"
    >
      <AlertTriangle className="w-4 h-4" />
      {streak}ヶ月連続
    </span>
  );
}

function StreakDetail({ months }: { months: string[] }) {
  const color = streakColor(months.length);
  if (!color) return null;
  return (
    <div className="mb-2.5" data-testid="reservation-streak-detail">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-1">
        {months.map((m) => (
          <span key={m} className="inline-flex items-center gap-1 text-xs text-foreground">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            {Number(m.slice(5, 7))}月
          </span>
        ))}
      </div>
      <p className="text-[13px] font-bold [word-break:keep-all]" style={{ color }}>
        {months.length}ヶ月続けて70%以下です。<wbr />次の月は70.1%以上を<wbr />目指しましょう。
      </p>
    </div>
  );
}

export default function StaffSimpleSummary({
  nextReservationRate, reservationStreakMonths = [], totalCustomers, reserved, utilizationRate, npsStats, npsRecords,
}: {
  /** 月末報告書が無い期間は null */
  nextReservationRate: number | null;
  /** 70%以下が続いている月（古い順。空＝続いていない） */
  reservationStreakMonths?: string[];
  totalCustomers: number;
  reserved: number;
  /** パート等で算出できないときは null */
  utilizationRate: number | null;
  npsStats: StoreStats | null;
  npsRecords: NpsRecord[];
}) {
  const npsScore = npsStats ? npsStats.npsScore : null;
  const npsClass = npsScore !== null ? getNpsClass(npsScore) : null;
  const npsAdvice = npsStats ? generateStoreAdvice(npsStats, npsRecords) : null;
  const streak = reservationStreakMonths.length;

  return (
    <div className="flex flex-col gap-3.5 mb-8">
      <GoodImproveCard
        icon={<CalendarCheck className="w-4 h-4 text-muted-foreground" />}
        title="次回予約"
        note={nextReservationRate !== null ? `総入客${totalCustomers}名中 ${reserved}名` : undefined}
        accent={nextReservationRate !== null ? streakColor(streak) : undefined}
        number={
          <>
            <BigNumber
              value={nextReservationRate !== null ? String(nextReservationRate) : null}
              unit="%"
              level={nextReservationRate !== null ? reservationLevel(nextReservationRate) : null}
              extra={nextReservationRate !== null ? <StreakIcon streak={streak} /> : undefined}
            />
            {nextReservationRate !== null && <StreakDetail months={reservationStreakMonths} />}
          </>
        }
        gi={nextReservationRate !== null
          ? reservationGoodImprove({ rate: nextReservationRate, totalCustomers, reserved, npsScore })
          : null}
        link={nextReservationRate !== null ? { href: RESERVATION_MANUAL_URL, label: "次回予約率の改善マニュアル" } : undefined}
      />

      <GoodImproveCard
        icon={<Gauge className="w-4 h-4 text-muted-foreground" />}
        title="稼働率"
        number={
          <BigNumber
            value={utilizationRate !== null ? String(utilizationRate) : null}
            unit="%"
            level={utilizationRate !== null ? utilizationLevel(utilizationRate) : null}
          />
        }
        gi={utilizationRate !== null && nextReservationRate !== null
          ? utilizationGoodImprove({ rate: utilizationRate, nextReservationRate, totalCustomers })
          : null}
      />

      <GoodImproveCard
        icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />}
        title="NPSスコア"
        note={npsStats ? `${npsStats.totalResponses}件` : undefined}
        number={
          <BigNumber
            value={npsScore !== null ? `${npsScore > 0 ? "+" : ""}${npsScore}` : null}
            level={npsClass ? { color: npsClass.color, label: npsClass.label } : null}
          />
        }
        gi={npsAdvice && (npsAdvice.strengths.length > 0 || npsAdvice.improvements.length > 0)
          ? {
              good: npsAdvice.strengths[0] ?? "—",
              improve: npsAdvice.improvements[0]
                ? { lead: null, bullets: [npsAdvice.improvements[0]], note: null }
                : { lead: "この水準を維持しましょう。", bullets: [], note: null },
              source: null,
            }
          : null}
      />
    </div>
  );
}
