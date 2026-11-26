/**
 * 状態の一言を出す。括弧（「（11/30(月) 10:00 から）」など）は丸ごと1つのかたまりにして、
 * 入りきらなければ括弧ごと次の行へ送る（「から）」「の分）」だけが行に取り残されないように）。
 * 括弧の中は短い日時だけにしてあるので、320px のカードにも収まる。
 */
export function Label({ text }: { text: string }) {
  const parts = text.split(/(（[^）]*）)/).filter(Boolean);
  return (
    <>
      {parts.map((p, k) =>
        p.startsWith("（") ? (
          <span key={k} className="inline-block max-w-full whitespace-nowrap">
            {p}
          </span>
        ) : (
          <span key={k}>{p}</span>
        ),
      )}
    </>
  );
}
