import { IdentityDot } from '../../components/IdentityDot';
import { colorMix } from '../../utils/colorMix';
import type { GraphModeCard } from './conceptGraphTypes';
import { COPING_KIND_LABEL } from './modeLanes';
import { chipRowStyle, clamp2, miniChipStyle } from './graphStyles';

const MAX_SCHEMA_CHIPS = 3;

const firstLine = (s: string) => s.split('\n')[0];

/**
 * Карточка режима на схеме случая. Вся карточка — одна кнопка: тап открывает
 * редактор связей под клеткой, повторный тап закрывает. Клиентское имя режима
 * («Судья», «Маленькая Аня») — главная строка, название из метода — мелко.
 */
export function ConceptModeCard({
  card,
  open,
  onOpen,
}: {
  card: GraphModeCard;
  open: boolean;
  onOpen: () => void;
}) {
  const extraSchemas = card.schemas.length - MAX_SCHEMA_CHIPS;
  return (
    <button
      type="button"
      aria-label={`${card.name}: связи`}
      aria-expanded={open}
      onClick={onOpen}
      style={{
        display: 'block',
        width: '100%',
        minHeight: 44,
        padding: '10px 12px 10px 16px',
        textAlign: 'left',
        cursor: 'pointer',
        color: 'var(--text)',
        borderRadius: 'var(--r-12)',
        border: '1px solid rgba(var(--fg-rgb),0.1)',
        background: open ? colorMix(card.color, 12) : 'var(--surface-2)',
        boxShadow: `inset 4px 0 0 ${card.color}`,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IdentityDot color={card.color} size={8} />
        <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
          {card.alias || card.name}
        </span>
      </span>
      {card.alias && (
        <span
          style={{ display: 'block', fontSize: 11, color: 'var(--text-sub)' }}
        >
          {card.name}
        </span>
      )}
      {card.copingKind && (
        <span style={{ ...miniChipStyle, marginTop: 4 }}>
          {COPING_KIND_LABEL[card.copingKind]}
        </span>
      )}
      {(card.schemas.length > 0 || card.needs.length > 0) && (
        <span style={{ ...chipRowStyle, marginTop: 6 }}>
          {card.schemas.slice(0, MAX_SCHEMA_CHIPS).map((s) => (
            <span key={s.id} style={miniChipStyle}>
              <IdentityDot color={s.color} size={6} /> {s.name}
            </span>
          ))}
          {extraSchemas > 0 && (
            <span style={miniChipStyle}>+{extraSchemas}</span>
          )}
          {card.needs.map((n) => (
            <span key={n.id} style={miniChipStyle}>
              {n.name}
            </span>
          ))}
        </span>
      )}
      {card.origin && (
        <span
          style={{
            ...clamp2,
            marginTop: 6,
            fontSize: 12,
            color: 'var(--text-sub)',
          }}
        >
          Откуда: {firstLine(card.origin)}
        </span>
      )}
      {card.manifest && (
        <span
          style={{
            ...clamp2,
            marginTop: 4,
            fontSize: 12,
            color: 'var(--text-sub)',
          }}
        >
          Проявляется: {firstLine(card.manifest)}
        </span>
      )}
      {card.empty && (
        <span
          style={{
            display: 'block',
            marginTop: 4,
            fontSize: 11,
            color: 'var(--text-faint)',
          }}
        >
          связи не заполнены
        </span>
      )}
    </button>
  );
}
