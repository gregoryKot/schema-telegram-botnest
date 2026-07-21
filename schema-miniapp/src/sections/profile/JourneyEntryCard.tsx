// Вход в архив «Мой путь» из профиля: что это и зачем — прямо на карточке
// (правило онбординга «откуда это и зачем»), одно очевидное действие — открыть.
import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';

export function JourneyEntryCard({ onOpen }: { onOpen: () => void }) {
  const tr = useTr();
  return (
    <div
      {...pressable(onOpen)}
      className="card"
      style={{ borderRadius: 20, padding: '16px 16px', cursor: 'pointer' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}
        >
          🧭 Мой путь
        </div>
        <span style={{ color: 'var(--text-faint)', fontSize: 14 }}>›</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.45 }}>
        {tr(
          'Вся твоя история в одном месте: трекер, дневники, практики и тесты — и красивая карточка, чтобы поделиться.',
          'Вся ваша история в одном месте: трекер, дневники, практики и тесты — и красивая карточка, чтобы поделиться.',
        )}
      </div>
    </div>
  );
}
