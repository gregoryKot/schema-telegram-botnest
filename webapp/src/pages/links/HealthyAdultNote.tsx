// Жёлтая записка — единственное цветное пятно страницы: канал «Здоровый Взрослый»,
// строка из него и значки площадок.
import type { ReadyLink } from './linksModel';
import { PlaceIcons } from './PlaceIcons';

export function HealthyAdultNote({ link }: { link: ReadyLink }) {
  return (
    <section className="lk-box lk-note">
      <h2 className="lk-note-title">{link.title}{link.note && <small>{link.note}</small>}</h2>
      <blockquote className="lk-quote">{link.quote}</blockquote>
      <PlaceIcons link={link} />
    </section>
  );
}
