import { useEffect, useRef } from 'react';
import type { ConceptModeLink } from '../../apiTypes';
import { colorMix } from '../../utils/colorMix';
import type { GraphModeCard } from './conceptGraphTypes';
import { ConceptSchemaField } from './ConceptSchemaField';
import { ConceptStrategy } from './ConceptStrategy';
import { ConceptTextField } from './ConceptTextField';
import { ConceptAliasField } from './ConceptAliasField';
import { ConceptNeedField } from './ConceptNeedField';
import { boxStyle } from './graphStyles';
import { MANIFEST_FIELD } from './modeLanes';

const gap = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-16)',
} as const;

/**
 * Редактор одного режима: открывается инлайн под схемой по тапу на фигуру (не
 * оверлей — ему не нужна ни история браузера, ни реестр «Назад»). Каждое
 * изменение сразу уходит в onChangeLink; связь режима, убранного с карты,
 * остаётся в данных. Что писать в текст режима, зависит от группы, а сам текст
 * виден на фигуре. Потребности (✓ на схеме) выбираются только у здоровых
 * режимов, схемы (⇄) — только у остальных.
 */
export function ConceptModeEditor({
  card,
  link,
  conceptSchemaIds,
  onChangeLink,
  onAddSchema,
  onToggleMode,
  onClose,
}: {
  card: GraphModeCard;
  link: ConceptModeLink;
  conceptSchemaIds: string[];
  onChangeLink: (link: ConceptModeLink) => void;
  onAddSchema: (schemaId: string) => void;
  onToggleMode: (modeId: string) => void;
  onClose: () => void;
}) {
  const set = (patch: Partial<ConceptModeLink>) =>
    onChangeLink({ ...link, ...patch });
  const healthy = card.lane === 'healthy';
  const manifestField = MANIFEST_FIELD[card.lane];
  // Редактор открывается под диаграммой, а фигура может стоять высоко над ним.
  // Подвозим редактор к глазам.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, []);
  return (
    <section
      ref={ref}
      data-export-skip
      aria-label={`${card.name}: связи`}
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
          marginBottom: 'var(--space-12)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>{card.name}</div>
        <button
          type="button"
          onClick={onClose}
          style={{
            minHeight: 44,
            padding: '0 14px',
            borderRadius: 'var(--r-12)',
            border: 'none',
            background: 'rgba(var(--fg-rgb),0.07)',
            color: 'var(--text)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Готово
        </button>
      </div>
      <div style={gap}>
        <ConceptAliasField
          value={link.alias}
          onChange={(alias) => set({ alias })}
        />
        {!healthy && (
          <ConceptSchemaField
            linkSchemaIds={link.schemaIds}
            conceptSchemaIds={conceptSchemaIds}
            onChange={(schemaIds) => set({ schemaIds })}
            onAddSchema={onAddSchema}
          />
        )}
        {healthy && (
          <ConceptNeedField
            label="О каких потребностях уже умеет заботиться"
            needIds={link.needIds}
            onChange={(needIds) => set({ needIds })}
          />
        )}
        <ConceptTextField
          label={manifestField.label}
          placeholder={manifestField.placeholder}
          hint="Этот текст виден на схеме"
          value={link.manifest}
          onChange={(manifest) => set({ manifest })}
        />
        <ConceptTextField
          label="Откуда режим"
          placeholder="Ранний опыт: что происходило, чей это голос"
          value={link.origin}
          onChange={(origin) => set({ origin })}
        />
        <ConceptStrategy
          card={card}
          link={link}
          onChange={(strategy) => set({ strategy })}
        />
        <button
          type="button"
          onClick={() => {
            onToggleMode(card.modeId);
            onClose();
          }}
          style={{
            minHeight: 44,
            padding: '0 14px',
            borderRadius: 'var(--r-12)',
            border: `1px solid ${colorMix('var(--accent-red)', 40)}`,
            background: 'transparent',
            color: 'var(--accent-red)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          Убрать режим с карты
        </button>
      </div>
    </section>
  );
}
