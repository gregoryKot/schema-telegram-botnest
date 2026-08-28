// Экран ожидания подтверждения входа — один на мини-апп и на сайт (правило
// №3 и «одна механика — один компонент»: копия этого блока в двух фронтендах
// разъехалась бы на первой же правке текста).
//
// Что он обязан сделать. Показать КОД — сверка с тем, что человек увидит в
// боте, единственное, что отделяет честный вход от присланной кем-то ссылки.
// И оставить дорогу назад: ссылка открывается заново, если человек закрыл
// вкладку мессенджера или свернул её и потерял.
//
// Обращения в тексте нет намеренно: экран показывается ДО входа, профиль ещё
// не загружен и форма (ты/вы) неизвестна — вилку строить не из чего. Тот же
// приём, что в AuthFailureHelp.
import { formatUserCode } from '../auth/loginTicketCode';
import type { LoginTicketState } from '../auth/useLoginTicket';

const SUB: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-sub)',
  lineHeight: 1.6,
};

const LINK: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--accent)',
  textDecoration: 'none',
  minHeight: 44,
  padding: '0 12px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const PROVIDER_NAMES: Record<string, string> = {
  telegram: 'Telegram',
  google: 'Google',
  vk: 'ВКонтакте',
  email: 'почте',
};

export function LoginTicketWait({
  state,
  onRetry,
}: {
  state: LoginTicketState;
  onRetry: () => void;
}) {
  if (state.kind === 'denied') {
    return (
      <div style={{ ...SUB, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🛑</div>
        Вход отклонён. Доступ никто не получил.
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={onRetry} style={LINK}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === 'expired' || state.kind === 'failed') {
    return (
      <div style={{ ...SUB, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⌛</div>
        {state.kind === 'expired'
          ? 'Время кода вышло.'
          : 'Не получилось начать вход.'}
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={onRetry} style={LINK}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (state.kind !== 'waiting') return null;

  const where = PROVIDER_NAMES[state.provider] ?? state.provider;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={SUB}>
        {state.provider === 'telegram'
          ? `Подтвердите вход в ${where} — там появится этот код:`
          : `Подтвердите вход через ${where}. Код входа:`}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: 2,
          margin: '12px 0',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          color: 'var(--text)',
        }}
      >
        {formatUserCode(state.code)}
      </div>
      <div style={SUB}>
        Приложение впустит само, как только вход подтвердят.
      </div>
      <a
        href={state.url}
        target="_blank"
        rel="noopener noreferrer"
        style={LINK}
      >
        Открыть ещё раз →
      </a>
    </div>
  );
}
