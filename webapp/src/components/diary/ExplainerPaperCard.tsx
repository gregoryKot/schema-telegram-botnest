import type { CSSProperties } from 'react';

/** Карточка «Схема»/«Режим» пустых «Записей»: цветная бумага (персик/небо), без значка — картинка только крупным акцентом (docs/design/PAPER_2026-11.md). */
const PAPER_CARD = {
  schema: { hue: 45 },
  mode: { hue: 240 },
} as const;

export function ExplainerPaperCard({ type, what, why }: { type: 'schema' | 'mode'; what: string; why: string }) {
  return (
    <div className="pp-paper sd-explainer-card cd-explainer-card" style={{ '--h': PAPER_CARD[type].hue } as CSSProperties}>
      <div>{what}</div>
      <div className="ds-sub sd-explainer-why">{why}</div>
    </div>
  );
}
