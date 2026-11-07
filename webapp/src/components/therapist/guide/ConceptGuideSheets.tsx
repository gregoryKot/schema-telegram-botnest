import { useTr } from '../../../utils/addressForm';
import { getModeById, getSchemaById } from '../../../../../shared/src/schemaTherapy/schemaTherapyData';
import type { BetweenSessionsItem, TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import {
  useModeGuide, useSchemaGuide, type ConceptGuideActions, type GuideFrom,
} from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { useGuide } from '../../../../../shared/src/therapy/conceptGraph/guideLoader';
import { ModeGuideSheet } from './ModeGuideSheet';
import { SchemaGuideSheet } from './SchemaGuideSheet';
import { TechniqueSheet } from './TechniqueSheet';

/** Какие листы подсказок открыты: раздел (лист режима или схемы) и поверх него — техника. */
export interface GuideOpen { sheet: GuideFrom | null; technique: TechniqueId | null }

/**
 * Листы подсказок терапевту (#995): лист режима или схемы и лист техники.
 * Техника рисуется позже раздела — на том же слое она лежит поверх него;
 * открытая с плашки, без раздела, — одна. Состояние и события —
 * useConceptGuide. Тексты — отдельный чанк (guideLoader): этот компонент
 * стоит рядом со схемой случая с её открытия, и загрузка начинается раньше
 * первого тапа по фигуре.
 */
export function ConceptGuideSheets({ open, actions, onCloseSheet, onCloseTechnique }: {
  open: GuideOpen; actions: ConceptGuideActions; onCloseSheet: () => void; onCloseTechnique: () => void;
}) {
  const tr = useTr();
  const texts = useGuide();
  const { sheet } = open;
  const modeView = useModeGuide(sheet?.kind === 'mode' ? sheet.id : '');
  const schemaView = useSchemaGuide(sheet?.kind === 'schema' ? sheet.id : '');
  const technique = texts && open.technique ? texts.techniqueGuide(tr, open.technique) : null;
  const assign = actions.onAssign;
  // Колбэки листа раздела: техника и «Дать заданием» знают, чей это раздел.
  const sheetProps = (from: GuideFrom) => ({
    onOpenTechnique: (id: TechniqueId) => actions.onOpenTechnique(id, from),
    onAssign: assign && ((item: BetweenSessionsItem) => assign(item, from)),
    onClose: onCloseSheet,
  });
  return (
    <>
      {sheet?.kind === 'mode' && modeView && (
        <ModeGuideSheet modeName={getModeById(sheet.id)?.name ?? ''} view={modeView} {...sheetProps(sheet)} />
      )}
      {sheet?.kind === 'schema' && schemaView && (
        <SchemaGuideSheet schemaName={getSchemaById(sheet.id)?.name ?? ''} view={schemaView} {...sheetProps(sheet)} />
      )}
      {technique && <TechniqueSheet technique={technique} onClose={onCloseTechnique} />}
    </>
  );
}
