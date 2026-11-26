import type { CSSProperties, ReactNode } from 'react';
import { BAND_HUE } from './productContent';
import '../../styles/product-landing-journal.css';

// Полоса цветной бумаги во всю ширину лендинга (docs/design/PAPER_2026-11.md): секции
// чередуют бумагу страницы и лист оттенка секции `id` (BAND_HUE в productContent.ts: «Как
// это работает» — солома, «Приложение» — небо, «Вопросы» — шалфей). Край — срезанный
// ножницами лист в два слоя: из-под верхнего выглядывает лист глубже. Отрезки прямые,
// не волна: волна читалась «детсадом» (судьи 2026-11). Без размытия и без теней.
// `calm` — бумага на тон спокойнее: небо при общей насыщенности выходит голубее соломы
// и шалфея. Вид — .pl2-band в styles/product-landing-journal.css.

/** Край листа: у нижнего слоя свой срез — изломы не там, где у верхнего, и выглядывает он
 *  неравномерно, на 3–8 единиц, как подложенный лист, а не обводка (сверено по точкам). */
const UNDER = 'M0 24 V3 L60 6 L125 0 L350 11 L500 1 L640 8 L750 11 L860 3 L1085 10 L1200 7 V24 Z';
const TOP = 'M0 24 V11 L150 7 L320 15 L530 8 L720 16 L890 9 L1050 15 L1200 10 V24 Z';

function PaperEdge({ bottom }: { bottom?: boolean }) {
  return (
    <svg className={`pl2-edge${bottom ? ' pl2-edge--bottom' : ''}`} viewBox="0 0 1200 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="pl2-edge-under" d={UNDER} />
      <path className="pl2-edge-top" d={TOP} />
    </svg>
  );
}

export function PaperBand({ id, calm, children }: { id: keyof typeof BAND_HUE; calm?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={`pl2-sec pl2-band${calm ? ' pl2-band--calm' : ''}`} style={{ '--h': BAND_HUE[id] } as CSSProperties}>
      <PaperEdge />
      {children}
      <PaperEdge bottom />
    </section>
  );
}
