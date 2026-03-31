/**
 * ScoreDetailModal — スコア分布の棒グラフクリック時に表示するモーダル
 * 
 * Design: Atelier Blanc
 * - フルスクリーンオーバーレイ（z-[200]）でヘッダーの上に確実に表示
 * - PC: 中央モーダル（max-w-2xl, max-h-[80vh]）
 * - スマホ: 下からスライドアップするシート（max-h-[90vh]）
 * - useIsMobileに依存せず、CSSメディアクエリで切り替え
 */
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";
import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { NpsRecord } from "@/hooks/useNpsData";

const NPS_COLORS = {
  promoter: "#2D9C8F",
  passive: "#E5B85C",
  detractor: "#C75C5C",
};

interface ScoreDetailModalProps {
  selectedScore: number | null;
  onClose: () => void;
  records: NpsRecord[];
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-mono font-bold shrink-0"
      style={{
        backgroundColor:
          score >= 9 ? NPS_COLORS.promoter : score >= 7 ? NPS_COLORS.passive : NPS_COLORS.detractor,
      }}
    >
      {score}
    </div>
  );
}

function ScoreLabel({ score }: { score: number }) {
  const label = score >= 9 ? "推奨者" : score >= 7 ? "中立者" : "批判者";
  return <span className="text-muted-foreground">（{label}）</span>;
}

function RecordCard({ r, i }: { r: NpsRecord; i: number }) {
  return (
    <Card key={r.no + "-" + i} className="border-border/50 shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <span className="text-[11px] text-muted-foreground truncate">{r.menu}</span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{r.date.split(" ")[0]}</span>
        </div>
        {r.review ? (
          <p className="text-sm text-foreground/80 leading-relaxed mb-2">{r.review}</p>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic mb-2">レビューなし</p>
        )}
        <div className="flex flex-wrap gap-1">
          {r.priceComment && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
              金額: {r.priceComment.split(",")[0].trim()}
            </span>
          )}
          {r.spaceComment && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
              空間: {r.spaceComment.split(",")[0].trim()}
            </span>
          )}
          {r.staffComment && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
              スタッフ: {r.staffComment.split(",")[0].trim()}
            </span>
          )}
          {r.finishComment && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
              仕上がり: {r.finishComment.split(",")[0].trim()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ScoreDetailModal({ selectedScore, onClose, records }: ScoreDetailModalProps) {
  const open = selectedScore !== null;
  const filteredRecords = records.filter((r) => r.npsScore === selectedScore);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Full-screen overlay - z-[200] to be above everything */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal content - z-[201] */}
          {/* Desktop: centered modal */}
          {/* Mobile: bottom sheet */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="
              fixed z-[201] bg-background shadow-2xl flex flex-col
              inset-x-0 bottom-0 rounded-t-2xl max-h-[90vh]
              md:inset-auto md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%]
              md:rounded-xl md:max-w-2xl md:w-[calc(100vw-3rem)] md:max-h-[80vh]
              md:bottom-auto
              border-t border-border/60 md:border
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 pt-3 md:pt-5 pb-3 border-b border-border/40 shrink-0">
              <div>
                <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                  {selectedScore !== null && <ScoreBadge score={selectedScore} />}
                  スコア {selectedScore} の回答一覧
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {filteredRecords.length}件の回答
                  {selectedScore !== null && <ScoreLabel score={selectedScore} />}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 hover:bg-muted transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-muted-foreground" />
                <span className="sr-only">閉じる</span>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 overscroll-contain">
              {filteredRecords.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  該当する回答はありません
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredRecords.map((r, i) => (
                    <RecordCard key={r.no + "-" + i} r={r} i={i} />
                  ))}
                </div>
              )}
            </div>

            {/* Mobile safe area padding */}
            <div className="md:hidden h-6 shrink-0" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
