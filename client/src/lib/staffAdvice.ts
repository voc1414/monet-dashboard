/**
 * スタッフ総合点アドバイス生成ユーティリティ
 *
 * 方針:
 * - 最終的にスタッフには「次回予約率」だけを追って欲しい
 * - 次回予約率が上がると稼働率も上がる
 * - NPSはサービスの数値化で自分で見て改善すればいい
 * - 詳しい改善方法はNotionマニュアルへ誘導
 */

const RESERVATION_MANUAL_URL =
  "https://therapeutic-cadet-009.notion.site/18-323ab44d3cb980949927d85ab04c02bf?pvs=74";

const RESERVATION_TARGET = 85; // 次回予約率の目標（%）

export interface StaffAdviceInput {
  /** 総合点 (0-100) */
  totalScore: number;
  /** ランクラベル */
  rankLabel: string;
  /** 次回予約率 (0-100%), null = データなし */
  nextReservationRate: number | null;
  /** 稼働率 (0-100%), null = データなし */
  utilizationRate: number | null;
  /** NPSスコア (-100〜+100), null = データなし */
  npsScore: number | null;
  /** 総客数 */
  totalCustomers: number;
  /** 次回予約数 */
  nextReservationCount: number;
}

export interface StaffAdvice {
  /** 強みの一文 */
  strength: string | null;
  /** 次回予約率の改善アドバイス */
  reservationAdvice: {
    currentRate: number;
    targetRate: number;
    /** あと何名予約を取れば目標達成か */
    additionalNeeded: number;
    /** 目標達成時の予想総合点 */
    projectedScore: number;
    /** 目標達成時の予想ランク */
    projectedRankLabel: string;
    /** マニュアルURL */
    manualUrl: string;
    /** 達成済みかどうか */
    achieved: boolean;
  } | null;
}

/** ランク判定（compositeScore.tsと同じ閾値） */
function getRankLabel(score: number): string {
  if (score >= 85) return "エクセレント";
  if (score >= 70) return "優秀";
  if (score >= 55) return "良好";
  if (score >= 40) return "標準";
  return "要改善";
}

/**
 * 次回予約率が目標に達した場合の総合点を概算
 * 配点: 次回予約率50点 + 稼働率40点 + NPS10点
 */
function projectScoreAtTargetRate(
  targetRate: number,
  utilizationRate: number | null,
  npsScore: number | null,
): number {
  // 次回予約率コンポーネント (85%以上で50点満点)
  const reservationComponent = Math.min((targetRate / 85) * 50, 50);

  // 稼働率コンポーネント
  let utilizationComponent = 0;
  if (utilizationRate !== null) {
    if (utilizationRate >= 95) utilizationComponent = 40;
    else if (utilizationRate <= 60) utilizationComponent = 0;
    else utilizationComponent = ((utilizationRate - 60) / 35) * 40;
  }

  // NPSコンポーネント (簡易計算)
  let npsComponent = 0;
  if (npsScore !== null) {
    npsComponent = ((npsScore + 100) / 200) * 10;
  }

  const rawTotal = reservationComponent + utilizationComponent + npsComponent;

  // 利用可能なウェイトで正規化
  const availableWeight =
    50 + // 予約率は常にあり
    (utilizationRate !== null ? 40 : 0) +
    (npsScore !== null ? 10 : 0);

  return availableWeight > 0 ? Math.round((rawTotal / availableWeight) * 100) : 0;
}

/**
 * 強みの一文を生成
 */
function generateStrength(
  utilizationRate: number | null,
  nextReservationRate: number | null,
  npsScore: number | null,
): string | null {
  const strengths: string[] = [];

  if (utilizationRate !== null && utilizationRate >= 90) {
    strengths.push(`稼働率${utilizationRate}%は高水準。予約枠を安定して埋められています`);
  }
  if (nextReservationRate !== null && nextReservationRate >= 85) {
    strengths.push(`次回予約率${nextReservationRate}%は目標達成。リピーター確保が安定しています`);
  }
  if (npsScore !== null && npsScore >= 50) {
    strengths.push(`NPS+${npsScore}は高評価。お客様満足度が高い接客ができています`);
  }

  if (strengths.length === 0) return null;
  return strengths[0]; // 最も重要な1つだけ返す
}

/**
 * スタッフアドバイスを生成
 */
export function generateStaffAdvice(input: StaffAdviceInput): StaffAdvice {
  const strength = generateStrength(
    input.utilizationRate,
    input.nextReservationRate,
    input.npsScore,
  );

  let reservationAdvice: StaffAdvice["reservationAdvice"] = null;

  if (input.nextReservationRate !== null) {
    const currentRate = input.nextReservationRate;
    const achieved = currentRate >= RESERVATION_TARGET;

    // あと何名必要か計算
    let additionalNeeded = 0;
    if (!achieved && input.totalCustomers > 0) {
      const currentReserved = input.nextReservationCount;
      const neededForTarget = Math.ceil(input.totalCustomers * (RESERVATION_TARGET / 100));
      additionalNeeded = Math.max(0, neededForTarget - currentReserved);
    }

    const projectedScore = achieved
      ? input.totalScore
      : projectScoreAtTargetRate(RESERVATION_TARGET, input.utilizationRate, input.npsScore);

    const projectedRankLabel = achieved ? input.rankLabel : getRankLabel(projectedScore);

    reservationAdvice = {
      currentRate,
      targetRate: RESERVATION_TARGET,
      additionalNeeded,
      projectedScore,
      projectedRankLabel,
      manualUrl: RESERVATION_MANUAL_URL,
      achieved,
    };
  }

  return { strength, reservationAdvice };
}
