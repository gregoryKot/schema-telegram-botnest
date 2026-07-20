import { useTr } from '../../utils/addressForm';

// Второй содержательный шаг: зачем отмечать каждый день. Формулировка —
// та же, что в aboutData («поведенческая техника, а не самонаблюдение»).
export function DisclaimerNeedsWhyStep() {
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
        Зачем отмечать каждый день
      </div>

      <div
        className="card"
        style={{ borderRadius: 16, padding: '16px 18px', marginBottom: 12 }}
      >
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
          {tr(
            'Это поведенческая техника, не просто самонаблюдение. Ты отмечаешь не фоновое настроение, а конкретные действия дня: было ли сегодня что-то, что удовлетворило потребность.',
            'Это поведенческая техника, не просто самонаблюдение. Вы отмечаете не фоновое настроение, а конкретные действия дня: было ли сегодня что-то, что удовлетворило потребность.',
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '13px 16px',
          borderRadius: 14,
          background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0 }}>⏱</span>
        <div
          style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}
        >
          Пять оценок — это меньше минуты в день.
        </div>
      </div>
    </div>
  );
}
