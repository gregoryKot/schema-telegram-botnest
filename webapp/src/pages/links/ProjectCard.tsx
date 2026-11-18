// Карточка проекта на линованном листе: знак и название, строки «для кого», кнопка-переход
// и значки ботов. Кнопка и значки — соседи, ссылок внутри ссылок нет.
import { BrandMark } from '../../components/art/BrandMark';
import type { ReadyLink } from './linksModel';
import { PenGo, PenTick } from './linksPen';
import { PlaceIcons } from './PlaceIcons';
import { trackLinksClick } from './trackLinksClick';

export function ProjectCard({ link }: { link: ReadyLink }) {
  const { main } = link;
  return (
    <section className="lk-paper lk-tape lk-card">
      <span className="lk-aside lk-pen" aria-hidden>выросло из моей практики</span>
      <div className="lk-card-top"><BrandMark size={52} /><h2 className="lk-card-title">{link.title}</h2></div>
      <ul className="lk-roles">
        {link.roles?.map((r) => <li key={r.who} className="lk-role"><PenTick /><span><b>{r.who}</b> — {r.what}</span></li>)}
      </ul>
      {main && link.cta && (
        <a className="lk-open" href={main.href} onClick={() => trackLinksClick(main.id)}>{link.cta} <PenGo /></a>
      )}
      {link.places.length > 0 && (
        <div className="lk-line"><span>{link.placesLabel}</span><PlaceIcons link={link} /></div>
      )}
    </section>
  );
}
