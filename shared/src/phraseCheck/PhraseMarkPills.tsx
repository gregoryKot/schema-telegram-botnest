// Пилюли с приметами критика в карточке прошлого разбора — единственная
// копия (правило №3): вёрстка совпадала 1-в-1 на обоих фронтендах (только
// контейнер с цитатой фразы вокруг неё стилизован по-разному — он остаётся
// у каждого фронтенда свой).
export function PhraseMarkPills({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}
    >
      {labels.map((m) => (
        <span
          key={m}
          style={{
            fontSize: 11.5,
            padding: '4px 9px',
            borderRadius: 999,
            background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
            color: 'var(--text-sub)',
          }}
        >
          {m}
        </span>
      ))}
    </div>
  );
}
