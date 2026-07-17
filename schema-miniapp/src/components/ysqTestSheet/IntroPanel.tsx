interface IntroPanelProps {
  hasProgress: boolean;
  progressAnswered: number;
  handleContinue: () => void;
  handleStartFresh: () => void;
  onClose: () => void;
}

export function IntroPanel({
  hasProgress,
  progressAnswered,
  handleContinue,
  handleStartFresh,
  onClose,
}: IntroPanelProps) {
  return (
    <div style={{ padding: '8px 0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🧠</div>
        <div
          style={{
            fontSize: 23,
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.5px',
            marginBottom: 6,
          }}
        >
          Тест на схемы
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.5,
          }}
        >
          Паттерны мышления и поведения, сложившиеся в детстве
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginBottom: 20,
        }}
      >
        {[
          ['📋', '116 утверждений', 'Оцени каждое от 1 до 6'],
          ['⏱️', '~10 минут', 'Можно прервать — прогресс сохраняется'],
          ['🔍', '20 схем', 'Результат с описанием и советом для каждой'],
        ].map(([emoji, title, desc]) => (
          <div
            key={title}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: 'rgba(var(--fg-rgb),0.04)',
              borderRadius: 14,
              padding: '12px 16px',
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text)',
                }}
              >
                {title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-sub)',
                  marginTop: 1,
                }}
              >
                {desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: 'rgba(var(--fg-rgb),0.05)',
          borderRadius: 14,
          padding: '12px 16px',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          Шкала ответов:
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 4,
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} style={{ textAlign: 'center', flex: 1 }}>
              <div
                style={{
                  height: 34,
                  borderRadius: 10,
                  background: `color-mix(in srgb, var(--accent) ${6 + n * 13}%, rgba(var(--fg-rgb),0.06))`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 700,
                  color: n >= 4 ? 'var(--accent)' : 'var(--text-sub)',
                  marginBottom: 5,
                }}
              >
                {n}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: 'var(--text-faint)',
                  lineHeight: 1.3,
                }}
              >
                {n === 1
                  ? 'Совсем не про меня'
                  : n === 6
                    ? 'Полностью про меня'
                    : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: 'var(--text-faint)',
          lineHeight: 1.5,
          marginBottom: 20,
          textAlign: 'center',
        }}
      >
        Ответы привязаны к аккаунту Telegram и не передаются третьим лицам.
      </div>

      {hasProgress ? (
        <>
          <button
            onClick={handleContinue}
            className="btn-primary"
            style={{ marginBottom: 10 }}
          >
            Продолжить ({progressAnswered} из 116)
          </button>
          <button
            onClick={handleStartFresh}
            style={{
              width: '100%',
              padding: '14px 0',
              border: 'none',
              borderRadius: 14,
              background: 'rgba(var(--fg-rgb),0.07)',
              color: 'var(--text-sub)',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            Начать заново
          </button>
        </>
      ) : (
        <button
          onClick={handleStartFresh}
          className="btn-primary"
          style={{ marginBottom: 10 }}
        >
          Начать тест
        </button>
      )}

      <button
        onClick={onClose}
        style={{
          width: '100%',
          padding: '14px 0',
          border: 'none',
          borderRadius: 14,
          background: 'rgba(var(--fg-rgb),0.07)',
          color: 'var(--text-sub)',
          fontSize: 15,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Отмена
      </button>

      <div
        style={{
          marginTop: 20,
          fontSize: 11,
          color: 'var(--text-faint)',
          lineHeight: 1.7,
          textAlign: 'center',
        }}
      >
        Это не официальный клинический тест и не диагностика. Профессиональные
        опросники по схемам защищены авторским правом и требуют лицензии — их
        здесь нет. Это самостоятельный образовательный опросник для
        самонаблюдения: помогает примерно сориентироваться в своих паттернах, но
        не ставит диагноз и не заменяет консультацию специалиста.
      </div>
    </div>
  );
}
