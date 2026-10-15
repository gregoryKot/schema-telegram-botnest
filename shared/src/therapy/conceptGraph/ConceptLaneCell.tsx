import { useState, type ReactNode } from 'react';
import type { GraphModeCard } from './conceptGraphTypes';
import { LANE_META, groupIdsOfLane, type ConceptLane } from './modeLanes';
import { ConceptModeCard } from './ConceptModeCard';
import { ConceptModePicker } from './ConceptModePicker';
import { boxStyle, dashedStyle, hintStyle } from './graphStyles';

/**
 * Клетка схемы случая: заголовок, карточки режимов и «+ режим». Пустая клетка
 * — пунктирная плашка с объяснением дефицита, а не просто пустота.
 */
export function ConceptLaneCell({
  lane,
  cards,
  allModeIds,
  openModeId,
  onOpenCard,
  onToggleMode,
  footer,
}: {
  lane: ConceptLane;
  cards: GraphModeCard[];
  allModeIds: string[];
  openModeId: string | null;
  onOpenCard: (modeId: string) => void;
  onToggleMode: (modeId: string) => void;
  footer?: ReactNode;
}) {
  const meta = LANE_META[lane];
  const [picking, setPicking] = useState(false);
  return (
    <section aria-label={meta.title} style={boxStyle}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{meta.title}</div>
      <div style={{ ...hintStyle, marginBottom: 'var(--space-10)' }}>
        {meta.subtitle}
      </div>
      {/* Копинги — ряд (у Редигера они стоят строкой под детскими режимами и
          критиком): на широком экране карточки рядом, на телефоне столбиком. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            lane === 'coping' ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr',
          gap: 'var(--space-8)',
          alignItems: 'start',
        }}
      >
        {cards.length === 0 && <div style={dashedStyle}>{meta.empty}</div>}
        {cards.map((card) => (
          <ConceptModeCard
            key={card.modeId}
            card={card}
            open={openModeId === card.modeId}
            onOpen={() => onOpenCard(card.modeId)}
          />
        ))}
      </div>
      {footer}
      {/* Управление не попадает в картинку схемы (data-export-skip). */}
      <div data-export-skip>
        <button
          type="button"
          aria-expanded={picking}
          onClick={() => setPicking((p) => !p)}
          style={{
            minHeight: 44,
            marginTop: 'var(--space-8)',
            padding: '0 12px',
            borderRadius: 'var(--r-12)',
            border: 'none',
            background: 'transparent',
            color: 'var(--accent)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {picking ? 'Свернуть' : '+ режим'}
        </button>
        {picking && (
          <ConceptModePicker
            activeModeIds={allModeIds}
            onToggle={onToggleMode}
            groupIds={groupIdsOfLane(lane)}
          />
        )}
      </div>
    </section>
  );
}
