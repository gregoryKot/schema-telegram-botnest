import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { getHost } from '../../../../shared/src/host';
import { createLoginTicketApi } from '../../../../shared/src/auth/loginTicketApi';
import {
  loginUrl,
  useLoginTicket,
} from '../../../../shared/src/auth/useLoginTicket';
import { LoginTicketWait } from '../../../../shared/src/components/LoginTicketWait';
import { BASE } from '../../utils/apiBase';
import { reportClientError } from '../../api';
import { botUsername } from '../../utils/botConfig';
import { adoptSession } from '../../session';

// Вход по билету (shared/src/auth/useLoginTicket).
//
// Раньше кнопки уводили страницу на `/api/auth/google` и `oauth.telegram.org`
// — адреса вне scope манифеста. Установленное приложение обязано отдать такую
// навигацию внешнему браузеру, и refresh-кука ложилась ТУДА: человек оказывался
// залогинен в Chrome, а приложение, из которого он вышел, оставалось на экране
// входа навсегда (разбор 2026-08-28).
//
// Теперь приложение никуда не уходит. Ссылки открываются СНАРУЖИ
// (`target="_blank"`), а страница остаётся жить и забирает сессию опросом.

const api = createLoginTicketApi(BASE);

const BTN_BASE: CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '13px 16px',
  borderRadius: 'var(--r-14)',
  border: 'none',
  fontSize: 15,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-8)',
  textDecoration: 'none',
};

const PRIMARY: CSSProperties = {
  ...BTN_BASE,
  background: 'var(--accent)',
  color: 'var(--on-accent)',
};

const SECONDARY: CSSProperties = {
  ...BTN_BASE,
  background: 'rgba(var(--fg-rgb), 0.06)',
  color: 'var(--text)',
};

/**
 * Билет выписывается ОДИН на весь экран, ещё до нажатия. Иначе на ссылку
 * пришлось бы жать дважды: первый раз — чтобы выписать билет, второй — чтобы
 * уйти по готовому адресу (открыть окно после `await` браузеры блокируют).
 * `provider` при этом — ожидаемый путь; фактический определяется тем, кто
 * билет подтвердил.
 */
export function LoginProviderButtons() {
  const started = useRef(false);
  const { state, begin, reset } = useLoginTicket({
    api,
    hostId: getHost().id,
    botUsername,
    apiBase: BASE,
    onSession: (token, expiresIn) => {
      adoptSession(token, expiresIn);
      // refresh-кука теперь стоит в ЭТОМ контейнере — перезагрузка поднимет
      // сессию обычным путём и вернёт человека в приложение.
      window.location.reload();
    },
    reportError: reportClientError,
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void begin('telegram');
  }, [begin]);

  if (state.kind !== 'waiting' && state.kind !== 'starting') {
    return (
      <div style={{ marginTop: 16 }}>
        <LoginTicketWait
          state={state}
          onRetry={() => {
            reset();
            void begin('telegram');
          }}
        />
      </div>
    );
  }

  const code = state.kind === 'waiting' ? state.code : null;
  const deps = { botUsername, apiBase: BASE };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
        marginTop: 16,
      }}
    >
      <a
        style={PRIMARY}
        href={code ? loginUrl('telegram', code, deps) : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!code}
      >
        Войти через Telegram
      </a>
      <a
        style={SECONDARY}
        href={code ? loginUrl('google', code, deps) : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!code}
      >
        Войти через Google
      </a>
      <a
        style={SECONDARY}
        href={code ? loginUrl('vk', code, deps) : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!code}
      >
        Войти через ВКонтакте
      </a>
      {code ? <LoginTicketWait state={state} onRetry={reset} /> : null}
    </div>
  );
}
