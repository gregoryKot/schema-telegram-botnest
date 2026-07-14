// Шаг 0 онбординга Disclaimer: приветствие. Перенесено из Disclaimer.tsx
// как есть (этап 3 REMEDIATION_PLAN) — без смены поведения.
export function DisclaimerWelcomeStep() {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: 4 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 22,
            margin: '0 auto 14px',
            background: 'linear-gradient(135deg, var(--accent), #60a5fa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          }}
        >
          🧠
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 6,
          }}
        >
          Всё по схеме
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.25)',
            borderRadius: 20,
            padding: '3px 12px',
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--accent-yellow)',
            letterSpacing: '0.1em',
          }}
        >
          БЕТА-ВЕРСИЯ
        </div>
      </div>
      <div
        className="card"
        style={{ borderRadius: 16, padding: '16px 18px', marginBottom: 12 }}
      >
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
          Хорошо, что ты здесь. Замечать свои потребности — это уже немало.
        </div>
      </div>
      <div className="card" style={{ borderRadius: 16, padding: '16px 18px' }}>
        <div
          style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7 }}
        >
          «Всё по схеме» — инструмент самопознания: трекер потребностей,
          дневники схем и режимов, тесты, практики и пространство для работы с
          терапевтом.
          <br />
          <br />
          Если чувствуешь, что что-то важное требует внимания — терапия это
          место, где можно разобраться по-настоящему.
        </div>
      </div>
    </div>
  );
}
