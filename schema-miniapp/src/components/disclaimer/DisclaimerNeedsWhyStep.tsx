import { useTr } from '../../utils/addressForm';
import { DisclaimerTimeChip } from './DisclaimerTimeChip';

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
        style={{
          borderRadius: 'var(--r-16)',
          padding: '16px 18px',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
          {tr(
            'Это поведенческая техника, а не пассивное самонаблюдение. Ты отмечаешь не фоновое настроение, а конкретные действия дня: было ли сегодня что-то, что удовлетворило потребность.',
            'Это поведенческая техника, а не пассивное самонаблюдение. Вы отмечаете не фоновое настроение, а конкретные действия дня: было ли сегодня что-то, что удовлетворило потребность.',
          )}
        </div>
      </div>

      <DisclaimerTimeChip>
        Пять оценок — это меньше минуты в день.
      </DisclaimerTimeChip>
    </div>
  );
}
