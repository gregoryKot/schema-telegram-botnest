// Жёлтая записка — единственное цветное пятно страницы: канал «Здоровый Взрослый»,
// что это за режим, «?» с примерами посланий и значки площадок.
import type { ReadyLink } from './linksModel';
import { MoreInfo } from './MoreInfo';
import { PlaceIcons } from './PlaceIcons';

export function HealthyAdultNote({ link }: { link: ReadyLink }) {
  return (
    <section className="lk-box lk-note">
      <div className="lk-head">
        <h2>{link.title}</h2>
        {link.note && <p className="lk-note-text">{link.note}</p>}
        {link.more && <MoreInfo more={link.more} />}
      </div>
      <PlaceIcons link={link} />
    </section>
  );
}
