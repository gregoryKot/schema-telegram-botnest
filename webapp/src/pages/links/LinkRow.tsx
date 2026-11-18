// Пункт страницы ссылок: основная ссылка и значки площадок. Все ссылки — обычные
// <a href> в той же вкладке; клик по каждой шлёт свою цель.
import type { ReadyLink } from './linksModel';
import { PlaceIcons } from './PlaceIcons';
import { trackLinksClick } from './trackLinksClick';

const isExternal = (href: string) => /^https?:/.test(href);

function LinkBody({ link }: { link: ReadyLink }) {
  return (
    <span className="lk-text">
      {link.kind === 'feature' && <span className="lk-eyebrow">Проект</span>}
      <span className="lk-title">{link.title}</span>
      {link.note && <span className="lk-note">{link.note}</span>}
    </span>
  );
}

export function LinkRow({ link }: { link: ReadyLink }) {
  const { main } = link;
  // Без основной ссылки пункт — строка: название слева, значки справа (с подписью — под ней).
  if (!main) {
    return (
      <li className="lk-item">
        <div className={`lk lk-static${link.note ? ' lk-static-noted' : ''}`}><LinkBody link={link} /><PlaceIcons link={link} /></div>
      </li>
    );
  }
  const body = (
    <a className={`lk lk-${link.kind}`} href={main.href} onClick={() => trackLinksClick(main.id)}>
      <LinkBody link={link} />
      <span className="lk-arrow" aria-hidden>{isExternal(main.href) ? '↗' : '→'}</span>
    </a>
  );
  if (!link.places.length) return <li className="lk-item">{body}</li>;
  // Значки — соседи основной ссылки, не её дети: рамку держит пункт.
  return <li className="lk-item lk-stack">{body}<PlaceIcons link={link} /></li>;
}
