import { glue } from '../../../../shared/src/utils/typo';
import { SignArt } from '../art/SignArt';
import { LEGEND } from './legendText';
/** Язык знаков новичку (PAPER_2026-11.md): знак, слово, смысл сеткой; смысл через glue — «с / него» не висит. */
export function WhyLegend() {
  return (
    <section className="cw-legend" aria-label="Что означают картинки">
      <div className="ds-label">Что означают картинки</div>
      <dl className="cw-legend-list">
        {LEGEND.map(([word, meaning, sign]) => (
          <div key={word} className="cw-legend-row"><dt><span className="pp-row-art"><SignArt sign={sign} size="row" /></span>{word}</dt><dd>{glue(meaning)}</dd></div>
        ))}
      </dl>
    </section>
  );
}
