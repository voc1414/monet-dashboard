// ============================================================
// NPS 総合アドバイスコメント生成ロジック
// ============================================================
// monetマニュアルの価値観・行動指標・接客基準に基づき、
// 各店舗のNPSデータを総合分析してアドバイスを生成する。
//
// 【monetの核心的価値観】
// - 「五感を満たす唯一無二の美容室」
// - ハイエンド層がターゲット
// - NPS = 「感動したかどうか」を評価する指標
// - 5つの行動指標（ブランドマインド/monetとしての視点/ハイエンド対応/チームの気遣い/空間創り）
// - 4段階の価値提供（基本的→期待的→願望的→予想外価値）
// - VIP客重視（売上の80%はVIP客20%から）
// ============================================================

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
// monetの価値観に沿った「感動」「五感」「予想外価値」関連のキーワードを重視
const POSITIVE_KEYWORDS = [
  "感動", "満足", "癒", "リラックス", "居心地", "安心", "信頼",
  "気持ち良", "清潔", "快適", "丁寧", "素敵", "最高", "嬉しい",
  "綺麗", "おすすめ", "また来", "上手", "完璧", "理想", "気に入",
  "香り", "空間", "雰囲気", "特別", "贅沢",
];

const NEGATIVE_KEYWORDS = [
  "残念", "不満", "改善", "高い", "待ち時間", "長い", "微妙", "期待外れ",
  "雑", "不安", "痛", "ムラ", "合わな", "違う", "もう少し", "気になる",
  "狭", "汚", "臭",
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

// monetの「4段階の価値提供」に基づいた分析
function analyzeValueDelivery(stats: StoreStats, records: NpsRecord[]): {
  level: 1 | 2 | 3 | 4;
  description: string;
} {
  // 推奨者率と平均スコアから、どの段階の価値提供ができているか判定
  if (stats.npsScore >= 70 && stats.avgScore >= 9.0) {
    return {
      level: 4,
      description: "「予想外価値」の提供に成功しています。お客様が想像していなかった感動体験を届けられています",
    };
  } else if (stats.npsScore >= 50 && stats.avgScore >= 8.5) {
    return {
      level: 3,
      description: "「願望的価値」まで安定して提供できています。ブランケット確認やドリンク提供など、きめ細かな配慮が伝わっています",
    };
  } else if (stats.npsScore >= 20) {
    return {
      level: 2,
      description: "「期待的価値」は満たせていますが、「願望的価値」の提供にばらつきがあります。お客様への声かけ（空調・お手洗い確認など）を徹底しましょう",
    };
  } else {
    return {
      level: 1,
      description: "「基本的価値」の見直しが必要です。敬語・挨拶・笑顔など、接客の基本を全スタッフで再確認しましょう",
    };
  }
}

export function generateStoreAdvice(
  stats: StoreStats,
  records: NpsRecord[]
): NpsAdvice {
  const categories = analyzeCategoryData(records);
  const sentiment = analyzeReviewSentiment(records);
  const valueDelivery = analyzeValueDelivery(stats, records);

  const strengths: string[] = [];
  const improvements: string[] = [];
  const actionItems: string[] = [];
  let summary = "";
  let icon: NpsAdvice["icon"] = "target";

  // --- 総合評価サマリー（monetの価値観に基づく） ---
  if (stats.npsScore >= 70) {
    summary = `NPS +${stats.npsScore}。monetが目指す「五感を満たす感動体験」が高い水準で実現できています。推奨者率${stats.promoterPct}%は、お客様がmonetのブランド価値を深く実感している証です。この水準を全店の基準として共有し、さらなる「予想外価値」の創出を目指しましょう。`;
    icon = "trophy";
  } else if (stats.npsScore >= 50) {
    summary = `NPS +${stats.npsScore}。多くのお客様に満足いただけていますが、monetが掲げる「感動」にはあと一歩です。中立者（7-8点）のお客様は「満足はしたが感動には至らなかった」層です。monetの4段階の価値提供のうち「予想外価値」を意識し、一人ひとりに合わせた特別な体験を届けましょう。`;
    icon = "thumbsUp";
  } else if (stats.npsScore >= 20) {
    summary = `NPS +${stats.npsScore}。業界平均は上回っていますが、monetのブランド基準からすると改善の余地があります。「monetとしての正解は何か？」という行動指標に立ち返り、接客・空間・仕上がりの各面でコンセプトに沿ったサービスを再確認しましょう。`;
    icon = "target";
  } else if (stats.npsScore >= 0) {
    summary = `NPS +${stats.npsScore}。monetの目指す顧客体験との間にギャップがあります。批判者率${stats.detractorPct}%の改善が急務です。マニュアルの「基本的価値」「期待的価値」が確実に提供できているか、チーム全体で振り返りを行いましょう。`;
    icon = "alertTriangle";
  } else {
    summary = `NPS ${stats.npsScore}。monetのブランド基準を大きく下回っており、早急な対応が必要です。まずはマニュアルに立ち返り、5つの行動指標（ブランドマインド・monetとしての視点・ハイエンド対応・チームの気遣い・空間創り）を全スタッフで再確認してください。`;
    icon = "alertCircle";
  }

  // --- 強みの分析（monetの価値観に紐づけ） ---
  if (stats.promoterPct >= 80) {
    strengths.push(
      `推奨者率${stats.promoterPct}%。お客様の大多数が「感動した」と回答しており、monetの「予想外価値」の提供が定着しています。VIP客の育成にも好影響が期待できます`
    );
  } else if (stats.promoterPct >= 60) {
    strengths.push(
      `推奨者率${stats.promoterPct}%。多くのお客様がmonetの体験に満足しています。紹介特典を活用した口コミ集客の基盤が整っています`
    );
  }

  if (stats.detractorPct === 0) {
    strengths.push(
      "批判者がゼロです。全てのお客様に「基本的価値」「期待的価値」が確実に届いており、マニュアルの徹底度が高い状態です"
    );
  } else if (stats.detractorPct <= 5) {
    strengths.push(
      `批判者率${stats.detractorPct}%と低水準。ハイエンド層のお客様にも安定したサービス品質を提供できています`
    );
  }

  if (stats.avgScore >= 9.0) {
    strengths.push(
      `平均スコア${stats.avgScore}。一貫して高い満足度を維持しており、monetの「五感を満たす」コンセプトが体現されています`
    );
  } else if (stats.avgScore >= 8.5) {
    strengths.push(
      `平均スコア${stats.avgScore}。安定したサービス品質で、お客様の期待に応えられています`
    );
  }

  // カテゴリ別の強み（monetの5つの行動指標に紐づけ）
  if (categories.space.topItems.length > 0 && categories.space.topItems[0].pct >= 40) {
    const spaceTop = categories.space.topItems[0];
    if (!spaceTop.name.includes("普通") && !spaceTop.name.includes("狭") && !spaceTop.name.includes("汚")) {
      if (strengths.length < 3) {
        strengths.push(
          `空間面で「${spaceTop.name}」が${spaceTop.pct}%。行動指標5「ブランドに適した空間創り・クリンネス」が実践されています`
        );
      }
    }
  }

  if (categories.staff.topItems.length > 0 && categories.staff.topItems[0].pct >= 40) {
    const staffTop = categories.staff.topItems[0];
    if (!staffTop.name.includes("普通") && !staffTop.name.includes("不満")) {
      if (strengths.length < 3) {
        strengths.push(
          `スタッフ面で「${staffTop.name}」が${staffTop.pct}%。行動指標3「ハイエンド層への言葉遣い・立ち振る舞い」が高く評価されています`
        );
      }
    }
  }

  if (categories.finish.topItems.length > 0 && categories.finish.topItems[0].pct >= 40) {
    const finishTop = categories.finish.topItems[0];
    if (!finishTop.name.includes("普通") && !finishTop.name.includes("不満")) {
      if (strengths.length < 3) {
        strengths.push(
          `仕上がり面で「${finishTop.name}」が${finishTop.pct}%。髪質改善の技術力がお客様に伝わっています`
        );
      }
    }
  }

  // レビューの強み（monetの「感動」キーワードを重視）
  if (sentiment.positiveThemes.length > 0 && strengths.length < 3) {
    const hasKando = sentiment.positiveThemes.includes("感動");
    const hasIyashi = sentiment.positiveThemes.some((t) => ["癒", "リラックス", "気持ち良"].includes(t));
    if (hasKando) {
      strengths.push(
        `レビューに「感動」の声が多数。NPSが測る「感動したかどうか」において、お客様の心に響くサービスが提供できています`
      );
    } else if (hasIyashi) {
      strengths.push(
        `レビューで「${sentiment.positiveThemes.join("」「")}」など五感に響く体験への評価が高く、monetのコンセプトが伝わっています`
      );
    } else {
      strengths.push(
        `レビューでは「${sentiment.positiveThemes.join("」「")}」などポジティブな声が多く、サービスの方向性は正しいと言えます`
      );
    }
  }

  // --- 改善提案（monetの価値提供フレームワークに基づく） ---

  // 価値提供レベルに基づく改善
  if (valueDelivery.level <= 2) {
    improvements.push(valueDelivery.description);
  }

  // 中立者対策（monetの「予想外価値」で転換）
  if (stats.passivePct >= 30) {
    improvements.push(
      `中立者（7-8点）が${stats.passivePct}%。「満足」と「感動」の差は紙一重です。カウンセリングで半年〜1年後の未来を想像しながらお話しし、施術中の技術説明や仕上がり時の感動演出で「予想外価値」を届けましょう`
    );
  } else if (stats.passivePct >= 15) {
    improvements.push(
      `中立者が${stats.passivePct}%。感動タイミングでの技術おさらいや、次回メニューの具体的な提案など、カウンセリングの質を高めることで推奨者への転換が期待できます`
    );
  }

  // 批判者対策
  if (stats.detractorPct >= 10) {
    improvements.push(
      `批判者率${stats.detractorPct}%は、monetの基準では看過できない水準です。低評価のお客様の声を一件ずつ確認し、「基本的価値」「期待的価値」の提供に漏れがないか検証してください`
    );
  } else if (stats.detractorPct >= 3) {
    improvements.push(
      `批判者率${stats.detractorPct}%。ゼロを目指すために、低評価の原因を特定しましょう。マニュアルの接客基準（笑顔・傾聴・提案）が全スタッフに浸透しているか確認が必要です`
    );
  }

  // カテゴリ別の改善（monetの行動指標に紐づけ）
  const spaceLowItems = categories.space.topItems.filter((item) =>
    item.name.includes("普通") || item.name.includes("狭") || item.name.includes("汚") || item.name.includes("気になる")
  );
  if (spaceLowItems.length > 0 && improvements.length < 3) {
    improvements.push(
      `空間面で「${spaceLowItems[0].name}」の声が${spaceLowItems[0].pct}%。ハイエンド層は空間の細部でお店のこだわりを見抜きます。クリンネスの徹底（セット面・入り口・通路・トイレ）を再確認しましょう`
    );
  }

  const priceLowItems = categories.price.topItems.filter((item) =>
    item.name.includes("高い") || item.name.includes("不満") || item.name.includes("微妙")
  );
  if (priceLowItems.length > 0 && improvements.length < 3) {
    improvements.push(
      `金額面で「${priceLowItems[0].name}」の声が${priceLowItems[0].pct}%。monetのターゲット層は「お得感より総合的な価値で判断する」方々です。価格以上の価値を感じていただけるよう、施術中の技術説明やアフターケアの充実を図りましょう`
    );
  }

  // レビューのネガティブテーマ
  if (sentiment.negativeThemes.length > 0 && improvements.length < 3) {
    improvements.push(
      `レビューで「${sentiment.negativeThemes.join("」「")}」の声があります。monetでは「どうすれば解決できるか？」を考える姿勢が大切です。チームで具体的な改善策を話し合いましょう`
    );
  }

  // 改善がない場合の補足
  if (improvements.length === 0) {
    improvements.push(
      "現在の高い水準を維持するため、マニュアルの定期的な振り返りとスタッフ間でのベストプラクティス共有を継続しましょう。「monetとしての正解は何か？」を常に意識することが大切です"
    );
  }

  // --- 具体的アクション（monetのマニュアルに基づく） ---
  if (stats.npsScore >= 70) {
    actionItems.push(
      "高評価のお客様はVIP客候補です。次回予約の確実な獲得と、来店周期を安定させるカウンセリングを通じて、VIP客へと育成していきましょう。リピートが定着したお客様には紹介のお声がけも効果的です"
    );
    if (stats.totalResponses < 50) {
      actionItems.push(
        `回答数${stats.totalResponses}件。より正確な分析のため、来店されたお客様全員へのNPSアンケート送信を徹底しましょう`
      );
    } else {
      actionItems.push(
        "この水準を全店の目標として共有し、成功しているカウンセリング手法や接客パターンを他店舗にも展開しましょう"
      );
    }
  } else if (stats.npsScore >= 50) {
    actionItems.push(
      "中立者のお客様に対し、次回来店時のカウンセリングで「1番目と2番目の悩み」を丁寧に引き出し、半年後の理想の姿を一緒にイメージしましょう"
    );
    actionItems.push(
      "スタッフミーティングで高評価レビューを共有し、「どの瞬間にお客様が感動したか」を分析して全員で実践しましょう"
    );
  } else if (stats.npsScore >= 20) {
    actionItems.push(
      "マニュアルの接客基準を全スタッフで再確認しましょう。特に「笑顔で警戒心を下げる」「目を見て傾聴する」「感情を込めて提案する」の3ステップの徹底が重要です"
    );
    actionItems.push(
      "批判者のお客様には来店後のフォローアップを実施し、「monetとして」何が足りなかったかを具体的にヒアリングしましょう"
    );
  } else {
    actionItems.push(
      "5つの行動指標（ブランドマインド・monetとしての視点・ハイエンド対応・チームの気遣い・空間創り）を全スタッフで再確認し、各自の課題を明確にしましょう"
    );
    actionItems.push(
      "低評価レビューを一件ずつチームで分析し、4段階の価値提供（基本的→期待的→願望的→予想外）のどこに問題があるかを特定しましょう"
    );
  }

  return {
    summary,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    actionItems: actionItems.slice(0, 2),
    icon,
  };
}
