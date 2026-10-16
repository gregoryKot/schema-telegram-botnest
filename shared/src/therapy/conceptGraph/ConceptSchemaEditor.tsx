import { useEffect, useRef } from 'react';
import type { ConceptSchemaLink } from '../../apiTypes';
import { CONCEPT_SCHEMA_TEXT_MAX } from '../../limits/textLimits';
import { colorMix } from '../../utils/colorMix';
import type { GraphSchemaCard } from './conceptGraphTypes';
import { ConceptNeedField } from './ConceptNeedField';
import { ConceptTextField } from './ConceptTextField';
import { boxStyle, hintStyle } from './graphStyles';

const button = {
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 'var(--r-12)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
} as const;

/**
 * Редактор одной схемы: во что человек верит (виден на схеме случая), как
 * нарушалась потребность (овал над схемой) и какие потребности схема блокирует
 * (✗ на схеме). Открывается инлайн под диаграммой, как редактор режима.
 * Каждое изменение сразу уходит в onChangeLink. «Убрать схему» снимает её из
 * концептуализации, тексты остаются в данных: вернул схему — вернулись тексты.
 */
export function ConceptSchemaEditor({
  card,
  link,
  onChangeLink,
  onRemove,
  onClose,
}: {
  card: GraphSchemaCard;
  link: ConceptSchemaLink;
  onChangeLink: (link: ConceptSchemaLink) => void;
  onRemove: (schemaId: string) => void;
  onClose: () => void;
}) {
  const set = (patch: Partial<ConceptSchemaLink>) =>
    onChangeLink({ ...link, ...patch });
  // Редактор стоит под диаграммой, а схема может быть высоко над ним.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, []);
  return (
    <section
      ref={ref}
      data-export-skip
      aria-label={`Схема ${card.name}: редактор`}
      style={{
        ...boxStyle,
        background: colorMix(card.color, 6),
        boxShadow: `inset 4px 0 0 ${card.color}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-8)',
          marginBottom: 'var(--space-12)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Схема {card.name}</div>
          <div style={hintStyle}>{card.domain}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            ...button,
            border: 'none',
            background: 'rgba(var(--fg-rgb),0.07)',
            color: 'var(--text)',
          }}
        >
          Готово
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-16)',
        }}
      >
        <ConceptTextField
          label="Во что человек верит"
          placeholder="Своими словами клиента: «Я верю, что мои переживания не имеют смысла…»"
          hint="Этот текст виден на схеме"
          max={CONCEPT_SCHEMA_TEXT_MAX}
          value={link.belief}
          onChange={(belief) => set({ belief })}
        />
        <ConceptTextField
          label="Как нарушалась потребность"
          placeholder="Детский опыт: что происходило, кто был рядом"
          hint="Этот текст виден на схеме овалом над схемой"
          max={CONCEPT_SCHEMA_TEXT_MAX}
          value={link.origin}
          onChange={(origin) => set({ origin })}
        />
        <ConceptNeedField
          label="Какие потребности блокирует"
          needIds={link.needIds}
          onChange={(needIds) => set({ needIds })}
        />
        <button
          type="button"
          onClick={() => {
            onRemove(card.id);
            onClose();
          }}
          style={{
            ...button,
            border: `1px solid ${colorMix('var(--accent-red)', 40)}`,
            background: 'transparent',
            color: 'var(--accent-red)',
            alignSelf: 'flex-start',
          }}
        >
          Убрать схему из концептуализации
        </button>
      </div>
    </section>
  );
}
