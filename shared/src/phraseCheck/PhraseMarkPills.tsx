// Найденные приметы критика в карточке прошлого разбора — бусинами сливы с подписью (b18: тот же язык,
// что девять бусин хода разбора), а не бледно-розовыми чипами. Единственная копия (правило №3); вид —
// .ex2-mark-beads (webapp/src/styles/ex-phrase.css), бусина — декоративный ::before.
export function PhraseMarkPills({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <ul className="ex2-mark-beads">
      {labels.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}
