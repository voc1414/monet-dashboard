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

export interface ImproveBlock {
  /** 箇条書きの前に置く一文（「あと○名」など）。null なら無し */
  lead: string | null;
  bullets: string[];
  /** 箇条書きの後ろの※書き。null なら無し */
  note: string | null;
}

/** 文中の **…** は画面で赤字にする（インパクトのある数字。2026-10-02 林さん指示） */
export interface GoodImprove {
  good: string;
  improve: ImproveBlock;
  source: string | null;
}

const RESERVATION_BULLETS = [
  "アフターで「次回○○のメニューで○月○日の週ころのご来店がおすすめです。こちらの週の前後のご都合はいかがでしょうか？」と、必ず○月の○週まで案内しましょう。ここで大きく次回予約率が変わります。",
  "案内後は必ずQRコードから再来クーポンを選んでネット予約していただきます。",
];
const RESERVATION_SOURCE = "カウンセリング（トーク要点・アフター説明）／オペレーション（退店時）";

// 1つ目はマニュアル【約12分】予約管理の言葉、2つ目と※書きは林さんの文章（2026-10-02）
const UTILIZATION_BULLETS = [
  "次回予約は平日の午前から優先的に、オープン時間に案内しましょう（10時オープンなら11時ではなく10時か12時）。予約は数ヶ月先までこまめに管理しましょう。",
  "休憩時間や予約枠調整を定期的に行いましょう。",
];
const UTILIZATION_NOTE =
  "予約管理を徹底するだけで**月間で5〜10件**は入客数が変わります。売上に換算すると**7.5万円〜15万円**ほど変わってくるので、隙間時間にご自身の先々の予約管理をまめに行ってくださいますようお願いします。";
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
      improve: {
        lead: "この水準を維持しましょう。",
        bullets: ["カウンセリングの段階から「次回の来店のタイミング」を伝え、アフターで必ず○月の○週まで案内します。"],
        note: null,
      },
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
    improve: { lead: `目標${RESERVATION_TARGET}%まで、**あと${needed}名**。`, bullets: RESERVATION_BULLETS, note: null },
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
      improve: { lead: "この水準を維持しましょう。", bullets: UTILIZATION_BULLETS, note: UTILIZATION_NOTE },
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
    improve: {
      lead: `エクセレント（${UTILIZATION_EXCELLENT}%）まで、**あと${gap}ポイント**。`,
      bullets: UTILIZATION_BULLETS,
      note: UTILIZATION_NOTE,
    },
    source: UTILIZATION_SOURCE,
  };
}
