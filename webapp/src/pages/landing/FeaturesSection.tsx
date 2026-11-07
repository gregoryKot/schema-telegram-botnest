import type { CSSProperties } from 'react';
import { FEATURES } from './productContent';
import { HOME_HEADINGS } from '../../../../src/articles/home-landing.content';
import '../../styles/product-landing-journal.css';

// «Возможности» — не шесть одинаковых карточек, а журнальная полоса: два крупных
// разворота со сценой (у пункта есть `Scene`) и четыре квадрата цветной бумаги со
// знаком. У каждой бумаги свой оттенок `--h` (productContent.ts), под бумагой —
// сплошной слой тени того же оттенка. Вид — styles/product-landing-journal.css.
export function FeaturesSection() {
  return (
    <section id="features" className="pl2-sec">
      <div className="pl2-wrap">
        <span className="pl2-eyebrow">Возможности</span>
        <h2 className="pl2-h2">{HOME_HEADINGS.features}</h2>
        <div className="pl2-bento">
          {FEATURES.map(({ id, Art, Scene, hue, title, text }) => (
            <article key={id} className={`pp-paper pl2-feat pl2-feat--${id}${Scene ? ' pl2-feat--big' : ''}`} style={{ '--h': hue } as CSSProperties}>
              {Scene ? <div className="pl2-feat-scene"><Scene hue={hue} /></div> : <Art size="square" />}
              <div className="pl2-feat-body">
                <h3 className="pl2-feat-title">{title}</h3>
                <p className="pl2-feat-text">{text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
