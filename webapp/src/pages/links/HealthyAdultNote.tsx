// Записка на кнопке: строка из канала «Здоровый Взрослый», что это за канал и значки площадок.
import type { ReadyLink } from './linksModel';
import { PlaceIcons } from './PlaceIcons';

export function HealthyAdultNote({ link }: { link: ReadyLink }) {
  return (
    <section className="lk-paper lk-sticky">
      <span className="lk-pin" aria-hidden />
      <blockquote className="lk-quote">{link.quote}</blockquote>
      <p className="lk-sig"><span aria-hidden>— </span>{link.title}</p>
      {link.note && <p className="lk-about">{link.note}</p>}
      <div className="lk-line"><PlaceIcons link={link} /></div>
    </section>
  );
}
