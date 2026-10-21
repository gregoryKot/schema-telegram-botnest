import type { CSSProperties, ReactNode } from 'react';
import { getHost } from './index';
import { ADD_ICON_HOP_URL, homeScreenPlatform } from './homeScreen';

// Единая кнопка «добавить значок на экран» внутри мессенджера — один
// компонент на оба фронтенда и все места показа (правила №3/№11: карточка
// «Сегодня», настройки, шаг онбординга). Вид задаёт `className` фронтенда.
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
  className,
  style,
  linkStyle,
}: {
  children: ReactNode;
  /** Побочные действия при активации (снуз, аналитика, согласие). */
  onActivated?: () => void;
  className?: string;
  style?: CSSProperties;
  /** Дополнительный стиль только для iOS-варианта (якорь вместо кнопки). */
  linkStyle?: CSSProperties;
}) {
  const host = getHost();
  const platform = homeScreenPlatform(host.platform);

  if (platform === 'android' && host.capabilities.homeScreen) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        onClick={() => {
          // Нативный вызов ПЕРВЫМ, в жесте; побочные действия после.
          host.homeScreen.add();
          onActivated?.();
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <a
      className={className}
      href={ADD_ICON_HOP_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onActivated?.()}
      style={{
        textDecoration: 'none',
        boxSizing: 'border-box',
        ...linkStyle,
        ...style,
      }}
    >
      {children}
    </a>
  );
}
