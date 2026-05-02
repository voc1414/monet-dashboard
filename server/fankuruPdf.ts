import { PDFParse } from "pdf-parse";

/**
 * ファンくるPDFからお客様コメントを抽出する
 * 主にQ47「スタイリストへの応援メッセージ」を抽出
 */

export interface FankuruComment {
  driveFileId: string;
  stylist: string;
  date: string;
  store: string;
  comment: string; // Q47: スタイリストへの応援メッセージ
  recommendReason?: string; // Q10: 紹介理由
  csScore?: string; // ファンくるCSスコア
}

/**
 * Google DriveからPDFをダウンロードしてバッファを返す
 */
async function downloadPdfFromDrive(driveFileId: string): Promise<Buffer> {
  const url = `https://drive.google.com/uc?export=download&id=${driveFileId}`;
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * PDFテキストからQ47（スタイリストへの応援メッセージ）を抽出
 */
function extractQ47Comment(text: string): string {
  // Q47の質問文の後に続く回答を抽出
  // パターン: "47 スタイリストへの応援メッセージをお願いします。（良かった部分を中心にお伝えください）" の後の回答
  const patterns = [
    /47\s*スタイリストへの応援メッセージをお願いします。[^)]*\)\s*\n?([\s\S]*?)(?=\n\s*48\s)/,
    /スタイリストへの応援メッセージ[^)]*\)\s*\n?([\s\S]*?)(?=\n\s*48\s|\nスタッフの身だしなみ)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const comment = match[1].trim().replace(/\s+/g, " ");
      if (comment.length > 0 && comment !== "特になし") {
        return comment;
      }
    }
  }
  return "";
}

/**
 * PDFテキストからQ10（紹介理由）を抽出
 */
function extractQ10Comment(text: string): string {
  const patterns = [
    /10\s*点を選んだ方は、100点に届かなかった理由をご記入[^。]*。100点を選んだ方は、満点の理由をご記入[^。]*。\s*\n?([\s\S]*?)(?=\n\s*(?:【再来店】|11\s))/,
    /100点に届かなかった理由.*?満点の理由.*?ださい。\s*\n?([\s\S]*?)(?=\n\s*(?:【再来店】|11\s))/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const comment = match[1].trim().replace(/\s+/g, " ");
      if (comment.length > 0 && comment !== "特になし") {
        return comment;
      }
    }
  }
  return "";
}

/**
 * PDFテキストからCSスコアを抽出
 */
function extractCsScore(text: string): string {
  const match = text.match(/ファンくるCSスコア\s*\n?\s*([A-S])\s*\n?\s*([\d.]+)/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  return "";
}

/**
 * 単一のファンくるPDFを解析してコメントを抽出
 */
export async function parseFankuruPdf(
  driveFileId: string,
  stylist: string,
  date: string,
  store: string
): Promise<FankuruComment> {
  try {
    const pdfBuffer = await downloadPdfFromDrive(driveFileId);
    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    const text = result.text;

    // Clean up
    await parser.destroy();

    const comment = extractQ47Comment(text);
    const recommendReason = extractQ10Comment(text);
    const csScore = extractCsScore(text);

    return {
      driveFileId,
      stylist,
      date,
      store,
      comment,
      recommendReason,
      csScore,
    };
  } catch (error) {
    console.error(`Failed to parse PDF ${driveFileId}:`, error);
    return {
      driveFileId,
      stylist,
      date,
      store,
      comment: "",
    };
  }
}

/**
 * 複数のファンくるPDFを並列で解析
 * 最大同時実行数を制限してレート制限を回避
 */
export async function parseFankuruPdfs(
  pdfs: { driveFileId: string; stylist: string; date: string; store: string }[],
  concurrency: number = 3
): Promise<FankuruComment[]> {
  const results: FankuruComment[] = [];

  for (let i = 0; i < pdfs.length; i += concurrency) {
    const batch = pdfs.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((pdf) =>
        parseFankuruPdf(pdf.driveFileId, pdf.stylist, pdf.date, pdf.store)
      )
    );
    results.push(...batchResults);
  }

  return results;
}
