import { haptic } from '../haptic';

// Единственный контрол оценки потребности 0–10 (тап по 10 сегментам).
// Используется и на экране «Сегодня» (NeedSlider), и в карточке-детали
// (NeedTodaySheet) — чтобы взаимодействие было одно, а не два разных.
interface Props {
  color: string;
  value: number | undefined;
  yesterday?: number;
  onChange: (value: number) => void;
}

export function NeedRatingBar({
  color,
  value,
  yesterday = 0,
  onChange,
}: Props) {
  const v = value ?? 0;
  const delta = v > 0 ? v - yesterday : 0;

  return (
    <div>
      <div
        role="group"
        aria-label="Оценка от 1 до 10"
        style={{ display: 'flex', gap: 3 }}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => {
          const filled = v > 0 && s <= v;
          const isYesterday = yesterday > 0 && s === yesterday;
          return (
            <button
              key={s}
              onClick={() => {
                haptic.tap();
                onChange(s);
              }}
              aria-label={`Поставить ${s}`}
              aria-pressed={v === s}
              style={{
                flex: 1,
                padding: '17px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div
                style={{
                  height: 12,
                  borderRadius: 4,
                  background: filled ? color : 'rgba(var(--fg-rgb),0.09)',
                  boxShadow: isYesterday
                    ? `inset 0 0 0 1.5px ${color}80`
                    : 'none',
                  transition: 'background 0.12s',
                }}
              />
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 4,
          fontSize: 11,
          color: 'var(--text-faint)',
        }}
      >
        <span>мало</span>
        {yesterday > 0 ? (
          <span style={{ color: 'var(--text-sub)' }}>
            вчера {yesterday}
            {delta !== 0 && (
              <span style={{ color, fontWeight: 600 }}>
                {' '}
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
          </span>
        ) : (
          <span />
        )}
        <span>много</span>
      </div>
    </div>
  );
}
