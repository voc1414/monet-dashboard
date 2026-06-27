/**
 * monet カウンセリングシート集計（サロンブレイン カウンセリングシート分析より）
 * 出典: Salon Brain https://app.salonbrain.co.jp/settings/intake-form-analysis
 * 対象: モネ全7院（福岡姪浜 / 高槻 / 堀江院2nd / 福島 / 堀江 / 土橋 / 広島）。ヨルモネは対象外。
 * 集計期間: 2026年5月（店舗一覧・スタッフ一覧と同じ＝先月）
 * 取得日: 2026-06-27（ブラウザ自動取得・分析画面の集計値を院別に読み取り合算）
 * 注意: 集計値のみ（個人情報・自由記述の本文は含まない）。
 *   複数回答の設問（頭皮のお悩み・購入場所・来店きっかけ・その他気になる点）は
 *   回答延べ数を base とし、％は延べ数に対する比率。単一回答の設問は回答者数が base。
 */

export interface CounselingOption {
  label: string;
  count: number;
  pct: number;
}

export interface CounselingQuestion {
  key: string;
  title: string;
  base: number;
  multi?: boolean;
  options: CounselingOption[];
}

export interface CounselingSummary {
  period: string;
  periodLabel: string;
  storeCount: number;
  totalRespondents: number;
  source: string;
  retrievedAt: string;
  storeBreakdown: { store: string; count: number }[];
  questions: CounselingQuestion[];
}

export const counselingSummary: CounselingSummary = {
  period: "2026-05",
  periodLabel: "2026年5月",
  storeCount: 7,
  totalRespondents: 410,
  source: "サロンブレイン カウンセリングシート分析",
  retrievedAt: "2026-06-27",
  storeBreakdown: [
    { store: "土橋院", count: 155 },
    { store: "福島院", count: 64 },
    { store: "高槻院", count: 52 },
    { store: "福岡姪浜院", count: 51 },
    { store: "堀江院2nd", count: 34 },
    { store: "広島院", count: 28 },
    { store: "堀江院", count: 26 },
  ],
  questions: [
    {
      key: "gender",
      title: "性別",
      base: 410,
      options: [
        { label: "女性", count: 407, pct: 99 },
        { label: "無回答", count: 2, pct: 0 },
        { label: "男性", count: 1, pct: 0 },
      ],
    },
    {
      key: "age",
      title: "年齢層",
      base: 410,
      options: [
        { label: "50代", count: 176, pct: 43 },
        { label: "40代", count: 122, pct: 30 },
        { label: "60代以上", count: 54, pct: 13 },
        { label: "30代", count: 43, pct: 10 },
        { label: "20代", count: 13, pct: 3 },
        { label: "10代", count: 2, pct: 0 },
      ],
    },
    {
      key: "job",
      title: "ご職業",
      base: 410,
      options: [
        { label: "会社員（一般職）", count: 113, pct: 28 },
        { label: "パート・アルバイト", count: 76, pct: 19 },
        { label: "専業主婦・主夫", count: 49, pct: 12 },
        { label: "会社員（総合職）", count: 36, pct: 9 },
        { label: "医療関係者", count: 36, pct: 9 },
        { label: "自営業・自由業", count: 23, pct: 6 },
        { label: "契約社員・派遣社員", count: 19, pct: 5 },
        { label: "経営者・役員", count: 18, pct: 4 },
        { label: "その他", count: 18, pct: 4 },
        { label: "無職", count: 10, pct: 2 },
        { label: "公務員（教職員を除く）", count: 7, pct: 2 },
        { label: "教職員", count: 4, pct: 1 },
        { label: "定年退職", count: 1, pct: 0 },
      ],
    },
    {
      key: "dayoff",
      title: "休日",
      base: 410,
      options: [
        { label: "お休み不定", count: 200, pct: 49 },
        { label: "土日休み", count: 177, pct: 43 },
        { label: "平日休み", count: 33, pct: 8 },
      ],
    },
    {
      key: "wave",
      title: "髪にうねり・クセがあるか",
      base: 406,
      options: [
        { label: "はい", count: 357, pct: 88 },
        { label: "いいえ", count: 49, pct: 12 },
      ],
    },
    {
      key: "wave_intent",
      title: "クセをおさめたいか活かしたいか",
      base: 309,
      options: [
        { label: "おさめたい", count: 184, pct: 60 },
        { label: "活かせるなら活かしたい", count: 125, pct: 40 },
      ],
    },
    {
      key: "scalp",
      title: "頭皮のお悩み",
      base: 603,
      multi: true,
      options: [
        { label: "抜け毛", count: 170, pct: 28 },
        { label: "分け目が気になる", count: 149, pct: 25 },
        { label: "該当なし", count: 78, pct: 13 },
        { label: "かゆみ", count: 65, pct: 11 },
        { label: "フケや乾燥", count: 58, pct: 10 },
        { label: "カラーが沁みやすい", count: 56, pct: 9 },
        { label: "油っぽい", count: 27, pct: 4 },
      ],
    },
    {
      key: "treatment_freq",
      title: "定期的にサロンでトリートメントをするか",
      base: 406,
      options: [
        { label: "している", count: 177, pct: 44 },
        { label: "たまにする", count: 165, pct: 41 },
        { label: "しない", count: 64, pct: 16 },
      ],
    },
    {
      key: "treatment_effect",
      title: "トリートメントの変化実感",
      base: 406,
      options: [
        { label: "その時だけ感じた", count: 204, pct: 50 },
        { label: "やや感じた", count: 121, pct: 30 },
        { label: "続けることで変化を感じた", count: 50, pct: 12 },
        { label: "感じなかった", count: 31, pct: 8 },
      ],
    },
    {
      key: "color_freq",
      title: "カラーの頻度",
      base: 406,
      options: [
        { label: "２〜３ヶ月に一度", count: 188, pct: 46 },
        { label: "月に一度", count: 141, pct: 35 },
        { label: "しない", count: 32, pct: 8 },
        { label: "その他", count: 26, pct: 6 },
        { label: "半年に一度", count: 19, pct: 5 },
      ],
    },
    {
      key: "straight",
      title: "ストレート施術の経験",
      base: 406,
      options: [
        { label: "ある", count: 198, pct: 49 },
        { label: "ない", count: 178, pct: 44 },
        { label: "定期的に当てている", count: 30, pct: 7 },
      ],
    },
    {
      key: "purchase",
      title: "シャンプー・トリートメントの購入場所",
      base: 480,
      multi: true,
      options: [
        { label: "ドラッグストア", count: 176, pct: 37 },
        { label: "インターネット", count: 165, pct: 34 },
        { label: "美容室", count: 101, pct: 21 },
        { label: "その他", count: 20, pct: 4 },
        { label: "百貨店", count: 18, pct: 4 },
      ],
    },
    {
      key: "channel",
      title: "来店のきっかけ",
      base: 444,
      multi: true,
      options: [
        { label: "Instagram広告", count: 201, pct: 45 },
        { label: "ホットペッパー", count: 104, pct: 23 },
        { label: "Instagram", count: 94, pct: 21 },
        { label: "紹介", count: 35, pct: 8 },
        { label: "Google", count: 6, pct: 1 },
        { label: "通りすがり", count: 4, pct: 1 },
      ],
    },
  ],
};
