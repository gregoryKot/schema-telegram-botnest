import { useTr } from '../../utils/addressForm';

export function IntroPhase({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  const tr = useTr();
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 20, paddingTop: 4 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🌱</div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1.3,
            marginBottom: 10,
          }}
        >
          Колесо детства
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.7,
          }}
        >
          Те же пять потребностей — но про детство.
        </div>
      </div>

      <div
        style={{
          background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
          border:
            '1px solid color-mix(in srgb, var(--accent) 15%, transparent)',
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.75,
          }}
        >
          В схема-терапии считается, что схемы формируются когда базовые
          потребности{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
            систематически не удовлетворялись в детстве
          </span>
          . Это упражнение поможет увидеть, какие области могут быть особенно
          чувствительными — и почему дневник сегодня показывает то, что
          показывает.
        </div>
      </div>

      <div
        style={{
          background: 'rgba(var(--fg-rgb),0.04)',
          borderRadius: 14,
          padding: '12px 16px',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
          }}
        >
          Это не диагностика. Оценки приблизительны и субъективны. Результаты —{' '}
          {tr('для твоего понимания', 'для вашего понимания')}, не для выводов.
        </div>
      </div>

      <button
        onClick={onStart}
        style={{
          width: '100%',
          padding: '15px 0',
          borderRadius: 14,
          border: 'none',
          background: 'linear-gradient(135deg, #a78bfa, #4fa3f7)',
          color: 'var(--text)',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 10,
        }}
      >
        Оценить детство — 2 минуты
      </button>
      <button
        onClick={onSkip}
        style={{
          width: '100%',
          padding: '12px 0',
          borderRadius: 14,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-sub)',
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Пропустить
      </button>
    </div>
  );
}
