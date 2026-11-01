import { useTr } from '../../utils/addressForm';

// Предупреждение о защитной идеализации над ползунками колеса детства.
// Вынесено из FillPhase.tsx (правило №10).
export function IdealizationNote() {
  const tr = useTr();
  return (
    <div
      style={{
        background: 'color-mix(in srgb, var(--accent-yellow) 8%, transparent)',
        border:
          '1px solid color-mix(in srgb, var(--accent-yellow) 20%, transparent)',
        borderRadius: 'var(--r-14)',
        padding: '12px 14px',
        marginBottom: 20,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--accent-yellow)',
          marginBottom: 4,
        }}
      >
        ⚠️ Осторожно: защитная идеализация
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.65 }}>
        Психика защищает нас от боли — поэтому мы склонны помнить хорошее и не
        замечать систематические паттерны.
        {tr('Оценивай', 'Оценивайте')} <em>не отдельные моменты</em>, а то{' '}
        <em>как было в целом, большую часть времени</em>. Под каждым ползунком —
        описания крайностей, а по кнопке{' '}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'rgba(var(--fg-rgb),0.12)',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-sub)',
            verticalAlign: 'middle',
          }}
        >
          ?
        </span>{' '}
        — реальные примеры из жизни. {tr('Сравни с ними.', 'Сравните с ними.')}
      </div>
    </div>
  );
}
