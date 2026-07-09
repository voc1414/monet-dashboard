/**
 * カウンセリングシート集計の「設問・選択肢タクソノミー」（日本語ラベルの正本）。
 *
 * 集計の数値（件数・％・base）は Google スプレッドシート「サロンボード売上」の
 * counseling タブから gviz で取得する（client/src/hooks/useCounselingData.ts）。
 * シート側は ASCII の q_key / opt_key だけを持ち、表示用の日本語はここで対応づける。
 * （日本語をシートに直接書くと自動入力で文字落ちが起きるため、キー方式に分離している）
 *
 * 新しい選択肢がサロンブレイン側に増えた場合は、対応する q_key の options に
 * { key, label } を追記する。ここに無い opt_key はラベルにキーをそのまま表示する。
 */

export interface TaxOption {
  key: string;
  label: string;
}
export interface TaxQuestion {
  key: string;
  title: string;
  multi: boolean;
  options: TaxOption[];
}

export const COUNSELING_TAXONOMY: TaxQuestion[] = [
  { key: "gender", title: "性別", multi: false, options: [{ key: "female", label: "女性" }, { key: "noanswer", label: "無回答" }, { key: "male", label: "男性" }] },
  { key: "age", title: "年齢層", multi: false, options: [{ key: "a10s", label: "10代" }, { key: "a20s", label: "20代" }, { key: "a30s", label: "30代" }, { key: "a40s", label: "40代" }, { key: "a50s", label: "50代" }, { key: "a60plus", label: "60代以上" }] },
  { key: "job", title: "ご職業", multi: false, options: [{ key: "emp_reg", label: "会社員（一般職）" }, { key: "parttime", label: "パート・アルバイト" }, { key: "homemaker", label: "専業主婦・主夫" }, { key: "emp_career", label: "会社員（総合職）" }, { key: "medical", label: "医療関係者" }, { key: "selfemp", label: "自営業・自由業" }, { key: "contract", label: "契約社員・派遣社員" }, { key: "exec", label: "経営者・役員" }, { key: "civil", label: "公務員（教職員を除く）" }, { key: "teacher", label: "教職員" }, { key: "unemployed", label: "無職" }, { key: "retired", label: "定年退職" }, { key: "other", label: "その他" }] },
  { key: "dayoff", title: "休日", multi: false, options: [{ key: "irregular", label: "お休み不定" }, { key: "weekend", label: "土日休み" }, { key: "weekday", label: "平日休み" }] },
  { key: "wave", title: "髪にうねり・クセがあるか", multi: false, options: [{ key: "yes", label: "はい" }, { key: "no", label: "いいえ" }] },
  { key: "wave_intent", title: "クセをおさめたいか活かしたいか", multi: false, options: [{ key: "tame", label: "おさめたい" }, { key: "keep", label: "活かせるなら活かしたい" }] },
  { key: "hair_concern", title: "髪のお悩み（その他気になること）", multi: true, options: [{ key: "dry", label: "パサつき" }, { key: "puff", label: "表面の毛がぱやぱや・もやもや" }, { key: "noshine", label: "艶がない" }, { key: "spread", label: "広がりが気になる" }, { key: "manage", label: "収まりを良くしたい" }, { key: "colorlast", label: "色もちをよくしたい" }, { key: "aging", label: "年齢とともに扱いにくい" }, { key: "nobody", label: "ハリコシがない" }, { key: "many", label: "毛が多い" }, { key: "thick", label: "毛が太い" }, { key: "none", label: "該当なし" }] },
  { key: "scalp", title: "頭皮のお悩み", multi: true, options: [{ key: "hairloss", label: "抜け毛" }, { key: "parting", label: "分け目が気になる" }, { key: "itch", label: "かゆみ" }, { key: "dry", label: "フケや乾燥" }, { key: "colorsting", label: "カラーが沁みやすい" }, { key: "oily", label: "油っぽい" }, { key: "none", label: "該当なし" }] },
  { key: "treatment_freq", title: "定期的にサロンでトリートメントをするか", multi: false, options: [{ key: "regular", label: "している" }, { key: "sometimes", label: "たまにする" }, { key: "never", label: "しない" }] },
  { key: "treatment_effect", title: "トリートメントの変化実感", multi: false, options: [{ key: "lasting", label: "続けることで変化を感じた" }, { key: "slight", label: "やや感じた" }, { key: "temporary", label: "その時だけ感じた" }, { key: "none", label: "感じなかった" }] },
  { key: "color_freq", title: "カラーの頻度", multi: false, options: [{ key: "monthly", label: "月に一度" }, { key: "q2_3m", label: "２〜３ヶ月に一度" }, { key: "half_year", label: "半年に一度" }, { key: "never", label: "しない" }, { key: "other", label: "その他" }] },
  { key: "straight", title: "ストレート施術の経験", multi: false, options: [{ key: "yes", label: "ある" }, { key: "regular", label: "定期的に当てている" }, { key: "no", label: "ない" }] },
  { key: "straight_feedback", title: "ストレートの感想（定期的に当てている方）", multi: false, options: [{ key: "good", label: "よかった" }, { key: "damage", label: "ダメージが気になる" }, { key: "toostiff", label: "ピンピンになりすぎた" }, { key: "notenough", label: "癖があまり伸びなかった" }] },
  { key: "purchase", title: "シャンプー・トリートメントの購入場所", multi: true, options: [{ key: "drugstore", label: "ドラッグストア" }, { key: "internet", label: "インターネット" }, { key: "salon", label: "美容室" }, { key: "depart", label: "百貨店" }, { key: "other", label: "その他" }] },
  { key: "channel", title: "来店のきっかけ", multi: true, options: [{ key: "ig_ad", label: "Instagram広告" }, { key: "ig", label: "Instagram" }, { key: "hpb", label: "ホットペッパー" }, { key: "google", label: "Google" }, { key: "referral", label: "紹介" }, { key: "walkby", label: "通りすがり" }, { key: "tiktok", label: "TikTok" }] },
];

export function questionTitle(qKey: string): string {
  return COUNSELING_TAXONOMY.find((q) => q.key === qKey)?.title ?? qKey;
}
export function optionLabel(qKey: string, optKey: string): string {
  const q = COUNSELING_TAXONOMY.find((x) => x.key === qKey);
  return q?.options.find((o) => o.key === optKey)?.label ?? optKey;
}
