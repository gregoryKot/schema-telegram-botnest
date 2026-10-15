import { colorMix } from '../../utils/colorMix';
import type { ConceptGraphModel } from './conceptGraphTypes';
import { boxStyle, hintStyle } from './graphStyles';

/** Блок с одним текстом: триггер, проблемы, переходы между режимами. */
export function ConceptTextBlock({
  title,
  hint,
  value,
  emptyText,
}: {
  title: string;
  hint?: string;
  value: string;
  emptyText?: string;
}) {
  return (
    <section aria-label={title} style={boxStyle}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
      {hint && (
        <div style={{ ...hintStyle, marginBottom: 'var(--space-6)' }}>
          {hint}
        </div>
      )}
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          color: value ? 'var(--text)' : 'var(--text-faint)',
        }}
      >
        {value || emptyText}
      </div>
    </section>
  );
}

/** Стрелка между рядами: подпись говорит, что именно течёт вниз. */
export function ConceptArrow({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        fontSize: 11,
        color: 'var(--text-sub)',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
        ↓
      </span>
      {label}
    </div>
  );
}

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
