// Шаг 3 онбординга Disclaimer: об авторе + напоминание о неподтверждённых
// шагах. Перенесено из Disclaimer.tsx как есть (этап 3 REMEDIATION_PLAN) —
// без смены поведения.
export function DisclaimerAuthorStep({
  ready,
  c1,
  c2,
}: {
  ready: boolean;
  c1: boolean;
  c2: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 16,
        }}
      >
        Об авторе
      </div>
      <div
        className="card"
        style={{ borderRadius: 16, padding: '16px 18px', marginBottom: 16 }}
      >
        <div
          style={{
            fontSize: 14,
            color: 'rgba(var(--fg-rgb),0.8)',
            lineHeight: 1.7,
            marginBottom: 10,
          }}
        >
          Канал о схема-терапии —{' '}
          <a
            href="https://t.me/SchemeHappens"
            style={{
              color: 'var(--accent)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            @SchemeHappens
          </a>
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'rgba(var(--fg-rgb),0.8)',
            lineHeight: 1.7,
            marginBottom: 10,
          }}
        >
          Записаться на сессию —{' '}
          <a
            href="https://t.me/kotlarewski"
            style={{
              color: 'var(--accent)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            @kotlarewski
          </a>
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'rgba(var(--fg-rgb),0.8)',
            lineHeight: 1.7,
          }}
        >
          Приложение бесплатное 💛 Поддержать —{' '}
          <a
            href="https://schemehappens.ru/donate"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--accent)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            донат
          </a>
        </div>
      </div>
      {!ready && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--accent-orange)',
            textAlign: 'center',
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          {!c2 && !c1
            ? 'Вернись к шагам 2 и 3 и подтверди согласие'
            : !c2
              ? 'Вернись к шагу 2 и подтверди согласие'
              : 'Вернись к шагу 3 и подтверди согласие'}
        </div>
      )}
    </div>
  );
}
