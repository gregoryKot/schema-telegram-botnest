// Секция «О приложении» — версия, ссылки, контакты. Статический контент.
// Вынесено из SettingsSheet.tsx.
import { SettingsLabel } from './primitives';

export function AboutSection() {
  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>О ПРИЛОЖЕНИИ</SettingsLabel>
      <div className="card" style={{ borderRadius: 16, padding: '20px 16px' }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.5px',
            marginBottom: 10,
          }}
        >
          Всё по схеме
        </div>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.7,
            margin: '0 0 16px',
          }}
        >
          Инструмент самопознания на основе схема-терапии: трекер потребностей,
          дневники схем и режимов, тесты, практики и пространство для работы с
          терапевтом.
        </p>
        <div
          style={{
            height: 1,
            background: 'rgba(var(--fg-rgb),0.07)',
            marginBottom: 16,
          }}
        />
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-sub)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Об авторе
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-sub)',
              lineHeight: 1.6,
            }}
          >
            Канал о схема-терапии —{' '}
            <a
              href="https://t.me/SchemeHappens"
              style={{
                color: 'var(--accent)',
                textDecoration: 'none',
              }}
            >
              @SchemeHappens
            </a>
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-sub)',
              lineHeight: 1.6,
            }}
          >
            Записаться на сессию —{' '}
            <a
              href="https://t.me/kotlarewski"
              style={{
                color: 'var(--accent)',
                textDecoration: 'none',
              }}
            >
              @kotlarewski
            </a>
          </div>
          {/* Подписка скрыта до подключения рекуррента у Robokassa */}
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-sub)',
              lineHeight: 1.6,
            }}
          >
            Поддержать проект —{' '}
            <a
              href="https://schemehappens.ru/donate"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent)',
                textDecoration: 'none',
              }}
            >
              разовый донат 💛
            </a>
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            lineHeight: 1.5,
          }}
        >
          Разработано для образовательных целей. Не является медицинским или
          психологическим сервисом.
        </div>
      </div>
    </div>
  );
}
