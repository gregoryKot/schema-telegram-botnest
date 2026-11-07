import type { CSSProperties } from 'react';
import { STEPS } from './productContent';
import { HOME_HEADINGS } from '../../../../src/articles/home-landing.content';
import '../../styles/product-landing-journal.css';

// «Как это работает» — журнальный разворот: у каждого шага крупная сцена на пятне
// цветной бумаги (components/art/LandingScenes.tsx), сцена то слева, то справа;
// крупный засечный номер цветом бумаги шага. Вид — styles/product-landing-journal.css.
export function HowSection() {
  return (
    <section id="how" className="pl2-sec pl2-how">
      <div className="pl2-wrap">
        <span className="pl2-eyebrow">Как это работает</span>
        <h2 className="pl2-h2">{HOME_HEADINGS.how}</h2>
        <ol className="pl2-steps">
          {STEPS.map(({ id, num, Scene, hue, title, text }) => (
            <li key={id} className={`pl2-spread pl2-spread--${id}`} style={{ '--h': hue } as CSSProperties}>
              <div className="pl2-spread-art"><Scene /></div>
              <div className="pl2-spread-body">
                <span className="pl2-spread-num" aria-hidden="true">{num}</span>
                <h3 className="pl2-spread-title">{title}</h3>
                <p className="pl2-spread-text">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
