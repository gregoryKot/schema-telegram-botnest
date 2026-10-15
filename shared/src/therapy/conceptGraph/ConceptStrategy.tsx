import type { ConceptModeLink } from '../../apiTypes';
import type { GraphModeCard } from './conceptGraphTypes';
import { ConceptTextField } from './ConceptTextField';
import { hintStyle, labelStyle } from './graphStyles';

/**
 * «Что делаем в терапии»: над полем — что обычно делают с режимом этой группы
 * в методе. «Взять за основу» видна, пока поле пустое, и кладёт подсказку в
 * поле, чтобы терапевт переписал её своими словами.
 */
export function ConceptStrategy({
  card,
  link,
  onChange,
}: {
  card: GraphModeCard;
  link: ConceptModeLink;
  onChange: (strategy: string) => void;
}) {
  const hint = card.strategyHint ? (
    <div
      style={{
        margin: '0 0 var(--space-6)',
        padding: 'var(--space-8) var(--space-12)',
        borderRadius: 'var(--r-12)',
        background: 'rgba(var(--fg-rgb),0.04)',
      }}
    >
      <div style={labelStyle}>Обычно в методе</div>
      <div style={{ ...hintStyle, color: 'var(--text)', margin: '2px 0' }}>
        {card.strategyHint}
      </div>
      {link.strategy.trim() === '' && (
        <button
          type="button"
          onClick={() => onChange(card.strategyHint)}
          style={{
            minHeight: 44,
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--accent)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Взять за основу
        </button>
      )}
    </div>
  ) : null;
  return (
    <ConceptTextField
      label="Что делаем в терапии"
      placeholder="Своими словами: задача на ближайшие сессии"
      value={link.strategy}
      onChange={onChange}
      above={hint}
    />
  );
}
