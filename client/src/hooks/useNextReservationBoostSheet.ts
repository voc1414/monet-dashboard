/*
 * 次回予約強化シート（L Message フォーム 244191 の回答）を読む。管理者ビルドだけが使う。
 * 共有設定は「リンクを知っている全員：閲覧者」（2026-10-03）。他のシートと同じく匿名CSV読み。
 * 列の解決・テスト回答の除外は lib/nextReservationBoost.ts。
 */
import { useEffect, useState } from "react";
import { normalizeStoreName, parseCSV } from "@/hooks/useMonthlyReport";
import { parseBoostAnswers, type BoostAnswer, type BoostColumnMap } from "@/lib/nextReservationBoost";

const SPREADSHEET_ID = "1CZPTmFDfKiEvwYw-FvIeNS9BiCjnFUP883zKeY24NXU";
const GID = "355423816";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

/**
 * 開発サーバだけの確認用: URL に ?boostSample=1 を付けると client/dev-sample/ のテスト用CSVを読む。
 * そのCSVには実在スタッフの名前が入るので git に入れない（.gitignore 済み・repo は public）。
 * import.meta.env.DEV は本番ビルドで false に置き換わり、この分岐ごとバンドルから消える。
 */
async function loadCsvText(): Promise<string> {
  const url =
    import.meta.env.DEV && new URLSearchParams(window.location.search).has("boostSample")
      ? `${import.meta.env.BASE_URL}dev-sample/next-reservation-boost.csv`
      : CSV_URL;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

export function useNextReservationBoostSheet() {
  const [answers, setAnswers] = useState<BoostAnswer[]>([]);
  const [columns, setColumns] = useState<BoostColumnMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = parseCSV(await loadCsvText());
        const parsed = parseBoostAnswers(rows, normalizeStoreName);
        if (!cancelled) {
          setAnswers(parsed.answers);
          setColumns(parsed.columns);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "強化シートの取得に失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { answers, columns, loading, error };
}
