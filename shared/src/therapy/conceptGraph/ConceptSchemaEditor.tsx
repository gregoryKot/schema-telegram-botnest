import type { ConceptSchemaLink } from '../../apiTypes';
import { CONCEPT_SCHEMA_TEXT_MAX } from '../../limits/textLimits';
import { getSchemaById } from '../../schemaTherapy/schemaTherapyData';
import { domainLook } from '../../theme/entityLook';
import type { GraphSchemaCard } from './conceptGraphTypes';
import { useSchemaGuide, type ConceptGuideActions } from './conceptGuide';
import { ConceptGuideHint } from './ConceptGuideHint';
import { ConceptNeedField } from './ConceptNeedField';
import { ConceptTextField } from './ConceptTextField';
import { ConceptEditorShell } from './ConceptEditorShell';

/**
 * Редактор одной схемы: во что человек верит (виден на схеме случая), как
 * нарушалась потребность (овал над схемой) и какие потребности схема блокирует
 * (✗ на схеме). Открывается инлайн под диаграммой, как редактор режима.
 * Каждое изменение сразу уходит в onChangeLink. «Убрать схему» снимает её из
 * концептуализации, тексты остаются в данных: вернул схему — вернулись тексты.
 * Под полями — плашка «Обычно в методе» из раздела схемы (#995); раздела нет
 * или тексты ещё грузятся — плашки нет. `guide` — кнопки подсказок.
 */
export function ConceptSchemaEditor({
  card,
  link,
  onChangeLink,
  onRemove,
  onClose,
  guide,
}: {
  card: GraphSchemaCard;
  link: ConceptSchemaLink;
  onChangeLink: (link: ConceptSchemaLink) => void;
  onRemove: (schemaId: string) => void;
  onClose: () => void;
  guide?: ConceptGuideActions;
}) {
  const set = (patch: Partial<ConceptSchemaLink>) =>
    onChangeLink({ ...link, ...patch });
  const method = useSchemaGuide(card.id);
  return (
    <ConceptEditorShell
      look={domainLook(getSchemaById(card.id)?.domainId ?? '')}
      label={`Схема ${card.name}: редактор`}
      title={`Схема ${card.name}`}
      sub={card.domain}
      onClose={onClose}
      onRemove={() => onRemove(card.id)}
      removeLabel="Убрать схему из концептуализации"
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
      {method && (
        <ConceptGuideHint
          view={method}
          from={{ kind: 'schema', id: card.id }}
          actions={guide}
          marks={link.done}
        />
      )}
    </ConceptEditorShell>
  );
}
