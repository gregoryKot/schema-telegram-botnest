import { useTr } from '../utils/addressForm';
import { buildHomeScreenHint } from '../utils/homeScreen';
import { useHomeScreenOffer } from '../hooks/useHomeScreenOffer';

// Напоминание «добавь значок на экран» на «Сегодня». Появляется у тех, кто
// продолжает заходить: отложил — вернётся через неделю, отказался — не
// вернётся никогда, добавил — тем более (статус Telegram отдаёт сам).
//
// Три исхода намеренно разные по весу: главная кнопка одна, «позже» и
// «не предлагать» — текстовые, но с полноценной зоной нажатия (≥44px).
export function HomeScreenOfferCard() {
  const tr = useTr();
  const offer = useHomeScreenOffer('today');
  if (!offer.visible) return null;

  return (
    <div
      className="card"
      style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 24, lineHeight: '28px', flexShrink: 0 }}>
          📲
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 4,
            }}
          >
            {tr('Держи под рукой', 'Держите под рукой')}
          </div>
          <div
            style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}
          >
            {/* Строка безличная — вилка ты/вы не нужна. */}
            Значок на экране телефона — заходить не через Telegram, а в одно
            касание.
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-faint)',
              lineHeight: 1.6,
              marginTop: 6,
            }}
          >
            {buildHomeScreenHint(offer.platform, tr)}
          </div>
        </div>
      </div>

      <button onClick={offer.add} className="btn-primary">
        Добавить значок
      </button>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={offer.later}
          style={{
            flex: 1,
            minHeight: 44,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-sub)',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          Позже
        </button>
        <button
          onClick={offer.never}
          style={{
            flex: 1,
            minHeight: 44,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-faint)',
            fontSize: 13,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          Не предлагать
        </button>
      </div>
    </div>
  );
}
