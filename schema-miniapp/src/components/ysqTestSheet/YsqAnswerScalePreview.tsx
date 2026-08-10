// Превью шкалы ответов (1..6) на интро теста — вынесено из YsqIntro.tsx
// (правило №10, файл был у потолка). Самостоятельный блок без состояния.
export function YsqAnswerScalePreview() {
  return (
    <div
      style={{
        background: 'rgba(var(--fg-rgb),0.05)',
        borderRadius: 14,
        padding: '12px 16px',
        marginBottom: 20,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-sub)',
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        Шкала ответов:
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} style={{ textAlign: 'center', flex: 1 }}>
            <div
              style={{
                height: 34,
                borderRadius: 10,
                background: `color-mix(in srgb, var(--accent) ${6 + n * 13}%, rgba(var(--fg-rgb),0.06))`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                fontWeight: 700,
                color: n >= 4 ? 'var(--accent)' : 'var(--text-sub)',
                marginBottom: 5,
              }}
            >
              {n}
            </div>
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-faint)',
                lineHeight: 1.3,
              }}
            >
              {n === 1
                ? 'Совсем не про меня'
                : n === 6
                  ? 'Полностью про меня'
                  : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
