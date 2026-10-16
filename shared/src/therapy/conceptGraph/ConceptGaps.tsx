import { colorMix } from '../../utils/colorMix';
import type { ConceptGraphModel } from './conceptGraphTypes';

/** Мягкие подсказки «чего не хватает» — не ошибки, а повод для разговора. */
export function ConceptGaps({ gaps }: { gaps: ConceptGraphModel['gaps'] }) {
  if (gaps.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
      }}
    >
      {gaps.map((g) => (
        <div
          key={g.id}
          role="note"
          style={{
            padding: 'var(--space-10) var(--space-12)',
            borderRadius: 'var(--r-12)',
            fontSize: 13,
            lineHeight: 1.5,
            background: colorMix('var(--accent)', 8),
            border: `1px solid ${colorMix('var(--accent)', 24)}`,
          }}
        >
          {g.text}
        </div>
      ))}
    </div>
  );
}
