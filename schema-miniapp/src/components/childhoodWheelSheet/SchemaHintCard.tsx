import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import {
  CHILDHOOD_SCHEMA_HINTS,
  hintSchemas,
} from '../../../../shared/src/childhoodWheel/childhoodWheel';
import { pressable } from '../../utils/a11y';
import { HINT_COLOR } from './schemaHints';
import type { ActiveSchema, NeedId } from './types';

// Карточка «Возможные активные схемы» для одной просевшей потребности: домен
// и схемы-чипы (тап открывает описание). Данные – из shared.
export function SchemaHintCard({
  id,
  label,
  rating,
  setActiveSchema,
}: {
  id: NeedId;
  label: string;
  rating: number;
  setActiveSchema: (s: ActiveSchema) => void;
}) {
  const hint = CHILDHOOD_SCHEMA_HINTS[id];
  const color = HINT_COLOR[id];
  return (
    <div
      style={{
        background: 'rgba(var(--fg-rgb),0.04)',
        borderRadius: 'var(--r-14)',
        padding: '12px 14px',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-8)',
          marginBottom: 8,
        }}
      >
        <IdentityDot id={id} />
        <span className="u-h13">{label}</span>
        <span
          style={{
            fontSize: 12,
            color,
            marginLeft: 'auto',
          }}
        >
          {rating}/10 в детстве
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-sub)',
          marginBottom: 6,
        }}
      >
        Домен: {hint.domain}
      </div>
      <div className="u-wrap5">
        {hintSchemas(id).map((s) => (
          <span
            key={s.id}
            {...pressable(() =>
              setActiveSchema({
                name: s.name,
                desc: s.desc,
                color: s.domainColor,
              }),
            )}
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 'var(--r-20)',
              background: `color-mix(in srgb, ${color} 9%, transparent)`,
              color,
              cursor: 'pointer',
              textDecoration: 'underline dotted',
              textUnderlineOffset: 3,
            }}
          >
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
