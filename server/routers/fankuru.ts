import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { parseFankuruPdfs, type FankuruComment } from "../fankuruPdf";

// メモリキャッシュ（サーバー再起動で消える）
const commentCache = new Map<string, FankuruComment>();

export const fankuruRouter = router({
  /**
   * ファンくるPDFからコメントを抽出する
   * 入力: driveFileIdのリスト（各PDFのメタ情報付き）
   * 出力: 各PDFのコメント情報
   */
  getComments: publicProcedure
    .input(
      z.object({
        pdfs: z.array(
          z.object({
            driveFileId: z.string(),
            stylist: z.string(),
            date: z.string(),
            store: z.string(),
          })
        ),
      })
    )
    .query(async ({ input }) => {
      const { pdfs } = input;

      // キャッシュにあるものはスキップ
      const uncached: typeof pdfs = [];
      const results: FankuruComment[] = [];

      for (const pdf of pdfs) {
        const cached = commentCache.get(pdf.driveFileId);
        if (cached) {
          results.push(cached);
        } else {
          uncached.push(pdf);
        }
      }

      // キャッシュにないものだけPDF解析
      if (uncached.length > 0) {
        const parsed = await parseFankuruPdfs(uncached, 3);
        for (const comment of parsed) {
          commentCache.set(comment.driveFileId, comment);
          results.push(comment);
        }
      }

      return results;
    }),
});
