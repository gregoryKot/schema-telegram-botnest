import { useState } from 'react';
import { isPracticeHost } from '../utils/domainChrome';
import { useAnySheetOpen } from '../hooks/openSheets';
import { useShellLoading } from '../hooks/shellLoading';
import { useAnyDialogOpen } from '../../../shared/src/utils/dialogStack';
import { readLocal, writeLocal } from '../../../shared/src/utils/safeLocalStorage';

const CONSENT_KEY = 'cookie_consent';

function PrivacyLink() {
  return (
    <a href="/privacy#cookies" className="cookie-link">
      Подробнее
    </a>
  );
}

// Визитка практики: входа там нет, а высокая карточка на телефоне закрывала
// главную кнопку первого экрана — поэтому одна компактная строка.
function CompactBody({ onDismiss }: { onDismiss: () => void }) {
  return (
    <>
      <p className="u-fill cookie-text">
        Публичные страницы обезличенно считают посещения в Яндекс.Метрике.{' '}
        <PrivacyLink />
      </p>
      <button onClick={onDismiss} className="ds-btn ds-btn--sm cookie-btn">
        Понятно
      </button>
    </>
  );
}

function CardBody({ onDismiss }: { onDismiss: () => void }) {
  return (
    <>
      <div className="cookie-body">
        <div className="cookie-title">Немного о куки</div>
        <p className="cookie-text">
          Часть нужна для входа — без них сайт не работает. Ещё на публичных страницах (главная, статьи, тесты) считаются обезличенные посещения в Яндекс.Метрике: сколько людей заходит и какие страницы читают. В приложении и кабинете счётчика нет.{' '}
          <PrivacyLink />
        </p>
      </div>
      <button onClick={onDismiss} className="ds-btn ds-btn--sm cookie-btn">Понятно</button>
    </>
  );
}

export function CookieBanner() {
  // Начальная видимость выводится из localStorage на маунте (lazy-init), а не
  // через setState в эффекте (react-hooks/set-state-in-effect). Значение
  // 'all' и 'necessary' из старых визитов одинаково прячут баннер.
  const [visible, setVisible] = useState(() => !readLocal(CONSENT_KEY)); // заблокированное хранилище — баннер, а не белый экран (E10)

  // Метрику баннер НЕ грузит: её включает MetrikaTracker через шлюз (lib/metrikaGate) — только
  // на публичных страницах и без сессии. Согласия счётчик не ждёт (решение владельца).
  // Баннер ждёт, пока закроются диалоги, листы и силуэт загрузки кабинета: поверх
  // согласий (zIndex 400) он закрывал «Далее», новичок видел три слоя (QA 2026-11, A-З7).
  const sheetOpen = useAnySheetOpen();
  const dialogOpen = useAnyDialogOpen();
  const shellLoading = useShellLoading();
  if (!visible || sheetOpen || dialogOpen || shellLoading) return null;

  const dismiss = () => {
    writeLocal(CONSENT_KEY, 'all');
    setVisible(false);
  };

  const compact = isPracticeHost();

  return (
    <div className="cookie-banner-wrap">
      {/* Лист соломы без контура, тень — сплошной сдвинутый слой (index.css, .cookie-banner). */}
      <div className={`pp-paper cookie-banner${compact ? ' cookie-banner--compact' : ''}`} role="dialog" aria-label="Уведомление об использовании куки">
        {compact ? <CompactBody onDismiss={dismiss} /> : <CardBody onDismiss={dismiss} />}
      </div>
    </div>
  );
}
