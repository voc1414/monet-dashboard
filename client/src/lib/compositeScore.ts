/**
 * 総合評価スコア計算ユーティリティ
 * NPS + 次回予約率 + 稼働率 の3指標で100点満点
 */

export interface CompositeScoreInput {
  /** NPSスコア (-100〜+100), null = データなし */
  npsScore: number | null;
  /** NPS回答数 */
  npsResponseCount: number;
  /** 次回予約率 (0〜100%), null = データなし */
  nextReservationRate: number | null;
  /** 稼働率 (0〜100%), null = データなし */
  utilizationRate: number | null;
}

export interface CompositeScoreResult {
  /** 総合スコア (0〜100) */
  total: number;
  /** NPS部分スコア (0〜50) */
  npsComponent: number;
  /** 次回予約率部分スコア (0〜30) */
  reservationComponent: number;
  /** 稼働率部分スコア (0〜20) */
  utilizationComponent: number;
  /** 評価ランク */
  rank: CompositeRank;
  /** データ充足率 (0〜1) — どれだけのデータが揃っているか */
  dataCoverage: number;
  /** 各指標の有効フラグ */
  available: {
    nps: boolean;
    reservation: boolean;
    utilization: boolean;
  };
  /** 各指標の実数値（UI表示用） */
  rawValues: {
    npsScore: number | null;
    npsResponseCount: number;
    nextReservationRate: number | null;
    utilizationRate: number | null;
  };
}

export interface CompositeRank {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: "star" | "trophy" | "check" | "target" | "alert";
}

const RANKS: { min: number; rank: CompositeRank }[] = [
  {
    min: 85,
    rank: {
      label: "エクセレント",
      color: "#B8860B",
      bgColor: "rgba(184, 134, 11, 0.08)",
      borderColor: "rgba(184, 134, 11, 0.25)",
      icon: "star",
    },
  },
  {
    min: 70,
    rank: {
      label: "優秀",
      color: "#2D9C8F",
      bgColor: "rgba(45, 156, 143, 0.08)",
      borderColor: "rgba(45, 156, 143, 0.25)",
      icon: "trophy",
    },
  },
  {
    min: 55,
    rank: {
      label: "良好",
      color: "#3B82F6",
      bgColor: "rgba(59, 130, 246, 0.08)",
      borderColor: "rgba(59, 130, 246, 0.25)",
      icon: "check",
    },
  },
  {
    min: 40,
    rank: {
      label: "標準",
      color: "#E5B85C",
      bgColor: "rgba(229, 184, 92, 0.08)",
      borderColor: "rgba(229, 184, 92, 0.25)",
      icon: "target",
    },
  },
  {
    min: 0,
    rank: {
      label: "要改善",
      color: "#C75C5C",
      bgColor: "rgba(199, 92, 92, 0.08)",
      borderColor: "rgba(199, 92, 92, 0.25)",
      icon: "alert",
    },
  },
];

/**
 * NPS部分スコア (最大50点)
 * NPS -100〜+100 を 0〜50 に線形変換
 * 回答数が少ない場合は信頼度で減衰
 */
function calcNpsComponent(npsScore: number | null, responseCount: number): number {
  if (npsScore === null || responseCount === 0) return 0;
  // NPS -100〜+100 → 0〜50
  const raw = ((npsScore + 100) / 200) * 50;
  // 回答数による信頼度補正（5件以上で100%、1件で60%）
  const confidence = Math.min(1, 0.6 + (responseCount - 1) * 0.1);
  return Math.round(raw * confidence * 10) / 10;
}

/**
 * 次回予約率部分スコア (最大30点)
 * 85%以上で満点、0%で0点
 */
function calcReservationComponent(rate: number | null): number {
  if (rate === null) return 0;
  const clamped = Math.min(Math.max(rate, 0), 100);
  // 85%以上で満点（30点）、線形スケール
  const score = (clamped / 85) * 30;
  return Math.round(Math.min(score, 30) * 10) / 10;
}

/**
 * 稼働率部分スコア (最大20点)
 * 95%以上で満点、60%以下で0点
 */
function calcUtilizationComponent(rate: number | null): number {
  if (rate === null) return 0;
  const clamped = Math.min(Math.max(rate, 0), 100);
  // 95%で満点、60%で0点
  if (clamped >= 95) return 20;
  if (clamped <= 60) return 0;
  return Math.round(((clamped - 60) / 35) * 20 * 10) / 10;
}

/**
 * 総合評価スコアを計算
 */
export function calculateCompositeScore(input: CompositeScoreInput): CompositeScoreResult {
  const available = {
    nps: input.npsScore !== null && input.npsResponseCount > 0,
    reservation: input.nextReservationRate !== null,
    utilization: input.utilizationRate !== null,
  };

  const npsComponent = calcNpsComponent(input.npsScore, input.npsResponseCount);
  const reservationComponent = calcReservationComponent(input.nextReservationRate);
  const utilizationComponent = calcUtilizationComponent(input.utilizationRate);

  // データ充足率: 各指標の配点ウェイトで重み付け
  const maxPoints = { nps: 50, reservation: 30, utilization: 20 };
  const availableWeight =
    (available.nps ? maxPoints.nps : 0) +
    (available.reservation ? maxPoints.reservation : 0) +
    (available.utilization ? maxPoints.utilization : 0);

  const dataCoverage = availableWeight / 100;

  // 総合スコア: データがある指標のみで正規化して100点満点にスケール
  const rawTotal = npsComponent + reservationComponent + utilizationComponent;
  const total = availableWeight > 0 ? Math.round((rawTotal / availableWeight) * 100) : 0;

  // ランク判定
  const rank = RANKS.find(r => total >= r.min)?.rank || RANKS[RANKS.length - 1].rank;

  return {
    total,
    npsComponent,
    reservationComponent,
    utilizationComponent,
    rank,
    dataCoverage,
    available,
    rawValues: {
      npsScore: input.npsScore,
      npsResponseCount: input.npsResponseCount,
      nextReservationRate: input.nextReservationRate,
      utilizationRate: input.utilizationRate,
    },
  };
}

/**
 * ランクを取得（スコアから直接）
 */
export function getCompositeRank(score: number): CompositeRank {
  return RANKS.find(r => score >= r.min)?.rank || RANKS[RANKS.length - 1].rank;
}
