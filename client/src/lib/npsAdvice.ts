// ============================================================
// NPS 総合アドバイスコメント生成ロジック
// ============================================================
// 各店舗のNPSスコア・推奨者率・批判者率・カテゴリ別評価・
// レビュー内容を総合的に分析し、具体的な改善アドバイスを生成する。

import type { NpsRecord, StoreStats } from "@/hooks/useNpsData";

export interface NpsAdvice {
  summary: string;        // 総合評価の一言
  strengths: string[];    // 強み（最大3つ）
  improvements: string[]; // 改善提案（最大3つ）
  actionItems: string[];  // 具体的アクション（最大2つ）
  icon: "trophy" | "thumbsUp" | "target" | "alertTriangle" | "alertCircle";
}

interface CategoryBreakdown {
  field: string;
  label: string;
  topItems: { name: string; pct: number }[];
}

function analyzeCategoryData(records: NpsRecord[]): {
  price: CategoryBreakdown;
  space: CategoryBreakdown;
  staff: CategoryBreakdown;
  finish: CategoryBreakdown;
} {
  const analyze = (field: keyof NpsRecord, label: string): CategoryBreakdown => {
    const counts: Record<string, number> = {};
    records.forEach((r) => {
      const val = r[field] as string;
      if (!val) return;
      val.split(",").forEach((v) => {
        const trimmed = v.trim();
        if (trimmed) counts[trimmed] = (counts[trimmed] || 0) + 1;
      });
    });
    const total = records.length;
    const topItems = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, pct: Math.round((value / total) * 100) }));
    return { field, label, topItems };
  };

  return {
    price: analyze("priceComment", "金額"),
    space: analyze("spaceComment", "空間"),
    staff: analyze("staffComment", "スタッフ"),
    finish: analyze("finishComment", "仕上がり"),
  };
}

// ポジティブ/ネガティブのキーワード判定
const POSITIVE_KEYWORDS = [
  "満足", "良い", "良かった", "素敵", "丁寧", "最高", "嬉しい", "綺麗",
  "リラックス", "居心地", "安心", "信頼", "気持ち良", "おすすめ", "また来",
  "癒", "清潔", "快適", "上手", "感動", "完璧", "理想", "気に入",
];

const NEGATIVE_KEYWORDS = [
  "残念", "不満", "改善", "高い", "待ち時間", "長い", "微妙", "期待外れ",
  "雑", "不安", "痛", "ムラ", "合わな", "違う", "もう少し", "気になる",
];

function analyzeReviewSentiment(records: NpsRecord[]): {
  positiveThemes: string[];
  negativeThemes: string[];
  positiveRatio: number;
} {
  const reviews = records.filter((r) => r.review).map((r) => r.review);
  if (reviews.length === 0) return { positiveThemes: [], negativeThemes: [], positiveRatio: 100 };

  const positiveCounts: Record<string, number> = {};
  const negativeCounts: Record<string, number> = {};
  let positiveReviews = 0;

  reviews.forEach((review) => {
    let hasNegative = false;
    POSITIVE_KEYWORDS.forEach((kw) => {
      if (review.includes(kw)) {
        positiveCounts[kw] = (positiveCounts[kw] || 0) + 1;
      }
    });
    NEGATIVE_KEYWORDS.forEach((kw) => {
      if (review.includes(kw)) {
        negativeCounts[kw] = (negativeCounts[kw] || 0) + 1;
        hasNegative = true;
      }
    });
    if (!hasNegative) positiveReviews++;
  });

  const positiveThemes = Object.entries(positiveCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kw]) => kw);

  const negativeThemes = Object.entries(negativeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kw]) => kw);

  return {
    positiveThemes,
    negativeThemes,
    positiveRatio: Math.round((positiveReviews / reviews.length) * 100),
  };
}

export function generateStoreAdvice(
  stats: StoreStats,
  records: NpsRecord[]
): NpsAdvice {
  const categories = analyzeCategoryData(records);
  const sentiment = analyzeReviewSentiment(records);

  const strengths: string[] = [];
  const improvements: string[] = [];
  const actionItems: string[] = [];
  let summary = "";
  let icon: NpsAdvice["icon"] = "target";

  // --- 総合評価サマリー ---
  if (stats.npsScore >= 70) {
    summary = `NPS +${stats.npsScore}は業界トップクラスの水準です。推奨者率${stats.promoterPct}%と非常に高く、顧客ロイヤルティが確立されています。この水準を維持しながら、さらなる差別化を図りましょう。`;
    icon = "trophy";
  } else if (stats.npsScore >= 50) {
    summary = `NPS +${stats.npsScore}は非常に高い水準です。推奨者率${stats.promoterPct}%で多くのお客様から支持されています。中立者を推奨者に転換することで、さらなる成長が見込めます。`;
    icon = "thumbsUp";
  } else if (stats.npsScore >= 20) {
    summary = `NPS +${stats.npsScore}は業界平均を上回る良好な水準です。推奨者率${stats.promoterPct}%を維持しつつ、批判者率${stats.detractorPct}%の低減に注力することで大きな改善が期待できます。`;
    icon = "target";
  } else if (stats.npsScore >= 0) {
    summary = `NPS +${stats.npsScore}は業界平均付近の水準です。批判者率${stats.detractorPct}%の改善が最優先課題です。顧客体験の見直しにより、大幅なスコア向上が可能です。`;
    icon = "alertTriangle";
  } else {
    summary = `NPS ${stats.npsScore}は改善が必要な水準です。批判者率${stats.detractorPct}%が高く、顧客体験の根本的な見直しが急務です。まずは批判者の声に耳を傾け、優先的に対応しましょう。`;
    icon = "alertCircle";
  }

  // --- 強みの分析 ---
  if (stats.promoterPct >= 80) {
    strengths.push(`推奨者率${stats.promoterPct}%と圧倒的に高く、口コミによる集客力が期待できます`);
  } else if (stats.promoterPct >= 60) {
    strengths.push(`推奨者率${stats.promoterPct}%と高水準で、多くのお客様が満足しています`);
  }

  if (stats.detractorPct === 0) {
    strengths.push("批判者がゼロで、全てのお客様が一定以上の満足を感じています");
  } else if (stats.detractorPct <= 5) {
    strengths.push(`批判者率${stats.detractorPct}%と非常に低く、安定したサービス品質を維持しています`);
  }

  if (stats.avgScore >= 9.0) {
    strengths.push(`平均スコア${stats.avgScore}と極めて高く、一貫した高品質サービスが提供されています`);
  } else if (stats.avgScore >= 8.5) {
    strengths.push(`平均スコア${stats.avgScore}と高水準で、安定したサービス品質です`);
  }

  // カテゴリ別の強み
  const categoryStrengths: string[] = [];
  [categories.space, categories.staff, categories.finish, categories.price].forEach((cat) => {
    if (cat.topItems.length > 0 && cat.topItems[0].pct >= 50) {
      categoryStrengths.push(`${cat.label}面で「${cat.topItems[0].name}」が${cat.topItems[0].pct}%と高評価`);
    }
  });
  if (categoryStrengths.length > 0 && strengths.length < 3) {
    strengths.push(categoryStrengths.slice(0, 3 - strengths.length).join("、"));
  }

  // レビューの強み
  if (sentiment.positiveThemes.length > 0 && strengths.length < 3) {
    strengths.push(`レビューでは「${sentiment.positiveThemes.join("」「")}」などのポジティブな声が多数`);
  }

  // --- 改善提案 ---
  if (stats.passivePct >= 30) {
    improvements.push(`中立者（7-8点）が${stats.passivePct}%を占めています。「あと一歩」の感動体験を加えることで推奨者への転換が期待できます`);
  } else if (stats.passivePct >= 15) {
    improvements.push(`中立者が${stats.passivePct}%います。パーソナライズされた接客やサプライズ要素で推奨者への転換を狙いましょう`);
  }

  if (stats.detractorPct >= 10) {
    improvements.push(`批判者率${stats.detractorPct}%の低減が最重要課題です。低評価のお客様への個別フォローアップを検討してください`);
  } else if (stats.detractorPct >= 3) {
    improvements.push(`批判者率${stats.detractorPct}%をゼロに近づけることで、NPSの大幅な向上が見込めます`);
  }

  // カテゴリ別の改善点（ネガティブ寄りの回答が多いカテゴリ）
  const negativeCategories = [categories.price, categories.space, categories.staff, categories.finish]
    .filter((cat) => {
      return cat.topItems.some((item) =>
        item.name.includes("高い") || item.name.includes("不満") || item.name.includes("改善") ||
        item.name.includes("普通") || item.name.includes("微妙") || item.name.includes("狭")
      );
    });

  if (negativeCategories.length > 0 && improvements.length < 3) {
    negativeCategories.slice(0, 3 - improvements.length).forEach((cat) => {
      const negItem = cat.topItems.find((item) =>
        item.name.includes("高い") || item.name.includes("不満") || item.name.includes("改善") ||
        item.name.includes("普通") || item.name.includes("微妙") || item.name.includes("狭")
      );
      if (negItem) {
        improvements.push(`${cat.label}面で「${negItem.name}」という声が${negItem.pct}%あります。対策の検討をお勧めします`);
      }
    });
  }

  // レビューのネガティブテーマ
  if (sentiment.negativeThemes.length > 0 && improvements.length < 3) {
    improvements.push(`レビューで「${sentiment.negativeThemes.join("」「")}」などの声が見られます。優先的に対応を検討してください`);
  }

  // 改善がない場合の補足
  if (improvements.length === 0) {
    improvements.push("現在の高い水準を維持するため、スタッフ間でのベストプラクティス共有を継続してください");
  }

  // --- 具体的アクション ---
  if (stats.npsScore >= 70) {
    actionItems.push("高評価のお客様の声をSNSやホームページで紹介し、新規集客に活用しましょう");
    if (stats.totalResponses < 50) {
      actionItems.push(`回答数${stats.totalResponses}件をさらに増やすことで、より正確なデータ分析が可能になります`);
    } else {
      actionItems.push("推奨者のお客様に紹介プログラムを案内し、口コミでの集客を強化しましょう");
    }
  } else if (stats.npsScore >= 50) {
    actionItems.push("中立者（7-8点）のお客様に対し、次回来店時にパーソナライズされた提案を行いましょう");
    actionItems.push("スタッフミーティングで高評価レビューを共有し、成功パターンを全員で実践しましょう");
  } else if (stats.npsScore >= 20) {
    actionItems.push("批判者のお客様には来店後のフォローアップ連絡を実施し、不満点を直接ヒアリングしましょう");
    actionItems.push("カテゴリ別評価の低い項目について、具体的な改善アクションプランを策定しましょう");
  } else {
    actionItems.push("全スタッフで低評価レビューを分析し、共通する問題点の洗い出しと対策を実施しましょう");
    actionItems.push("お客様アンケートの回収率を上げ、サイレントな不満を可視化しましょう");
  }

  return {
    summary,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    actionItems: actionItems.slice(0, 2),
    icon,
  };
}
