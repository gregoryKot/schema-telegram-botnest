import { useState } from 'react';
import { api } from '../api';
import {
  WebBannerId,
  isWebBannerDismissed,
  dismissWebBanner,
} from '../utils/webBanner';

// Скрываемый баннер «полная версия — на сайте» для кабинета терапевта.
// Мини-апп-специфичен по смыслу (сайт сам себя не рекламирует), поэтому
// пары в webapp нет. Тексты — безличные, вилка ты/вы не нужна.
export function WebBanner({
  id,
  emoji,
  title,
  text,
  url,
}: {
  id: WebBannerId;
  emoji: string;
  title: string;
  text: string;
  url: string;
}) {
  const [hidden, setHidden] = useState(() => isWebBannerDismissed(id));
  if (hidden) return null;

  const open = () => {
    api.trackEvent('web_banner_open', { banner: id });
    const tg = window.Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(url);
    else window.open(url, '_blank');
  };
  const dismiss = () => {
    api.trackEvent('web_banner_dismiss', { banner: id });
    dismissWebBanner(id);
    setHidden(true);
  };

  return (
    <div
      style={{
        background: 'color-mix(in srgb, var(--accent) 7%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
        borderRadius: 16,
        padding: '13px 14px',
        marginBottom: 12,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: 20, lineHeight: '24px', flexShrink: 0 }}>
        {emoji}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            lineHeight: 1.5,
            marginBottom: 8,
          }}
        >
          {text}
        </div>
        <button
          onClick={open}
          style={{
            background: 'color-mix(in srgb, var(--accent) 16%, transparent)',
            border: 'none',
            borderRadius: 10,
            padding: '7px 14px',
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          Открыть на сайте ↗
        </button>
      </div>
      {/* Крестик — цель нажатия ≥44×44 */}
      <button
        onClick={dismiss}
        aria-label="Скрыть баннер"
        style={{
          width: 44,
          height: 44,
          margin: '-13px -14px 0 -8px',
          flexShrink: 0,
          background: 'none',
          border: 'none',
          color: 'var(--text-faint)',
          fontSize: 15,
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  );
}
