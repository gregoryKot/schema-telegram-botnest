// Лист «Настроить экран» (волна 2 нейродизайна): выбор главной практики
// фокус-карточки и скрытие карточки серии. Живёт прямо на экране «Сегодня»
// (правило «управление там, где пользователь и так идёт»). Для кого серия —
// источник тревоги/стыда, а не мотивации, её можно убрать.
import { BottomSheet } from './BottomSheet';
import { FOCUS_OPTIONS, FocusPractice } from '../utils/todayFocus';
import { pressable } from '../utils/a11y';

interface Props {
  practice: FocusPractice;
  streakHidden: boolean;
  onPractice: (p: FocusPractice) => void;
  onToggleStreak: () => void;
  onClose: () => void;
}

export function TodayCustomizeSheet({
  practice,
  streakHidden,
  onPractice,
  onToggleStreak,
  onClose,
}: Props) {
  return (
    <BottomSheet onClose={onClose} zIndex={200}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
          Настроить экран
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          Главное дело дня — у каждого своё
        </div>

        <div className="section-label" style={{ margin: '16px 4px 8px' }}>
          Одно дело на сегодня
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FOCUS_OPTIONS.map((opt) => {
            const active = opt.id === practice;
            return (
              <div
                key={opt.id}
                {...pressable(() => onPractice(opt.id))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  background: active
                    ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                    : 'rgba(var(--fg-rgb),0.04)',
                  border: `1.5px solid ${
                    active
                      ? 'color-mix(in srgb, var(--accent) 35%, transparent)'
                      : 'transparent'
                  }`,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{opt.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: active ? 'var(--accent)' : 'var(--text)',
                    }}
                  >
                    {opt.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-sub)',
                      marginTop: 1,
                    }}
                  >
                    {opt.sub}
                  </div>
                </div>
                {active && (
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontWeight: 800,
                      fontSize: 15,
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="section-label" style={{ margin: '16px 4px 8px' }}>
          Показывать
        </div>
        <div
          {...pressable(onToggleStreak)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px',
            borderRadius: 14,
            cursor: 'pointer',
            background: 'rgba(var(--fg-rgb),0.04)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: 20, flexShrink: 0 }}>🔥</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}
            >
              Карточка серии
            </div>
            <div
              style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 1 }}
            >
              можно убрать, если счёт дней давит
            </div>
          </div>
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: streakHidden ? 'var(--text-faint)' : 'var(--accent)',
            }}
          >
            {streakHidden ? '—' : '✓'}
          </span>
        </div>

        <button
          className="btn-primary"
          style={{ marginTop: 16 }}
          onClick={onClose}
        >
          Готово
        </button>
      </div>
    </BottomSheet>
  );
}
