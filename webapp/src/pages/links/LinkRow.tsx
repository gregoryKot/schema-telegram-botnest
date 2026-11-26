// Пункт страницы ссылок: кнопка записи, кнопка «о себе», карточка проекта, записка или строка списка
// (ссылка либо название со значками). Все ссылки — обычные <a href> в той же вкладке;
// клик по каждой шлёт свою цель.
import { HealthyAdultNote } from './HealthyAdultNote';
import type { ReadyLink } from './linksModel';
import { MoreInfo } from './MoreInfo';
import { PlaceIcons } from './PlaceIcons';
import { ProjectCard } from './ProjectCard';
import { trackLinksClick } from './trackLinksClick';

export function LinkRow({ link }: { link: ReadyLink }) {
  const { main } = link;
  if (link.kind === 'feature') return <li className="lk-item"><ProjectCard link={link} /></li>;
  if (link.kind === 'note') return <li className="lk-item"><HealthyAdultNote link={link} /></li>;
  if (!main) {
    return (
      <li className="lk-row">
        <div className="lk-row-in lk-head"><h2>{link.title}</h2>{link.more && <MoreInfo more={link.more} />}<PlaceIcons link={link} /></div>
      </li>
    );
  }
  if (link.kind === 'primary') {
    return (
      <li className="lk-item">
        <a className="lk-cta" href={main.href} onClick={() => trackLinksClick(main.id)}>
          <b>{link.title}</b>
          {link.note && <small>{link.note}</small>}
        </a>
      </li>
    );
  }
  if (link.kind === 'secondary') {
    return (
      <li className="lk-item lk-item--sub">
        <a className="lk-sub" href={main.href} onClick={() => trackLinksClick(main.id)}>{link.title} <span className="lk-go" aria-hidden>→</span></a>
      </li>
    );
  }
  return (
    <li className="lk-row">
      <a className="lk-row-in" href={main.href} onClick={() => trackLinksClick(main.id)}>{link.title} <span className="lk-go" aria-hidden>→</span></a>
    </li>
  );
}
