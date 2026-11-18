// Пункт страницы ссылок: основная ссылка и ярлычки площадок. Все ссылки — обычные
// <a href> в той же вкладке; клик по каждой шлёт свою цель.
import type { ReadyLink } from './linksModel';
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

/** Ярлычки площадок — соседи основной ссылки, не её дети. */
function Places({ link }: { link: ReadyLink }) {
  return (
    <div className="lk-places">
      {link.placesLabel && <span className="lk-places-label">{link.placesLabel}</span>}
      <div className="lk-chips">
        {link.places.map((p) => (
          <a key={p.id} className="lk-chip" href={p.href} onClick={() => trackLinksClick(p.id)}>{p.title}</a>
        ))}
      </div>
    </div>
  );
}

export function LinkRow({ link }: { link: ReadyLink }) {
  const { main } = link;
  const body = main ? (
    <a className={`lk lk-${link.kind}`} href={main.href} onClick={() => trackLinksClick(main.id)}>
      <LinkBody link={link} />
      <span className="lk-arrow" aria-hidden>{isExternal(main.href) ? '↗' : '→'}</span>
    </a>
  ) : <div className="lk lk-static"><LinkBody link={link} /></div>;
  if (!link.places.length) return <li className="lk-item">{body}</li>;
  return (
    <li className={`lk-item lk-stack lk-stack-${link.kind}`}>
      {body}
      <Places link={link} />
    </li>
  );
}
