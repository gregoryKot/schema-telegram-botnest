import { useState } from 'react';
import { api } from '../api';

// Баннер «есть приложение для телефона» — только на мобильной вёрстке сайта
// (класс mobile-only). Ведёт в мини-апп /app/: по docs/PWA_PLAN.md база
// устанавливаемого приложения — он, а не сайт; вход тот же, данные общие
// (один userId). Зеркальный случай к WebBanner мини-аппа («полная версия —
// на сайте»), поэтому пары во втором фронтенде нет (см. комментарий там же).
// Тексты безличные — вилка ты/вы не нужна.

const DISMISS_KEY = 'web_banner_dismissed:mobile_app';

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function MobileAppBanner() {
  const [hidden, setHidden] = useState(isDismissed);
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

  return (
    <div className="mobile-only app-banner">
      <div className="app-banner-body">
        <div className="app-banner-title">Приложение для телефона</div>
        <div className="app-banner-text">
          Дневник, тест и практики — те же, вход тот же, а экраны собраны под
          телефон. Внутри — кнопка «значок на экран».
        </div>
        <a
          className="app-banner-cta"
          href="/app/"
          onClick={() => api.trackEvent('web_banner_open', { banner: 'mobile_app' })}
        >
          Открыть приложение
        </a>
      </div>
      {/* Крестик — цель нажатия ≥44×44 */}
      <button className="app-banner-close" aria-label="Скрыть баннер" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
