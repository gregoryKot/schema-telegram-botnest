import type { CSSProperties } from 'react';
import { Layers } from '../art/PaperArt';
import { Cluster } from '../art/PaperArtSigns';

/** Карточка «Схема»/«Режим» пустых «Записей»: цветная бумага (персик/небо) и мотив над текстом (docs/design/PAPER_2026-11.md). */
const PAPER_CARD = {
  schema: { hue: 45, art: <Layers size="row" /> },
  mode: { hue: 240, art: <Cluster size="row" /> },
} as const;

export function ExplainerPaperCard({ type, what, why }: { type: 'schema' | 'mode'; what: string; why: string }) {
  return (
    <div className="pp-paper sd-explainer-card cd-explainer-card" style={{ '--h': PAPER_CARD[type].hue } as CSSProperties}>
      <span className="pp-row-art cd-explainer-art">{PAPER_CARD[type].art}</span>
      <div>{what}</div>
      <div className="ds-sub sd-explainer-why">{why}</div>
    </div>
  );
}
