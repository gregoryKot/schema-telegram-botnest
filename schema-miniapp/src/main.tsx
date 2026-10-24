import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { getHost } from '../../shared/src/host';
import { isStandalone } from '../../shared/src/host/web';
import { ensureHostOwner } from '../../shared/src/auth/hostOwnerGuard';
import { shouldOpenCabinet, CABINET_PATH } from './utils/desktopLaunch';
import './index.css';
// Классы-утилиты — строго ПОСЛЕ index.css (почему — в самом файле).
import '../../shared/src/theme/utilities.css';
import App from './App';
import { AddressFormProvider } from './utils/AddressFormProvider';
import { UpdateToast } from './components/UpdateToast';
import { PerfHud } from './components/PerfHud';
import { registerServiceWorker } from './registerServiceWorker';
import {
  perfMark,
  startJankMonitor,
  startTimerMonitor,
  watchVisibility,
  scheduleBenchmarks,
} from './utils/perfLog';
import { applyExperiments } from './utils/perfExperiments';

// Метка «js»: время от старта страницы до исполнения бандла (сеть + парсинг).
// Мониторы и бенчмарк работают только при включённой панели замеров.
perfMark('js');
startJankMonitor();
startTimerMonitor();
watchVisibility();
scheduleBenchmarks();
applyExperiments();

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

// До рендера: данные прежнего аккаунта не должны попасть в первый кадр (E-1).
ensureHostOwner();
// Развилка запуска установленного приложения (utils/desktopLaunch): на компьютере
// кабинет сайта, на телефоне — мини-апп. Решаем ДО рендера, иначе мелькнёт экран.
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
        {/* Панель замеров — вне App: живёт и на экране-скелетоне загрузки. */}
        <PerfHud />
      </AddressFormProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Только в web-хосте (docs/PWA_PLAN.md, фаза 1). Эксперимент 2026-08-25: функция
// СНИМАЕТ установленный SW и чистит кеши (шапка registerServiceWorker.ts).
// 5 секунд — вне первых кадров, но чистка успеет до сворачивания.
setTimeout(registerServiceWorker, 5_000);
