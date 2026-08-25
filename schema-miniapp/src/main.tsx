import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { getHost } from '../../shared/src/host';
import { isStandalone } from '../../shared/src/host/web';
import { shouldOpenCabinet, CABINET_PATH } from './utils/desktopLaunch';
import './index.css';
import App from './App';
import { AddressFormProvider } from './utils/AddressFormProvider';
import { UpdateToast } from './components/UpdateToast';
import { registerServiceWorker } from './registerServiceWorker';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        style={{
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 16,
          textAlign: 'center',
          background: '#1a1a2e',
          color: '#e2e8f0',
        }}
      >
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontSize: 17, fontWeight: 600 }}>Что-то пошло не так</div>
        <div
          style={{
            fontSize: 12,
            color: '#94a3b8',
            maxWidth: 300,
            wordBreak: 'break-word',
            lineHeight: 1.6,
          }}
        >
          {error.message}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '13px 28px',
            border: 'none',
            borderRadius: 'var(--r-14)',
            background: '#7c3aed',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Повторить
        </button>
      </div>
    );
  }
}

// Развилка запуска установленного приложения (utils/desktopLaunch): на
// компьютере полноценнее кабинет сайта, на телефоне — мини-апп. Решаем ДО
// рендера, иначе мелькнёт мобильный экран перед уходом.
if (
  shouldOpenCabinet({
    standalone: isStandalone(),
    hostId: getHost().id,
    width: window.innerWidth,
    pointerFine: window.matchMedia?.('(pointer: fine)').matches === true,
    search: window.location.search,
  })
) {
  window.location.replace(CABINET_PATH);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AddressFormProvider>
        <App />
        {/* Внутри AddressFormProvider ради useTr (форма обращения) — сам
            тост не fullscreen, useHistorySheet не нужен (см. её комментарий). */}
        <UpdateToast />
      </AddressFormProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Только в web-хосте (registerServiceWorker сама проверяет), фаза 1
// docs/PWA_PLAN.md.
// Не сразу: после каждого деплоя SW первым делом перекачивает весь прекеш
// (~1.3МБ, 48 файлов) — прямо в разгар стартового шторма первой минуты,
// конкурируя с данными и тапами («первую минуту ужасно», 2026-08-24).
// Старый SW продолжает отдавать статику из кеша; свежая версия доедет на
// 20 секунд позже — к моменту, когда пользователь уже осмотрелся.
setTimeout(registerServiceWorker, 20_000);
