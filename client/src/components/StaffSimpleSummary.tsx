/*
 * スタッフ向けビルド専用の要約（2026-10-02 林さん指示 GF-MDASH-M14）。
 * 次回予約率・稼働率・NPSスコアを1枠ずつ縦に並べ、枠の中に大きい数字と「よかった点・改善点」を出す。
 * 管理者向けビルドでは使わない（総合点・既存アドバイスのまま）。
 */
import { CalendarCheck, Gauge, BarChart3, ExternalLink } from "lucide-react";
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
  if (rate >= 70) return { color: OK, label: "適正" };
  return { color: NG, label: "要改善" };
}

function utilizationLevel(rate: number): Level {
  if (rate >= UTILIZATION_EXCELLENT) return { color: EX, label: "エクセレント" };
  if (rate >= UTILIZATION_OK) return { color: OK, label: "適正" };
  return { color: NG, label: "要改善" };
}

function BigNumber({ value, unit, level }: { value: string | null; unit?: string; level: Level }) {
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
  icon, title, note, number, gi, link,
}: {
  icon: ReactNode;
  title: string;
  note?: string;
  number: ReactNode;
  /** よかった点・改善点を出せないときは null（数字だけ表示） */
  gi: GoodImprove | null;
  link?: { href: string; label: string };
}) {
  return (
    <section className="bg-card border border-border/60 rounded-2xl p-3.5">
      <h2 className="text-[15px] font-bold mb-2.5 flex items-center gap-1.5">
        {icon}
        {title}
        {note && <span className="ml-auto text-[11px] font-normal text-muted-foreground">{note}</span>}
      </h2>
      {number}
      {gi && <div className="flex flex-col gap-2 text-[13px] leading-relaxed">
        <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: "#EAF5F3" }}>
          <div className="text-xs font-bold mb-0.5" style={{ color: EX }}>よかった点</div>
          {gi.good}
        </div>
        <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: "#FBF0EF" }}>
          <div className="text-xs font-bold mb-0.5" style={{ color: NG }}>改善点</div>
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
              className="inline-flex items-center gap-1 text-xs mt-1"
              style={{ color: EX }}
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

export default function StaffSimpleSummary({
  nextReservationRate, totalCustomers, reserved, utilizationRate, npsStats, npsRecords,
}: {
  /** 月末報告書が無い期間は null */
  nextReservationRate: number | null;
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

  return (
    <div className="flex flex-col gap-3.5 mb-8">
      <GoodImproveCard
        icon={<CalendarCheck className="w-4 h-4 text-muted-foreground" />}
        title="次回予約"
        note={nextReservationRate !== null ? `総入客${totalCustomers}名中 ${reserved}名` : undefined}
        number={
          <BigNumber
            value={nextReservationRate !== null ? String(nextReservationRate) : null}
            unit="%"
            level={nextReservationRate !== null ? reservationLevel(nextReservationRate) : null}
          />
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
