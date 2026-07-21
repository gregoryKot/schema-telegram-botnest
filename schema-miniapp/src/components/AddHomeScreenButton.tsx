import type { CSSProperties, ReactNode } from 'react';
import { ADD_ICON_HOP_URL, homeScreenPlatform } from '../utils/homeScreen';

// Единая кнопка «добавить значок на экран» (одна механика — один компонент).
//
// Android — нативный WebApp.addToHomeScreen(), работает штатно.
// iOS — НАСТОЯЩАЯ ссылка <a target="_blank">, а не postEvent: на устройстве
// пользователя молча умирают и addToHomeScreen (x-safari-https в клиенте), и
// openLink (гейт lastTouchTimestamp в web_app_open_link). Тап по якорю идёт
// через навигационную политику WKWebView — совсем другой механизм, который
// Telegram обрабатывает как внешнюю навигацию и открывает браузер.
// Ссылка ведёт на прыжковую страницу нашего домена (add-icon.html), она
// переправляет на t.me-инструкцию добавления значка.
export function AddHomeScreenButton({
  children,
  onActivated,
  style,
}: {
  children: ReactNode;
  /** Побочные действия при активации (снуз, аналитика, согласие). */
  onActivated?: () => void;
  style?: CSSProperties;
}) {
  const platform = homeScreenPlatform(window.Telegram?.WebApp?.platform);

  if (platform === 'android') {
    return (
      <button
        className="btn-primary"
        style={style}
        onClick={() => {
          // Нативный вызов ПЕРВЫМ, в жесте; побочные действия после.
          window.Telegram?.WebApp?.addToHomeScreen?.();
          onActivated?.();
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <a
      className="btn-primary"
      href={ADD_ICON_HOP_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onActivated?.()}
      style={{
        display: 'block',
        textAlign: 'center',
        textDecoration: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </a>
  );
}
