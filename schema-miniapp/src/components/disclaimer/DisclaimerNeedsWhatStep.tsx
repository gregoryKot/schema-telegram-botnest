import { NEEDS_EXPLAINER } from '../../aboutData';
import { NEED_ORDER } from '../../needData';
import { COLORS } from '../../types';

// Первый содержательный шаг онбординга, сразу после согласий: что это за пять
// потребностей и откуда они. Одна мысль на экран — «зачем отмечать» и «что
// увидишь» вынесены в следующие шаги. Контент — тот же NEEDS_EXPLAINER, что в
// AboutSheet (третьей формулировки не заводим).
export function DisclaimerNeedsWhatStep() {
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
        Пять базовых потребностей
      </div>

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
          Список пришёл из схема-терапии: считается, что схемы формируются там,
          где эти потребности систематически не удовлетворялись.
        </div>
      </div>

      {/* Пять потребностей — чипы в цветах трекера */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
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
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--text)',
                }}
              >
                {n.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
