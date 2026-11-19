// Жёлтая записка — единственное цветное пятно страницы: канал «Здоровый Взрослый»,
// что это за режим и значки площадок.
import type { ReadyLink } from './linksModel';
import { PlaceIcons } from './PlaceIcons';

export function HealthyAdultNote({ link }: { link: ReadyLink }) {
  return (
    <section className="lk-box lk-note">
      <h2>{link.title}</h2>
      {link.note && <p className="lk-note-text">{link.note}</p>}
      <PlaceIcons link={link} />
    </section>
  );
}
