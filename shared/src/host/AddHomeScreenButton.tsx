import type { CSSProperties, ReactNode } from 'react';
import { getHost } from './index';
import { homeScreenPlatform } from './homeScreen';

// Единая кнопка «установить приложение» внутри мессенджера (карточка «Сегодня»,
// настройки, страница /install). Вид задаёт `className` фронтенда. Ведёт на
// наш сайт (`href`) во внешнем браузере, где ставится настоящее PWA, а не
// ярлык мини-аппа, привязанный к мессенджеру.
//
// Android — openLink: документированный путь Telegram «открыть во внешнем
// браузере». Остальное (iOS и прочее) — НАСТОЯЩАЯ ссылка <a target="_blank">:
// на iOS openLink молча умирает (гейт lastTouchTimestamp в web_app_open_link),
// а тап по якорю идёт через навигационную политику WKWebView, которую Telegram
// обрабатывает как внешнюю навигацию и открывает браузер.
export function AddHomeScreenButton({
  href,
  children,
  onActivated,
  className,
  style,
  linkStyle,
}: {
  href: string;
  children: ReactNode;
  /** Побочные действия при активации (снуз, аналитика). */
  onActivated?: () => void;
  className?: string;
  style?: CSSProperties;
  /** Дополнительный стиль только для варианта-якоря (вместо кнопки). */
  linkStyle?: CSSProperties;
}) {
  const host = getHost();
  const platform = homeScreenPlatform(host.platform);

  if (platform === 'android' && host.id !== 'web') {
    return (
      <button
        type="button"
        className={className}
        style={style}
        onClick={() => {
          // Открытие браузера ПЕРВЫМ, в жесте; побочные действия после.
          host.openLink(href);
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
      href={href}
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
