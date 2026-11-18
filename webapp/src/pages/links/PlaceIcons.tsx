// Значки площадок-зеркал пункта: круглые ссылки с одноцветным контуром. Площадка текстом
// не подписана — доступное имя даёт aria-label. Знак MAX — нейтральная «M», не логотип.
import type { ReactNode } from 'react';
import { hitboxStyle } from '../../../../shared/src/utils/hitbox';
import type { PlaceLink, ReadyLink } from './linksModel';
import { trackLinksClick } from './trackLinksClick';

type Place = PlaceLink['title'];

const GLYPH: Record<Place, ReactNode> = {
  Telegram: <path d="M21 3.5 3 10.4l5.6 2.2 2.1 6.4 3.2-3.9 4.6 3.4L21 3.5ZM8.6 12.6l8-5.4" />,
  MAX: <path d="M5.5 17.5v-11l6.5 7 6.5-7v11" />,
  Threads: <><circle cx="12" cy="12" r="3.6" /><path d="M15.6 8.4v4.8a2.5 2.5 0 0 0 5 0V12a8.6 8.6 0 1 0-3.4 6.85" /></>,
  ВКонтакте: <path d="m3.5 7 3.4 10L10.3 7M14 7v10m6.5-10L14 12.2l6.5 4.8" />,
};
const WHERE: Record<Place, string> = { Telegram: 'в Telegram', MAX: 'в MAX', Threads: 'в Threads', ВКонтакте: 'во ВКонтакте' };

const hit = hitboxStyle(36, 36);

export function PlaceIcons({ link }: { link: ReadyLink }) {
  return (
    <span className="lk-places">
      {link.placesLabel && <span className="lk-places-label">{link.placesLabel}</span>}
      {link.places.map((p) => {
        const name = `${link.placesName ?? link.title} ${WHERE[p.title]}`;
        return (
          <a key={p.id} className="lk-place" style={hit.outer} href={p.href} aria-label={name} title={name} onClick={() => trackLinksClick(p.id)}>
            <span className="lk-place-dot" style={hit.inner}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {GLYPH[p.title]}
              </svg>
            </span>
          </a>
        );
      })}
    </span>
  );
}
