import type { CSSProperties } from 'react';
import { STEPS } from './productContent';
import { PaperBand } from './PaperBand';
import { HOME_HEADINGS } from '../../../../src/articles/home-landing.content';
import { glue } from './typo';
import '../../styles/product-landing-journal.css';

// «Как это работает» — журнальный разворот на полосе соломенной бумаги (PaperBand): у
// каждого шага крупная сцена на вырезанном листе своей бумаги (components/art/
// LandingScenes.tsx), сцена то слева, то справа; крупный засечный номер цветом бумаги
// шага. Вид — styles/product-landing-journal.css.
export function HowSection() {
  return (
    <PaperBand id="how">
      <div className="pl2-wrap">
        <span className="pl2-eyebrow">Как это работает</span>
        <h2 className="pl2-h2">{glue(HOME_HEADINGS.how)}</h2>
        <ol className="pl2-steps">
          {STEPS.map(({ id, num, Scene, hue, title, text }) => (
            <li key={id} className={`pl2-spread pl2-spread--${id}`} style={{ '--h': hue } as CSSProperties}>
              <div className="pl2-spread-art"><Scene hue={hue} /></div>
              <div className="pl2-spread-body">
                <span className="pl2-spread-num" aria-hidden="true">{num}</span>
                <h3 className="pl2-spread-title">{glue(title)}</h3>
                <p className="pl2-spread-text">{glue(text)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </PaperBand>
  );
}
