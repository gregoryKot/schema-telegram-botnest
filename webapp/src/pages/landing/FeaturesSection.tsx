import type { CSSProperties } from 'react';
import { FEATURES } from './productContent';
import { SignScene } from '../../components/art/SceneParts';
import { HOME_HEADINGS } from '../../../../src/articles/home-landing.content';
import { glue } from '../../../../shared/src/utils/typo';
import '../../styles/product-landing-journal.css';

// «Возможности» — бенто из плиток цветной бумаги в 4 колонки без дыр: ряды 2+1+1 и
// 1+1+2 (планшет — 2 колонки, телефон — плитка строкой). В каждой плитке крупная
// картинка: у пункта со сценой (`Scene`) — сцена, у остальных — знак кабинета крупно с
// тенью-вырезкой (SignScene), а не перерисованный знак. В широкой плитке картинка
// справа. Плитки — не ссылки: реакции на наведение нет. Оттенки — productContent.ts.
// Вид — styles/product-landing-journal.css.
export function FeaturesSection() {
  return (
    <section id="features" className="pl2-sec">
      <div className="pl2-wrap">
        <span className="pl2-eyebrow">Возможности</span>
        <h2 className="pl2-h2">{glue(HOME_HEADINGS.features)}</h2>
        <div className="pl2-bento">
          {FEATURES.map(({ id, Art, Scene, hue, wide, title, text }) => (
            <article key={id} className={`pp-paper pl2-tile${wide ? ' pl2-tile--wide' : ''}`} style={{ '--h': hue } as CSSProperties}>
              <div className={`pl2-tile-art${Scene ? '' : ' pl2-tile-art--sign'}`}>{Scene ? <Scene hue={hue} /> : <SignScene Art={Art} />}</div>
              <div className="pl2-tile-body">
                <h3 className="pl2-tile-title">{glue(title)}</h3>
                <p className="pl2-tile-text">{glue(text)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
