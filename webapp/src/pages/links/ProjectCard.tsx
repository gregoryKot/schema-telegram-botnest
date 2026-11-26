// Карточка проекта: знак и название с «?», строка «что это» (под ней — раскрытие), кнопка-переход и значки ботов.
// Кнопка и значки — соседи, ссылок внутри ссылок нет.
import { BrandMark } from '../../components/art/BrandMark';
import type { ReadyLink } from './linksModel';
import { MoreInfo } from './MoreInfo';
import { PlaceIcons } from './PlaceIcons';
import { trackLinksClick } from './trackLinksClick';

export function ProjectCard({ link }: { link: ReadyLink }) {
  const { main } = link;
  return (
    <section className="lk-box lk-card">
      <div className="lk-head lk-card-top">
        <BrandMark size={34} /><h2 className="lk-card-title">{link.title}</h2>
        {link.note && <p className="lk-card-note">{link.note}</p>}
        {link.more && <MoreInfo more={link.more} />}
      </div>
      <div className="lk-card-go">
        {main && link.cta && (
          <a className="lk-open" href={main.href} onClick={() => trackLinksClick(main.id)}>{link.cta} <span aria-hidden>→</span></a>
        )}
        {link.places.length > 0 && <span className="lk-or">или бот:</span>}
        <PlaceIcons link={link} />
      </div>
    </section>
  );
}
