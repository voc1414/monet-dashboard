// ============================================================
// NPS 5段階クラス評価（美容室業界向け）
// ============================================================
// 日本の美容室業界ではNPS平均は -20〜-10 程度と推定される。
// 以下は美容室の文脈に合わせた5段階評価。

export const NPS_INDUSTRY_AVERAGE = -15; // 日本の美容室業界推定平均

export interface NpsClass {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

const NPS_CLASSES: { min: number; npsClass: NpsClass }[] = [
  {
    min: 70,
    npsClass: {
      label: "エクセレント",
      color: "#0E7C6B",
      bgColor: "rgba(14,124,107,0.08)",
      borderColor: "rgba(14,124,107,0.25)",
      description: "業界最高水準。圧倒的な顧客ロイヤルティ",
    },
  },
  {
    min: 50,
    npsClass: {
      label: "ハイクラス",
      color: "#2D9C8F",
      bgColor: "rgba(45,156,143,0.08)",
      borderColor: "rgba(45,156,143,0.25)",
      description: "非常に高い顧客満足度。リピーター獲得力が強い",
    },
  },
  {
    min: 20,
    npsClass: {
      label: "スタンダード",
      color: "#7D8B75",
      bgColor: "rgba(125,139,117,0.08)",
      borderColor: "rgba(125,139,117,0.25)",
      description: "業界平均を上回る良好な水準",
    },
  },
  {
    min: 0,
    npsClass: {
      label: "アベレージ",
      color: "#B8922A",
      bgColor: "rgba(229,184,92,0.08)",
      borderColor: "rgba(229,184,92,0.25)",
      description: "業界平均付近。改善の余地あり",
    },
  },
  {
    min: -Infinity,
    npsClass: {
      label: "要改善",
      color: "#C75C5C",
      bgColor: "rgba(199,92,92,0.08)",
      borderColor: "rgba(199,92,92,0.25)",
      description: "早急な顧客体験の見直しが必要",
    },
  },
];

export function getNpsClass(score: number): NpsClass {
  for (const entry of NPS_CLASSES) {
    if (score >= entry.min) return entry.npsClass;
  }
  return NPS_CLASSES[NPS_CLASSES.length - 1].npsClass;
}

export function getAllNpsClasses(): { min: number; npsClass: NpsClass }[] {
  return NPS_CLASSES;
}
