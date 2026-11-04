// Общие хелперы карточек дневника. Вынесено из DiaryListView.tsx (правило №10).

/** color-mix helper: works with CSS variables AND hex strings */
export const cm = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export function formatDt(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  );
}

export function Field({ label, text }: { label: string; text: string }) {
  return (
    <div className="u-mb10">
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-sub)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'rgba(var(--fg-rgb),0.75)',
          lineHeight: 1.5,
        }}
      >
        {text}
      </div>
    </div>
  );
}
