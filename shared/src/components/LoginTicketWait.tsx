// Экран ожидания подтверждения входа — один на мини-апп и на сайт (правило
// №3 и «одна механика — один компонент»: копия этого блока в двух фронтендах
// разъехалась бы на первой же правке текста).
//
// Что он обязан сделать. Показать КОД — сверка с тем, что человек увидит в
// боте, единственное, что отделяет честный вход от присланной кем-то ссылки.
// И оставить дорогу назад: ссылка открывается заново, если человек закрыл
// вкладку мессенджера или свернул её и потерял.
//
// Код свёрнут, пока о нём не спросили (2026-10-03, владелец): билет
// выписывается при открытии экрана входа, ещё до нажатия, и крупный код без
// запроса читался как непонятная проверка. Сверять его нужно только тому, кто
// уже ушёл подтверждать в бота, — ему хватает одного нажатия «Показать код».
//
// Обращения в тексте нет намеренно: экран показывается ДО входа, профиль ещё
// не загружен и форма (ты/вы) неизвестна — вилку строить не из чего. Тот же
// приём, что в AuthFailureHelp.
import { useState } from 'react';
import { formatUserCode } from '../auth/loginTicketCode';
import type { LoginTicketState } from '../auth/useLoginTicket';
import {
  loginTicketFailure,
  type TicketFailureView,
} from '../auth/loginTicketFailure';
import { OutArrow } from './OutArrow';

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
  renderFailure,
}: {
  state: LoginTicketState;
  onRetry: () => void;
  renderFailure?: TicketFailureView;
}) {
  const failure = loginTicketFailure(state);
  if (failure) {
    if (renderFailure) return <>{renderFailure(failure, onRetry)}</>;
    return (
      <div style={{ ...SUB, textAlign: 'center' }}>
        {failure.text}
        <div className="u-mt12">
          <button type="button" onClick={onRetry} style={LINK}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (state.kind !== 'waiting') return null;
  return <WaitingCode state={state} />;
}

function WaitingCode({
  state,
}: {
  state: Extract<LoginTicketState, { kind: 'waiting' }>;
}) {
  const [shown, setShown] = useState(false);
  if (!shown) {
    return (
      <div className="u-tc">
        <button
          type="button"
          onClick={() => setShown(true)}
          aria-expanded={false}
          style={{ ...LINK, background: 'none', border: 'none' }}
        >
          Показать код входа
        </button>
      </div>
    );
  }

  const where = PROVIDER_NAMES[state.provider] ?? state.provider;
  return (
    <div className="u-tc">
      <div style={SUB}>
        {state.provider === 'telegram'
          ? `Осталось подтвердить вход в ${where} — там появится этот код:`
          : `Осталось подтвердить вход через ${where}. Код входа:`}
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
        Открыть ещё раз
        <OutArrow />
      </a>
    </div>
  );
}
