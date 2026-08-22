import { useTr } from '../../utils/addressForm';

// Онбординг-карточка трекера (3 шага). Вынесено из TrackerOverlay.tsx
// (правило №10). ты/вы строки шагов — через tr().
export const buildOnboardingSteps = (
  tr: (ty: string, vy: string) => string,
) => [
  {
    emoji: '👆',
    title: tr('Оценивай действия', 'Оценивайте действия'),
    text: 'Не «я вроде чувствую», а конкретные моменты. Тап по дуге или +/−.',
  },
  {
    emoji: '💡',
    title: tr('Нажми на название', 'Нажмите на название'),
    text: 'Там вопрос для рефлексии, примеры и диапазоны оценки.',
  },
  {
    emoji: '📊',
    title: 'Паттерн — через 3–5 дней',
    text: 'Всё сохраняется. Динамика появится в разделе «История».',
  },
];

export function OnboardingOverlay({
  onbStep,
  setOnbStep,
  dismissOnb,
}: {
  onbStep: number;
  setOnbStep: (fn: (s: number) => number) => void;
  dismissOnb: () => void;
}) {
  const tr = useTr();
  const onbSteps = buildOnboardingSteps(tr);
  return (
    <div style={{ padding: '0 20px 8px', flexShrink: 0 }}>
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--r-16)',
          padding: '14px 16px',
        }}
      >
        <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
          {onbSteps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === onbStep ? 16 : 6,
                height: 6,
                borderRadius: 3,
                background:
                  i === onbStep ? 'var(--accent)' : 'var(--surface-2)',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-12)',
            alignItems: 'flex-start',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 22, flexShrink: 0 }}>
            {onbSteps[onbStep].emoji}
          </span>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 4,
              }}
            >
              {onbSteps[onbStep].title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-sub)',
                lineHeight: 1.55,
              }}
            >
              {onbSteps[onbStep].text}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
          <button
            onClick={dismissOnb}
            style={{
              padding: '7px 12px',
              border: 'none',
              fontFamily: 'inherit',
              borderRadius: 'var(--r-10)',
              background: 'transparent',
              color: 'var(--text-faint)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Пропустить
          </button>
          <button
            onClick={() =>
              onbStep < 2 ? setOnbStep((s) => s + 1) : dismissOnb()
            }
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              fontFamily: 'inherit',
              borderRadius: 'var(--r-10)',
              background: 'var(--surface-2)',
              color: 'var(--accent)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {onbStep < 2 ? 'Далее →' : 'Понятно, начнём'}
          </button>
        </div>
      </div>
    </div>
  );
}
