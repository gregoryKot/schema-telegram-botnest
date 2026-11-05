// Язык знаков приложения — коротко новичку (docs/design/PAPER_2026-11.md, «Язык знаков»).
import { LEGEND } from './legendText';

/** Легенда «Что означают картинки»: знак — смысл. */
export function WhyLegend() {
  return (
    <section className="cw-legend" aria-label="Что означают картинки">
      <div className="ds-label">Что означают картинки</div>
      <dl className="cw-legend-list">
        {LEGEND.map(([sign, meaning]) => (
          <div key={sign} className="cw-legend-row"><dt>{sign}</dt><dd>{meaning}</dd></div>
        ))}
      </dl>
    </section>
  );
}
