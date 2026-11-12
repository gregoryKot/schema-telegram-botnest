import { useEffect, useRef, useState } from 'react';
import { getHost } from '../../../shared/src/host';
import { AddHomeScreenButton } from '../../../shared/src/host/AddHomeScreenButton';
import { api } from '../api';
import { useAuth } from '../auth/authContext';
import { useInstallHandoff } from '../hooks/useInstallHandoff';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { InstallBlock } from '../components/installGuide/InstallBlock';
import { useTr } from '../utils/addressForm';
import { AddressFormProvider } from '../utils/AddressFormProvider';
import { detectInstallPlatform, isStandalone, promptInstall, subscribeAppInstalled } from '../utils/pwaInstall';
import { PaperOutcome } from '../components/paper/PaperOutcome';
import { InstallFrame } from './install/InstallFrame';
import { isAndroidWebView, loginNote } from './install/installLogic';
import { useHandoffExchange } from './install/useHandoffExchange';
import { CabinetLink } from './install/CabinetLink';
import { StepText } from '../components/NavGlyphs';

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

// «Готово» и «уже установлено» — исход done (Check на шалфее 135). Кнопка — CabinetLink (переход в кабинет
// с учётом Метрики), поэтому своим ребёнком исхода, а не action-ссылкой.
function Done({ title, lead, label }: { title: string; lead: string; label: string }) {
  return (
    <PaperOutcome outcome="done" eyebrow="Приложение" title={title} lead={lead}>
      <CabinetLink className="ds-btn ds-btn--lg pa-outcome-action">{label}</CabinetLink>
    </PaperOutcome>
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
    <InstallFrame title="Установить на телефон" lead={<>{tr('Открой эту страницу в браузере', 'Откройте эту страницу в браузере')} — там ставится приложение.</>}>
      <AddHomeScreenButton href={href} className="ds-btn ds-btn--lg ip-cta">Открыть в браузере</AddHomeScreenButton>
    </InstallFrame>
  );
}

function MainScreen({ onInstalled }: { onInstalled: () => void }) {
  const tr = useTr();
  const { isAuthenticated } = useAuth();
  const { canPrompt } = useInstallPrompt();
  const platform = detectInstallPlatform();
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
    <p className="ip-hint">
      <StepText text={tr(
        'Страница открылась внутри Telegram или другого приложения? Открой её в Chrome (iPhone — в Safari): меню ⋯ → «Открыть в браузере».',
        'Страница открылась внутри Telegram или другого приложения? Откройте её в Chrome (iPhone — в Safari): меню ⋯ → «Открыть в браузере».',
      )} />
    </p>
  );

  return (
    <InstallFrame
      title={<>«Всё по схеме» на {mobile ? 'телефоне' : 'компьютере'}</>}
      lead="Ставится прямо из браузера, без магазина приложений: значок на экране, запуск на весь экран, свои записи и трекер всегда под рукой."
    >
      {webView && !canPrompt && hint}
      {canPrompt
        ? <button type="button" className="ds-btn ds-btn--lg ip-cta" onClick={install}>Установить приложение</button>
        : <InstallBlock platforms={[platform]} look="page" />}
      {mobile && !canPrompt && !webView && hint}
      <p className="ip-note">{tr(note.ty, note.vy)}</p>
    </InstallFrame>
  );
}
