// Язык знаков приложения — коротко новичку (docs/design/PAPER_2026-11.md, «Язык знаков»).
import { SignArt } from '../art/SignArt';
import { LEGEND } from './legendText';
/** Легенда «Что означают картинки»: знак, слово, смысл — сеткой (на компьютере в две колонки). */
export function WhyLegend() {
  return (
    <section className="cw-legend" aria-label="Что означают картинки">
      <div className="ds-label">Что означают картинки</div>
      <dl className="cw-legend-list">
        {LEGEND.map(([word, meaning, sign]) => (
          <div key={word} className="cw-legend-row"><dt><span className="pp-row-art"><SignArt sign={sign} size="row" /></span>{word}</dt><dd>{meaning}</dd></div>
        ))}
      </dl>
    </section>
  );
}
