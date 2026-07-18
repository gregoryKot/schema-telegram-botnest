import { useHistorySheet } from '../hooks/useHistorySheet';

export const THERAPIST_DISCLAIMER_KEY = 'therapist_privacy_disclaimer_seen';

interface Props {
  onDone: () => void;
}

/**
 * Первый вход в кабинет терапевта: короткий этический дисклеймер о том, что
 * клиентов лучше записывать под инициалами/псевдонимом, а не полным именем.
 * Показывается один раз (флаг в localStorage).
 */
export function TherapistPrivacyDisclaimer({ onDone }: Props) {
  const goBack = useHistorySheet(onDone);

  function acknowledge() {
    localStorage.setItem(THERAPIST_DISCLAIMER_KEY, '1');
    goBack();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 260,
      background: 'var(--bg)', overflowY: 'auto',
    }}>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '56px 24px 40px' }}>

        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🕊️</div>
          <h1 style={{
            fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 400,
            color: 'var(--text)', lineHeight: 1.2, marginBottom: 14,
          }}>
            Немного о заботе о клиентах
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7 }}>
            Здесь будет ваша работа с людьми, которые вам доверились. Одна маленькая
            привычка поможет бережно сохранить это доверие.
          </p>
        </div>

        <p style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.75, marginBottom: 18 }}>
          Пожалуйста, старайтесь <span style={{ fontWeight: 600 }}>не вносить настоящие имена
          и фамилии клиентов</span> — ни в карточку клиента, ни в заметки, ни в записи о
          сессиях. Достаточно инициалов, псевдонима или любого обозначения, понятного
          только вам.
        </p>

        <p style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.75, marginBottom: 20 }}>
          Это привычная профессиональная практика, а не лишняя перестраховка — так бережно
          поступают даже с бумажными записями. Смысл простой: если записи вдруг окажутся
          не у тех людей, по ним нельзя будет понять, о ком речь.
        </p>

        <div style={{
          background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent) 16%, transparent)',
          borderRadius: 14, padding: '16px 18px', marginBottom: 22,
        }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-sub)', lineHeight: 1.7 }}>
            На этом стоят и этические кодексы психологов —{' '}
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>РПО</span> и{' '}
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>APA (стандарт 6.02)</span>:
            они рекомендуют обезличивать данные клиента и использовать условные обозначения
            вместо настоящих имён.
          </div>
        </div>

        <p style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.75, marginBottom: 16 }}>
          А обо всём остальном мы уже позаботились. Вот что делаем со своей стороны:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {[
            ['🔒', 'Шифрование',
              'Всё чувствительное — заметки, записи о сессиях, дневники — хранится в зашифрованном виде (AES-256-GCM). Ключ лежит отдельно от базы, поэтому даже при её утечке прочитать данные без него невозможно.'],
            ['👤', 'Только ваш доступ',
              'Данные каждого клиента видите только вы — они привязаны к вашему аккаунту и не пересекаются с чужими.'],
            ['🛡️', 'Защищённый вход',
              'Вход подтверждается подписью Telegram, а попытки подделать сессию мы отслеживаем и отклоняем.'],
            ['🧹', 'Полное удаление',
              'Если решите удалить аккаунт — данные стираются насовсем, без «скрытых» копий про запас.'],
          ].map(([icon, title, text]) => (
            <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 18, lineHeight: 1.4, flexShrink: 0 }}>{icon}</div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-sub)', lineHeight: 1.65 }}>{text}</div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.75, marginBottom: 32 }}>
          И всё же самая надёжная защита — когда лишних персональных данных в системе просто
          нет. Поэтому маленькая привычка выше и наша техника вместе дают клиенту настоящее
          спокойствие. 💛
        </p>

        <button
          onClick={acknowledge}
          className="ex-btn ex-btn-primary"
          style={{ width: '100%', padding: '16px', fontSize: 16 }}
        >
          Спасибо, буду иметь в виду
        </button>
      </div>
    </div>
  );
}
