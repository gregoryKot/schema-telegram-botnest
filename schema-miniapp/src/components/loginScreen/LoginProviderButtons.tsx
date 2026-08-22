import type { CSSProperties } from 'react';

// Ключ синхронизирован с webapp/src/pages/AuthCallback.tsx — туда бэкенд
// после OAuth редиректит и оттуда возвращает обратно в мини-апп.
const RETURN_TO_KEY = 'auth_return_to';
const APP_PATH = '/app/';

/** Кладём «куда вернуться» ДО ухода на редирект — иначе после входа человека
 * выкинет на сайт и он не найдёт дорогу обратно в приложение. */
function goToProvider(path: string): void {
  sessionStorage.setItem(RETURN_TO_KEY, APP_PATH);
  window.location.href = path;
}

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

/** Кнопки входа: переход на редирект-эндпоинт бэкенда (правило CLAUDE.md
 * «одна механика — один компонент» — единственное место со списком провайдеров). */
export function LoginProviderButtons() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
        marginTop: 16,
      }}
    >
      <button
        style={PRIMARY}
        onClick={() => goToProvider('/api/auth/telegram/redirect')}
      >
        Войти через Telegram
      </button>
      <button
        style={SECONDARY}
        onClick={() => goToProvider('/api/auth/google')}
      >
        Войти через Google
      </button>
      <button style={SECONDARY} onClick={() => goToProvider('/api/auth/vk')}>
        Войти через ВКонтакте
      </button>
    </div>
  );
}
