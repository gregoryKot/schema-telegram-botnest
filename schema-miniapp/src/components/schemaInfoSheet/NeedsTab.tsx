import { useTr } from '../../utils/addressForm';
import { buildNeedsData } from './needsData';

export function NeedsTab() {
  const tr = useTr();
  const NEEDS_DATA = buildNeedsData(tr);
  return (
    <div>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          lineHeight: 1.6,
          marginBottom: 20,
        }}
      >
        Схема-терапия строится на идее, что у каждого есть пять базовых
        эмоциональных потребностей. Когда они систематически не удовлетворялись
        в детстве — формируются схемы: устойчивые паттерны мышления и поведения.
      </p>
      {NEEDS_DATA.map((n) => (
        <div
          key={n.title}
          style={{
            background: 'rgba(var(--fg-rgb),0.04)',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 24 }}>{n.emoji}</span>
            <div>
              <div
                style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}
              >
                {n.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>
                {n.subtitle}
              </div>
            </div>
          </div>
          <div
            style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}
          >
            {n.desc}
          </div>
        </div>
      ))}
    </div>
  );
}
