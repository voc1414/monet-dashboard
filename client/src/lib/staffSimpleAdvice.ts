/**
 * スタッフ用ダッシュボードの「よかった点・改善点」生成
 *
 * 次回予約・稼働率の文言は monet 社員用マニュアル（Notion）の言葉から選んでいる（2026-10-02 林さん指示）。
 * - 次回予約: 【約14分】カウンセリング（トーク要点・アフター説明）／【約18分】オペレーション（退店時）
 * - 稼働率:   【約12分】予約管理（予約管理のルール・次回予約ルール）
 * NPS は既存の generateStoreAdvice（マニュアルの価値観・接客基準ベース）の先頭1件ずつを使う。
 */

export const RESERVATION_TARGET = 85;
export const UTILIZATION_EXCELLENT = 95;
export const UTILIZATION_OK = 90;

export interface GoodImprove {
  good: string;
  improve: string;
  source: string | null;
}

const RESERVATION_TALK =
  "アフターで「次回○○のメニューで○月○日の週ころのご来店がおすすめです。こちらの週の前後のご都合はいかがでしょうか？」と、必ず○月の○週まで案内しましょう。ここで大きく次回予約率が変わります。案内後は必ずQRコードから再来クーポンを選んでネット予約していただきます。";
const RESERVATION_SOURCE = "カウンセリング（トーク要点・アフター説明）／オペレーション（退店時）";

const UTILIZATION_TALK =
  "次回予約は平日の午前から優先的に、オープン時間に案内しましょう（10時オープンなら11時ではなく10時か12時）。予約は数ヶ月先までこまめに管理しましょう。";
const UTILIZATION_SOURCE = "予約管理（予約管理のルール・次回予約ルール）";

/** 目標85%まであと何名か（staffAdvice と同じ計算） */
export function reservationsNeeded(totalCustomers: number, reserved: number): number {
  if (totalCustomers <= 0) return 0;
  return Math.max(0, Math.ceil(totalCustomers * (RESERVATION_TARGET / 100)) - reserved);
}

export function reservationGoodImprove(input: {
  rate: number;
  totalCustomers: number;
  reserved: number;
  npsScore: number | null;
}): GoodImprove {
  const { rate, totalCustomers, reserved, npsScore } = input;
  if (rate >= RESERVATION_TARGET) {
    return {
      good: `次回予約率${rate}%で目標${RESERVATION_TARGET}%を達成。アフターでの次回予約案内ができています。`,
      improve: "この水準を維持しましょう。カウンセリングの段階から「次回の来店のタイミング」を伝え、アフターで必ず○月の○週まで案内します。",
      source: RESERVATION_SOURCE,
    };
  }
  const good =
    npsScore !== null && npsScore >= 50
      ? `NPS +${npsScore}と仕上がりへの満足は高く、「感動しているタイミング」は作れています。あとはそのタイミングで次回の案内につなげるだけです。`
      : `総入客${totalCustomers}名中${reserved}名に次回予約を案内できています。`;
  const needed = reservationsNeeded(totalCustomers, reserved);
  return {
    good,
    improve: `目標${RESERVATION_TARGET}%まで、あと${needed}名。${RESERVATION_TALK}`,
    source: RESERVATION_SOURCE,
  };
}

export function utilizationGoodImprove(input: {
  rate: number;
  nextReservationRate: number;
  totalCustomers: number;
}): GoodImprove {
  const { rate, nextReservationRate, totalCustomers } = input;
  if (rate >= UTILIZATION_EXCELLENT) {
    return {
      good: `${rate}%でエクセレント。予約枠をしっかり埋められています。`,
      improve: "この水準を維持しましょう。予約は数ヶ月先までこまめに管理しましょう。",
      source: UTILIZATION_SOURCE,
    };
  }
  const gap = Math.round((UTILIZATION_EXCELLENT - rate) * 10) / 10;
  const good =
    rate >= UTILIZATION_OK
      ? `${rate}%で適正の水準です。予約枠をしっかり埋められています。`
      : nextReservationRate >= RESERVATION_TARGET
        ? `次回予約率${nextReservationRate}%と、リピートの土台はできています。`
        : `総客数${totalCustomers}名を担当しました。`;
  return {
    good,
    improve: `エクセレント（${UTILIZATION_EXCELLENT}%）まで、あと${gap}ポイント。${UTILIZATION_TALK}`,
    source: UTILIZATION_SOURCE,
  };
}
