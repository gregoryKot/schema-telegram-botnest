// Пункт страницы ссылок — бумага своего вида: кнопка записи с пометкой, карточка проекта,
// записка, ярлык со значками или полоска-ссылка. Все ссылки — обычные <a href> в той же
// вкладке; клик по каждой шлёт свою цель.
import { HealthyAdultNote } from './HealthyAdultNote';
import type { ReadyLink } from './linksModel';
import { PenCurve, PenGo } from './linksPen';
import { PlaceIcons } from './PlaceIcons';
import { ProjectCard } from './ProjectCard';
import { trackLinksClick } from './trackLinksClick';

export function LinkRow({ link }: { link: ReadyLink }) {
  const { main } = link;
  if (link.kind === 'feature') return <li className="lk-item"><ProjectCard link={link} /></li>;
  if (link.quote) return <li className="lk-item"><HealthyAdultNote link={link} /></li>;
  if (!main) {
    return (
      <li className="lk-item">
        <section className="lk-paper lk-label"><h2 className="lk-label-title">{link.title}</h2><PlaceIcons link={link} /></section>
      </li>
    );
  }
  if (link.kind === 'primary') {
    return (
      <li className="lk-item lk-ask">
        <span className="lk-why lk-pen" aria-hidden>разбирать схемы не в одиночку</span>
        <PenCurve className="lk-why-arrow" />
        <a className="lk-cta" href={main.href} onClick={() => trackLinksClick(main.id)}>
          <b>{link.title}</b>
          {link.note && <small>{link.note}</small>}
        </a>
      </li>
    );
  }
  return (
    <li className="lk-item lk-strip-item">
      <a className="lk-strip" href={main.href} onClick={() => trackLinksClick(main.id)}>{link.title} <PenGo /></a>
    </li>
  );
}
