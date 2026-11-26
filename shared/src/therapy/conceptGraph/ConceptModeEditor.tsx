import type { ConceptModeLink } from '../../apiTypes';
import { getModeById } from '../../schemaTherapy/schemaTherapyData';
import { modeLook } from '../../theme/entityLook';
import type { GraphModeCard } from './conceptGraphTypes';
import { ConceptSchemaField } from './ConceptSchemaField';
import { ConceptStrategy } from './ConceptStrategy';
import { useModeGuide, type ConceptGuideActions } from './conceptGuide';
import { ConceptTextField } from './ConceptTextField';
import { ConceptAliasField } from './ConceptAliasField';
import { ConceptNeedField } from './ConceptNeedField';
import { ConceptEditorShell } from './ConceptEditorShell';
import { MANIFEST_FIELD } from './modeLanes';

/**
 * Редактор одного режима: открывается инлайн под схемой по тапу на фигуру
 * (ConceptEditorShell — лист бумаги группы со знаком). Каждое
 * изменение сразу уходит в onChangeLink; связь режима, убранного с карты,
 * остаётся в данных. Что писать в текст режима, зависит от группы, а сам текст
 * виден на фигуре. Потребности (✓ на схеме) выбираются только у здоровых
 * режимов, схемы (⇄) — только у остальных. `guide` — кнопки подсказок (#995).
 */
export function ConceptModeEditor({
  card,
  link,
  conceptSchemaIds,
  onChangeLink,
  onAddSchema,
  onToggleMode,
  onClose,
  guide,
}: {
  card: GraphModeCard;
  link: ConceptModeLink;
  conceptSchemaIds: string[];
  onChangeLink: (link: ConceptModeLink) => void;
  onAddSchema: (schemaId: string) => void;
  onToggleMode: (modeId: string) => void;
  onClose: () => void;
  guide?: ConceptGuideActions;
}) {
  const set = (patch: Partial<ConceptModeLink>) =>
    onChangeLink({ ...link, ...patch });
  const healthy = card.lane === 'healthy';
  const manifestField = MANIFEST_FIELD[card.lane];
  const method = useModeGuide(card.modeId);
  return (
    <ConceptEditorShell
      look={modeLook(card.modeId, getModeById(card.modeId)?.groupId)}
      label={`${card.name}: связи`}
      title={card.name}
      onClose={onClose}
      onRemove={() => onToggleMode(card.modeId)}
      removeLabel="Убрать режим с карты"
    >
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
        guide={method}
        actions={guide}
        onChange={(strategy) => set({ strategy })}
      />
    </ConceptEditorShell>
  );
}
