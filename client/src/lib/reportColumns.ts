/*
 * 月末報告書（Google フォーム → スプレッドシート）の列解決。
 *
 * これまでは useMonthlyReport.ts が列番号を直書きしていた（COL = { TECH_SALES: 11, ... }）。
 * フォームの設問を1つ増減すると以降の列が全部ズレ、型も見た目も壊れないまま
 * 数字だけが静かに間違う。実際に「写真」→「ニックネーム」の差し替えが起きている。
 *
 * ここではヘッダ行の**設問名**から列を実行時に解決する。見つからない列は
 * 黙って 0 として集計せず、呼び出し側に issue として返す（データ点検パネルに出る）。
 *
 * ★ 列19・20 のヘッダは実スプレッドシートでは今も空欄（2026-09-12 実測）。
 *   ニックネーム設問は追加されているのにヘッダに設問名が出ないため、
 *   ニックネーム列だけは名前で引けない。名前で引けなかったときに限り、
 *   ヘッダが空の列の**中身**から特定する（写真列＝URL、ニックネーム列＝それ以外）。
 */

export type ReportColumnKey =
  | "lineUserId"
  | "answerId"
  | "answerDate"
  | "answererId"
  | "lineName"
  | "systemName"
  | "name"
  | "store"
  | "employmentType"
  | "behaviorCheck"
  | "ruleCheck"
  | "techSales"
  | "retailSales"
  | "newCustomers"
  | "returnCustomers"
  | "nextReservation"
  | "reviewComment"
  | "npsComment"
  | "fankuruComment"
  | "nickname";

export interface ReportColumnIssue {
  /** error = 集計を止める（数字が壊れるより出さない方がまし）。warning = 一部欠ける。info = 参考。 */
  severity: "error" | "warning" | "info";
  key: ReportColumnKey;
  /** 人が読むための列の呼び名 */
  label: string;
  message: string;
}

export interface ReportColumnMap {
  /** 見つからなかった列は -1 */
  index: Record<ReportColumnKey, number>;
  issues: ReportColumnIssue[];
  /** 必須列がすべて解決できたか。false なら集計してはいけない。 */
  ok: boolean;
  /** 必須列のうち一番右の位置。行の長さチェックに使う。 */
  maxRequiredIndex: number;
}

interface Spec {
  key: ReportColumnKey;
  label: string;
  /** これが欠けると売上・客数が壊れるので集計自体を止める */
  required: boolean;
  /** 正規化後のヘッダに含まれていれば一致とみなす語（前から順に試す） */
  patterns: string[];
}

/**
 * ヘッダ文字列の正規化。
 * 全半角・大小・空白・記号のゆれを吸収する（"先月の技術売上 [税込]" → "先月の技術売上税込"）。
 */
export function normalizeHeader(raw: string): string {
  return (raw || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　]/g, "")
    .replace(/[[\]()（）【】「」『』"'’”]/g, "");
}

/** 列の仕様。順序はスプレッドシートの並びに合わせてあるが、解決は名前で行う。 */
const SPECS: Spec[] = [
  { key: "lineUserId", label: "LINE ユーザーID", required: false, patterns: ["lineユーザーid"] },
  { key: "answerId", label: "回答ID", required: false, patterns: ["回答id"] },
  { key: "answerDate", label: "回答日時", required: true, patterns: ["回答日時"] },
  { key: "answererId", label: "回答者ID", required: false, patterns: ["回答者id"] },
  { key: "lineName", label: "LINE名", required: false, patterns: ["line名"] },
  { key: "systemName", label: "システム表示名", required: false, patterns: ["システム表示名"] },
  { key: "name", label: "氏名", required: true, patterns: ["氏名"] },
  { key: "store", label: "所属店舗", required: true, patterns: ["所属店舗", "店舗"] },
  { key: "employmentType", label: "雇用形態", required: false, patterns: ["雇用形態"] },
  { key: "behaviorCheck", label: "行動指標", required: false, patterns: ["行動指標"] },
  { key: "ruleCheck", label: "ルール", required: false, patterns: ["ルールを守れ"] },
  { key: "techSales", label: "技術売上", required: true, patterns: ["技術売上"] },
  { key: "retailSales", label: "店販売上", required: true, patterns: ["店販売上"] },
  { key: "newCustomers", label: "新規客数", required: true, patterns: ["新規客数"] },
  { key: "returnCustomers", label: "再来顧客数", required: true, patterns: ["再来顧客数", "再来客数"] },
  { key: "nextReservation", label: "次回予約取得数", required: true, patterns: ["次回予約取得数", "次回予約"] },
  { key: "reviewComment", label: "口コミの感想", required: false, patterns: ["口コミ"] },
  { key: "npsComment", label: "NPSスコアの感想", required: false, patterns: ["nps"] },
  { key: "fankuruComment", label: "ファンくるの感想", required: false, patterns: ["ファンくる"] },
  // ニックネームは設問名がヘッダに出ていない（2026-09-12 実測で列20 のヘッダは空欄）。
  // 名前で引けたらそれを使い、引けなければ中身から特定する。
  { key: "nickname", label: "ニックネーム", required: false, patterns: ["ニックネーム", "呼び名", "呼名"] },
];

const ALL_KEYS = SPECS.map((s) => s.key);

function emptyIndex(): Record<ReportColumnKey, number> {
  const idx = {} as Record<ReportColumnKey, number>;
  for (const k of ALL_KEYS) idx[k] = -1;
  return idx;
}

/** 写真列の値かどうか（URLなら写真）。ニックネーム列の判定に使う。 */
export function looksLikeUrl(v: string): boolean {
  return /^https?:\/\//i.test((v || "").trim());
}

/** ニックネーム列に入っていておかしくない値か（URLでない・改行なし・短い） */
export function looksLikeNickname(v: string): boolean {
  const s = (v || "").trim();
  if (!s) return false;
  if (looksLikeUrl(s)) return false;
  if (/[\r\n]/.test(s)) return false;
  return s.length <= NICKNAME_MAX_LEN;
}

/**
 * 呼び名として長すぎる値は自由記述とみなす。
 * 2026-09-12 実測: 実データのニックネーム31件はすべて 1〜6 文字。
 */
const NICKNAME_MAX_LEN = 20;
/** これ未満しか無い列は「たまたま非URLが混ざった写真列」とみなして候補にしない */
const NICKNAME_MIN_COUNT = 3;

/**
 * ヘッダが空の列のうち、ニックネームが入っていそうな列の候補を挙げる（多い順）。
 *
 * 写真列は値が全部 URL なので 0 件になり候補から外れる。ニックネーム列は「写真」設問を
 * 差し替えたものなので過去行に写真URLが残っているが（2026-09-12 実測: 列20 は 185件中
 * URL 154・ニックネーム 31）、呼び名らしい値が NICKNAME_MIN_COUNT 件以上あれば候補になる。
 *
 * 候補が2つ以上出たときは中身だけでは決められないので、呼び出し側で警告を出す。
 */
export function nicknameColumnCandidates(
  header: string[],
  dataRows: string[][],
): { index: number; score: number }[] {
  const out: { index: number; score: number }[] = [];
  for (let c = 0; c < header.length; c++) {
    if (normalizeHeader(header[c])) continue; // ヘッダに名前がある列は対象外
    let score = 0;
    for (const r of dataRows) {
      if (looksLikeNickname(r[c] || "")) score++;
    }
    if (score >= NICKNAME_MIN_COUNT) out.push({ index: c, score });
  }
  out.sort((a, b) => b.score - a.score || a.index - b.index);
  return out;
}

/** 候補のうち最有力の列。候補が無ければ -1。 */
export function findNicknameColumnByContent(header: string[], dataRows: string[][]): number {
  const cands = nicknameColumnCandidates(header, dataRows);
  return cands.length > 0 ? cands[0].index : -1;
}

/**
 * ヘッダ行から列インデックスを解決する。
 * dataRows を渡すと、名前で引けなかったニックネーム列を中身から特定する。
 */
export function resolveReportColumns(header: string[], dataRows: string[][] = []): ReportColumnMap {
  const norm = header.map(normalizeHeader);
  const index = emptyIndex();
  const issues: ReportColumnIssue[] = [];
  const taken = new Set<number>();

  for (const spec of SPECS) {
    let hit = -1;
    let dupes: number[] = [];
    for (const p of spec.patterns) {
      const found: number[] = [];
      for (let c = 0; c < norm.length; c++) {
        if (!norm[c]) continue;
        if (taken.has(c)) continue;
        if (norm[c].includes(p)) found.push(c);
      }
      if (found.length > 0) {
        hit = found[0];
        dupes = found;
        break;
      }
    }
    if (hit >= 0) {
      index[spec.key] = hit;
      taken.add(hit);
      if (dupes.length > 1) {
        const list = dupes.map((c) => `${c + 1}列目「${header[c]}」`).join(" / ");
        // 設問が増えるときに一番起きやすいのが「既存の設問名を含む新しい設問」
        // （例:「先月の技術売上の内訳を教えてください」）。左端を黙って使うと
        // 自由記述を売上として読み parseNumber が 0 を返し、全員 ¥0 になる。
        // 必須列でこれが起きたら、どれが本物か決められない＝集計してはいけない。
        issues.push({
          severity: spec.required ? "error" : "warning",
          key: spec.key,
          label: spec.label,
          message: spec.required
            ? `月末報告書で「${spec.label}」に一致する列が ${dupes.length} 列あります（${list}）。どれが本物か決められないため、集計を止めています。似た設問名の設問が増えていないか確認してください。`
            : `「${spec.label}」に一致する列が ${dupes.length} 列あります（${list}）。左端を使いました。`,
        });
      }
      continue;
    }
    if (spec.required) {
      issues.push({
        severity: "error",
        key: spec.key,
        label: spec.label,
        message: `月末報告書に「${spec.label}」の列が見つかりません。設問名が変わったか、設問が消えています。値が欠けたまま集計すると売上や客数が静かに間違うため、集計を止めています。`,
      });
    } else if (spec.key !== "nickname") {
      issues.push({
        severity: "warning",
        key: spec.key,
        label: spec.label,
        message: `月末報告書に「${spec.label}」の列が見つかりません。この項目は空欄として扱います（集計値には影響しません）。`,
      });
    }
  }

  // ニックネーム: 名前で引けなければ中身から特定する
  if (index.nickname < 0) {
    const cands = nicknameColumnCandidates(header, dataRows);
    const byContent = cands.length > 0 ? cands[0].index : -1;
    if (byContent >= 0) {
      index.nickname = byContent;
      if (cands.length > 1) {
        // ヘッダが空の列が複数あり、どれも呼び名に見える。中身だけでは決められないので
        // 黙って選ばず警告に出す（長い自由記述が呼び名として全画面に出るのを防ぐ）。
        issues.push({
          severity: "warning",
          key: "nickname",
          label: "ニックネーム",
          message: `ヘッダが空欄の列が ${cands.length} 列あり、どれもニックネームに見えます（${cands
            .map((c) => `${c.index + 1}列目=${c.score}件`)
            .join(" / ")}）。件数が最も多い ${byContent + 1}列目 を使いましたが、呼び名の表示が正しいか確認してください。`,
        });
      } else {
        issues.push({
          severity: "info",
          key: "nickname",
          label: "ニックネーム",
          message: `ニックネーム列はヘッダが空欄のため、中身から ${byContent + 1}列目 と判定しました（設問名がヘッダに出るようになれば名前で解決します）。`,
        });
      }
    } else {
      issues.push({
        severity: "warning",
        key: "nickname",
        label: "ニックネーム",
        message: "月末報告書からニックネーム列を特定できません。呼び名は Notion の値か氏名で表示されます。",
      });
    }
  }

  const ok = !issues.some((i) => i.severity === "error");
  let maxRequiredIndex = -1;
  for (const spec of SPECS) {
    if (spec.required && index[spec.key] > maxRequiredIndex) maxRequiredIndex = index[spec.key];
  }

  return { index, issues, ok, maxRequiredIndex };
}

/** 解決できていない列は空文字を返す（undefined を各所で気にしないで済むように） */
export function cellOf(row: string[], index: Record<ReportColumnKey, number>, key: ReportColumnKey): string {
  const c = index[key];
  if (c < 0) return "";
  return row[c] ?? "";
}
