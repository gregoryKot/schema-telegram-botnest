import { useTr } from '../../utils/addressForm';

// Третий содержательный шаг: что человек получит и через какой срок. Отвечает
// на «зачем это делать» конкретным результатом (правило CLAUDE.md про
// онбординг), формулировка — из aboutData.
export function DisclaimerNeedsResultStep() {
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
        {tr('Что ты увидишь', 'Что вы увидите')}
      </div>

      <div
        className="card"
        style={{ borderRadius: 16, padding: '16px 18px', marginBottom: 12 }}
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
          ЧЕРЕЗ 3–5 ДНЕЙ
        </div>
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
          {tr(
            'Паттерн начинает читаться: что тебя питает, что истощает, чего не хватает. Это видно в графике — не нужно ничего вспоминать.',
            'Паттерн начинает читаться: что вас питает, что истощает, чего не хватает. Это видно в графике — не нужно ничего вспоминать.',
          )}
        </div>
      </div>

      <div
        style={{
          fontSize: 13,
          color: 'var(--text)',
          fontWeight: 600,
          lineHeight: 1.6,
          textAlign: 'center',
          padding: '4px 8px',
        }}
      >
        Заметить — уже первый шаг. 🌱
      </div>
    </div>
  );
}
