// «Поделиться» после хука: системное окно телефона, а где его нет — окно Telegram. Ссылка несёт метку ?src=share.
import { trackEvent } from '../analytics';

export const SHARE_URL = 'https://schemehappens.ru/game/?src=share';
type Nav = { share?: (data: { text: string; url: string }) => Promise<void> };

export function shareWeek(text: string, nav: Nav = navigator, open: (url: string) => void = u => { window.open(u, '_blank'); }) {
  trackEvent('game_share', { from: 'hook' });
  if (typeof nav.share === 'function') { nav.share({ text, url: SHARE_URL }).catch(() => undefined); return; }
  open(`https://t.me/share/url?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(text)}`);
}
