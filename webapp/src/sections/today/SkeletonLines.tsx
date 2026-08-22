// Скелетон-строки экрана «Сегодня». Вынесено из TodaySection.tsx (правило №10).

export function SkeletonLines() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
      {[70, 55, 80].map((w, i) => (
        <div key={i} style={{ height: 11, borderRadius: 'var(--r-6)', width: `${w}%`, background: 'var(--surface-3)' }} />
      ))}
    </div>
  );
}
