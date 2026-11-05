import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getHost } from '../../../shared/src/host';
import { AddHomeScreenButton } from '../../../shared/src/host/AddHomeScreenButton';
import { api } from '../api';
import { useAuth } from '../auth/authContext';
import { useInstallHandoff } from '../hooks/useInstallHandoff';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { INSTALL_STEPS } from '../components/installGuide/installSteps';
import { useTr } from '../utils/addressForm';
import { AddressFormProvider } from '../utils/AddressFormProvider';
import { detectInstallPlatform, isStandalone, promptInstall, subscribeAppInstalled } from '../utils/pwaInstall';
import { ServicePage } from './service/ServicePage';
import { isAndroidWebView, loginNote } from './install/installLogic';
import { useHandoffExchange } from './install/useHandoffExchange';

type Action = 'shown' | 'add' | 'added' | 'handoff_ok' | 'handoff_failed';
// Страницу видят и анонимы: событие идёт публичным путём (userId = null).
const track = (action: Action) => api.trackPublicEvent('home_screen_offer', { action, surface: 'site_install' });

// Главная посадочная установки приложения (адрес для рекламы). Вне RequireAuth:
// сюда приходят и из браузера по ссылке, и из мессенджера по кнопке «Установить
// приложение» — с кодом передачи сессии во фрагменте (см. useHandoffExchange).
export function InstallPage() {
  return (
    <AddressFormProvider>
      <InstallContent />
    </AddressFormProvider>
  );
}

function InstallContent() {
  useEffect(() => { document.title = 'Установить приложение — Всё по схеме'; }, []);
  useHandoffExchange(track);
  const [installed, setInstalled] = useState(false);
  useEffect(() => subscribeAppInstalled(() => { setInstalled(true); track('added'); }), []);

  if (getHost().id !== 'web') return <MessengerScreen />;
  if (isStandalone()) return <Done title="Приложение уже установлено" lead="Значок на экране уже есть — приложение запускается с него." label="Открыть" />;
  if (installed) return <DoneAfterInstall />;
  return <MainScreen onInstalled={() => setInstalled(true)} />;
}

function Done({ title, lead, label }: { title: string; lead: string; label: string }) {
  return (
    <ServicePage>
      <div className="as-body">
        <div className="ds-eyebrow">Приложение</div>
        <h1 className="ds-h2">{title}</h1>
        <p className="as-lead">{lead}</p>
        <Link className="ds-btn as-cta" to="/today">{label}</Link>
      </div>
    </ServicePage>
  );
}

function DoneAfterInstall() {
  const tr = useTr();
  return (
    <Done
      title="Готово"
      lead={tr('Значок на экране. Открывай приложение с него.', 'Значок на экране. Открывайте приложение с него.')}
      label="Открыть приложение"
    />
  );
}

function MessengerScreen() {
  const tr = useTr();
  const { href } = useInstallHandoff();
  return (
    <ServicePage>
      <div className="as-body">
        <div className="ds-eyebrow">Приложение</div>
        <h1 className="ds-h2">Установить на телефон</h1>
        <p className="as-lead">{tr('Открой эту страницу в браузере', 'Откройте эту страницу в браузере')} — там ставится приложение.</p>
        <AddHomeScreenButton href={href} className="ds-btn as-cta">Открыть в браузере</AddHomeScreenButton>
      </div>
    </ServicePage>
  );
}

function MainScreen({ onInstalled }: { onInstalled: () => void }) {
  const tr = useTr();
  const { isAuthenticated } = useAuth();
  const { canPrompt } = useInstallPrompt();
  const platform = detectInstallPlatform();
  const guide = INSTALL_STEPS[platform];
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    track('shown');
  }, []);

  const install = () => {
    track('add');
    void promptInstall().then((r) => { if (r === 'accepted') onInstalled(); });
  };
  const note = loginNote(platform, isAuthenticated);
  const mobile = platform !== 'desktop';
  const webView = platform === 'android' && isAndroidWebView(navigator.userAgent);
  const hint = (
    <p className="as-hint">
      {tr(
        'Страница открылась внутри Telegram или другого приложения? Открой её в Chrome (iPhone — в Safari): меню ⋯ → «Открыть в браузере».',
        'Страница открылась внутри Telegram или другого приложения? Откройте её в Chrome (iPhone — в Safari): меню ⋯ → «Открыть в браузере».',
      )}
    </p>
  );

  return (
    <ServicePage>
      <div className="as-body">
        <div className="ds-eyebrow">Приложение</div>
        <h1 className="ds-h2">«Всё по схеме» на {mobile ? 'телефоне' : 'компьютере'}</h1>
        <p className="as-lead">
          Ставится прямо из браузера, без магазина приложений: значок на экране, запуск на весь экран, свои записи и трекер всегда под рукой.
        </p>
        {webView && !canPrompt && hint}
        {canPrompt ? (
          <button type="button" className="ds-btn as-cta" onClick={install}>Установить приложение</button>
        ) : (
          <div>
            <div className="ds-label">{guide.title}. {guide.browser}</div>
            <ol className="as-steps">{guide.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          </div>
        )}
        {mobile && !canPrompt && !webView && hint}
        <p className="as-lead">{tr(note.ty, note.vy)}</p>
      </div>
    </ServicePage>
  );
}
