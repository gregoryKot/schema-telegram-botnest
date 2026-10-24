import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { getHost } from '../../../shared/src/host';

// Внешняя ссылка кабинета. В браузере — обычная <a target="_blank">. Внутри
// Telegram/MAX обычная ссылка открывается прямо в WebView или блокируется, поэтому
// клик уходит в host.openLink (как в мини-аппе: DonateNudge, WebBanner).
// Хост читается в момент клика: SDK мессенджера мог доехать позже первого рендера.

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> & {
  href: string;
};

/** Относительный адрес (`/donate`) хост-браузер сам не разрешит — даём полный. */
function absoluteUrl(href: string): string {
  try {
    return new URL(href, window.location.origin).href;
  } catch {
    return href;
  }
}

export function ExternalLink({ href, onClick, children, ...rest }: Props) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    const host = getHost();
    if (host.id === 'web' || e.defaultPrevented) return;
    e.preventDefault();
    host.openLink(absoluteUrl(href));
  };
  return <a {...rest} href={href} target="_blank" rel="noopener noreferrer" onClick={handle}>{children}</a>;
}
