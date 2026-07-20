import { FOCUS_OPTIONS } from '../../utils/todayFocus';
import { useTr } from '../../utils/addressForm';

// Шаг про настраиваемый экран «Сегодня»: у него одно главное дело на день, и
// это дело можно поменять под себя. Список практик берём из FOCUS_OPTIONS —
// того же источника, что и сам лист «Настроить экран» (одна механика — один
// источник), иначе списки разъедутся при добавлении практики.
export function DisclaimerTodayScreenStep() {
  const tr = useTr();
  return (
    <div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 14,
        }}
      >
        {tr('Главный экран — под тебя', 'Главный экран — под вас')}
      </div>

      <div
        className="card"
        style={{ borderRadius: 16, padding: '16px 18px', marginBottom: 12 }}
      >
        {/* Строка безличная — вилка обращения не нужна (правило CLAUDE.md). */}
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
          На «Сегодня» всегда одно главное дело. По умолчанию это трекер
          потребностей, но можно выбрать другое:
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 7,
            marginTop: 12,
          }}
        >
          {FOCUS_OPTIONS.map((o) => (
            <div
              key={o.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 11px',
                borderRadius: 12,
                background: 'rgba(var(--fg-rgb),0.05)',
                border: '1px solid rgba(var(--fg-rgb),0.08)',
              }}
            >
              <span style={{ fontSize: 15 }}>{o.emoji}</span>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--text)',
                }}
              >
                {o.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '13px 16px',
          borderRadius: 14,
          background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0 }}>⚙️</span>
        <div
          style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}
        >
          Шестерёнка в шапке «Сегодня» — «Настроить экран». Там убирается
          счётчик дней подряд, если он давит, и цитата, если она не нужна.
        </div>
      </div>

      {/* Жест без аффорданса существует, только если о нём сказали. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '13px 16px',
          borderRadius: 14,
          marginTop: 8,
          background: 'rgba(var(--fg-rgb),0.05)',
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0 }}>👆</span>
        <div
          style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}
        >
          {tr(
            'А если задержишь палец на любом блоке — та же настройка откроется сразу на нём.',
            'А если задержите палец на любом блоке — та же настройка откроется сразу на нём.',
          )}
        </div>
      </div>
    </div>
  );
}
