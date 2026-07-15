import { NEEDS_EXPLAINER } from '../../aboutData';
import { NEED_ORDER } from '../../needData';
import { COLORS } from '../../types';
import { useTr } from '../../utils/addressForm';

// Шаг онбординга Disclaimer: откуда берутся потребности и зачем их отмечать.
// Отвечает на вопрос новичка «что это вообще и зачем» до первого чек-ина —
// переиспользует выверенный контент NEEDS_EXPLAINER (тот же, что в AboutSheet).
export function DisclaimerNeedsStep() {
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
        Откуда потребности
      </div>

      {/* Откуда они берутся */}
      <div
        className="card"
        style={{ borderRadius: 16, padding: '16px 18px', marginBottom: 12 }}
      >
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
          У каждого человека есть{' '}
          <strong>пять базовых эмоциональных потребностей</strong>. Это не про
          характер — это то, что нужно любому, чтобы чувствовать себя живым и
          устойчивым.
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.7,
            marginTop: 10,
          }}
        >
          Когда они удовлетворены — внутри опора. Когда нет — появляется
          тревога, раздражение или пустота, даже если день прошёл нормально.
        </div>
      </div>

      {/* Пять потребностей — чипы в цветах трекера */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 7,
          marginBottom: 12,
        }}
      >
        {NEEDS_EXPLAINER.map((n, i) => {
          const color = COLORS[NEED_ORDER[i]] ?? 'var(--accent)';
          return (
            <div
              key={n.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 11px',
                borderRadius: 12,
                background: `color-mix(in srgb, ${color} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${color} 26%, transparent)`,
              }}
            >
              <span style={{ fontSize: 15 }}>{n.emoji}</span>
              <span
                style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}
              >
                {n.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Зачем отмечать */}
      <div
        className="card"
        style={{ borderRadius: 16, padding: '16px 18px' }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--accent)',
            marginBottom: 8,
          }}
        >
          ЗАЧЕМ ОТМЕЧАТЬ
        </div>
        <div
          style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7 }}
        >
          {tr(
            'Раз в день ты отмечаешь не настроение, а конкретные действия: было ли сегодня что-то, что удовлетворило потребность. Через 3–5 дней виден паттерн — что тебя питает, а что истощает.',
            'Раз в день вы отмечаете не настроение, а конкретные действия: было ли сегодня что-то, что удовлетворило потребность. Через 3–5 дней виден паттерн — что вас питает, а что истощает.',
          )}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text)',
            fontWeight: 600,
            lineHeight: 1.6,
            marginTop: 10,
          }}
        >
          Заметить — уже первый шаг. 🌱
        </div>
      </div>
    </div>
  );
}
