import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { isStandalone, subscribeAppInstalled } from '../utils/pwaInstall';
import { InstallAppGuide } from './installGuide/InstallAppGuide';

// Баннер «есть приложение для телефона» — только на мобильной вёрстке сайта
// (класс mobile-only). Ведёт в мини-апп /app/: по docs/PWA_PLAN.md база
// устанавливаемого приложения — он, а не сайт; вход тот же, данные общие
// (один userId). Кроме перехода — разворачиваемая инструкция «значок на
// экран» (InstallAppGuide): просто ссылка значок не ставит, установка идёт
// через нативный промпт браузера или шаги руками. Зеркальный случай к
// WebBanner мини-аппа («полная версия — на сайте»), поэтому пары во втором
// фронтенде нет. Тексты безличные — вилка ты/вы не нужна.

const DISMISS_KEY = 'web_banner_dismissed:mobile_app';

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function MobileAppBanner() {
  // Открыто как установленное приложение — предлагать его же бессмысленно.
  const [hidden, setHidden] = useState(() => isStandalone() || isDismissed());
  const [showGuide, setShowGuide] = useState(false);

  const onInstallClick = useCallback(() => {
    api.trackEvent('home_screen_offer', { action: 'add', surface: 'site_banner' });
  }, []);

  // 'added' — на уровне баннера, не внутри разворачиваемой инструкции:
  // appinstalled приходит через секунды после согласия, когда инструкция
  // уже может быть свёрнута, а событие — единственный достоверный признак
  // установки (иначе в /stats занижается конверсия add→added).
  useEffect(
    () =>
      subscribeAppInstalled(() =>
        api.trackEvent('home_screen_offer', { action: 'added', surface: 'site_banner' }),
      ),
    [],
  );

  if (hidden) return null;

  const dismiss = () => {
    api.trackEvent('web_banner_dismiss', { banner: 'mobile_app' });
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // localStorage недоступен (приватный режим) — скроется до перезагрузки
    }
    setHidden(true);
  };

  const toggleGuide = () => {
    if (!showGuide) {
      api.trackEvent('home_screen_offer', { action: 'shown', surface: 'site_banner' });
    }
    setShowGuide((v) => !v);
  };

  return (
    <div className="mobile-only app-banner">
      <div className="app-banner-head">
        <img src="/icon-192.png" alt="" className="app-banner-icon" />
        <div className="app-banner-body">
          <div className="app-banner-title">Всё по схеме</div>
          <div className="app-banner-sub">приложение для телефона</div>
        </div>
        {/* Крестик — цель нажатия ≥44×44 */}
        <button className="app-banner-close" aria-label="Скрыть баннер" onClick={dismiss}>
          ✕
        </button>
      </div>
      <div className="app-banner-text">
        Экраны собраны под телефон, вход и данные — те же, что здесь.
      </div>
      <div className="app-banner-actions">
        <a
          className="app-banner-cta"
          href="/app/"
          onClick={() => api.trackEvent('web_banner_open', { banner: 'mobile_app' })}
        >
          Открыть приложение
        </a>
        <button
          className="app-banner-secondary"
          onClick={toggleGuide}
          aria-expanded={showGuide}
        >
          Значок на экран {showGuide ? '▴' : '▾'}
        </button>
      </div>
      {showGuide && <InstallAppGuide onInstallClick={onInstallClick} />}
    </div>
  );
}
