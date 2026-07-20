// Шаг онбординга: об авторе. Напоминание о неподтверждённых согласиях уехало
// на шаг «Важно знать» — гейт теперь там, сразу после галочек.
export function DisclaimerAuthorStep() {
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
    </div>
  );
}
