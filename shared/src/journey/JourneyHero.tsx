// Hero-блоки «Моего пути» мини-аппа (вынесены из JourneyView, правило №10):
// градиентная шапка с итогом и пустое состояние «Путь ещё впереди».

const mix = (c: string, n: number) =>
  `color-mix(in srgb, var(--${c}) ${n}%, transparent)`;
const heroBg = (a: number, b: number) =>
  `linear-gradient(135deg, ${mix('accent', a)}, ${mix('accent-blue', b)})`;

export function JourneyEmptyHero({
  tr,
  explainer,
}: {
  tr: (ty: string, vy: string) => string;
  explainer: string;
}) {
  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 20,
        padding: '28px 20px',
        textAlign: 'center',
        background: heroBg(9, 7),
      }}
    >
      <div style={{ fontSize: 34, marginBottom: 10 }}>🧭</div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 8,
        }}
      >
        Путь ещё впереди
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55 }}>
        {explainer}{' '}
        {tr(
          'Начни с трекера или любого дневника — первый шаг появится здесь.',
          'Начните с трекера или любого дневника — первый шаг появится здесь.',
        )}
      </div>
    </div>
  );
}

export function JourneyHero({
  total,
  explainer,
  onShareFeed,
}: {
  total: number;
  explainer: string;
  onShareFeed: () => void;
}) {
  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 20,
        padding: '18px 18px 16px',
        background: heroBg(11, 8),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: 40,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: '-1.5px',
            color: 'var(--text)',
          }}
        >
          {total}
        </span>
        <span
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-sub)' }}
        >
          шагов заботы о себе
        </span>
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 12.5,
          color: 'var(--text-sub)',
          lineHeight: 1.5,
        }}
      >
        {explainer}
      </div>
      <button
        onClick={onShareFeed}
        style={{
          marginTop: 12,
          minHeight: 36,
          padding: '0 14px',
          borderRadius: 999,
          border: `1px solid ${mix('accent', 30)}`,
          background: mix('accent', 12),
          color: 'var(--accent)',
          fontSize: 12.5,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        Поделиться лентой шагов
      </button>
    </div>
  );
}
