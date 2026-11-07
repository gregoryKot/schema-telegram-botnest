import type { MutableRefObject } from 'react';
import { useTr } from '../../../utils/addressForm';
import { getModeById, getSchemaById } from '../../../../../shared/src/schemaTherapy/schemaTherapyData';
import type { BetweenSessionsItem, TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import {
  useModeGuide, useSchemaGuide, type ConceptGuideActions, type GuideFrom,
} from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { guideNotes } from '../../../../../shared/src/therapy/conceptGraph/guideHistory';
import { useGuide } from '../../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { SheetBack } from '../ConceptFullscreenSheet';
import type { GuideJournal } from './guideJournal';
import { ModeGuideSheet } from './ModeGuideSheet';
import { SchemaGuideSheet } from './SchemaGuideSheet';
import { TechniqueSheet } from './TechniqueSheet';

/**
 * Какие листы подсказок открыты: раздел (лист режима или схемы) и поверх него —
 * техника вместе с разделом, из которого её открыли (туда ложится «Делали сегодня»;
 * без раздела — из списка техник «Справочника» — отметки нет). `day` — техника
 * открыта строкой журнала техник: кнопка отметки — про день этой строки.
 */
export interface GuideOpen {
  sheet: GuideFrom | null;
  technique: { id: TechniqueId; from?: GuideFrom; day?: string } | null;
}

/** Куда листы кладут свой goBack: «журнал →» закрывает их до перехода (useConceptGuide). */
export interface GuideBackRefs {
  section: MutableRefObject<SheetBack | null>;
  technique: MutableRefObject<SheetBack | null>;
}

/**
 * Листы подсказок терапевту (#995): лист режима или схемы и лист техники.
 * Техника рисуется позже раздела — на том же слое она лежит поверх него;
 * открытая с плашки, без раздела, — одна. Состояние и события —
 * useConceptGuide. Тексты — отдельный чанк (guideLoader): этот компонент
 * стоит рядом со схемой случая с её открытия, и загрузка начинается раньше
 * первого тапа по фигуре. История серым («давали …», «делали …») — guideNotes
 * по заданиям клиента (`actions.tasks`) и отметкам связи раздела (`journal`);
 * за «делали …» — «журнал →» (`actions.onOpenJournal`).
 */
export function ConceptGuideSheets({ open, actions, journal, backRefs, onCloseSheet, onCloseTechnique }: {
  open: GuideOpen; actions: ConceptGuideActions; journal?: GuideJournal; backRefs?: GuideBackRefs;
  onCloseSheet: () => void; onCloseTechnique: () => void;
}) {
  const tr = useTr();
  const texts = useGuide();
  const { sheet, technique: openTechnique } = open;
  const modeView = useModeGuide(sheet?.kind === 'mode' ? sheet.id : '');
  const schemaView = useSchemaGuide(sheet?.kind === 'schema' ? sheet.id : '');
  const technique = texts && openTechnique ? texts.techniqueGuide(tr, openTechnique.id) : null;
  const assign = actions.onAssign;
  const notesOf = (from: GuideFrom) => guideNotes(from, actions.tasks, journal?.marksOf(from));
  // Колбэки листа раздела: техника и «Дать заданием» знают, чей это раздел.
  const sheetProps = (from: GuideFrom) => ({
    onOpenTechnique: (id: TechniqueId) => actions.onOpenTechnique(id, from),
    onAssign: assign && ((item: BetweenSessionsItem) => assign(item, from)),
    onClose: onCloseSheet,
    notes: notesOf(from),
    onOpenJournal: actions.onOpenJournal,
    backRef: backRefs?.section,
  });
  const markFrom = openTechnique?.from;
  // Строка журнала за сегодня — та же кнопка «сегодня», что из схемы случая.
  const day = journal && openTechnique?.day !== journal.today() ? openTechnique?.day : undefined;
  const mark = journal && openTechnique && markFrom && {
    note: notesOf(markFrom).technique(openTechnique.id),
    marked: journal.marked(openTechnique.id, markFrom, day),
    day,
    onToggle: () => journal.toggle(openTechnique.id, markFrom, day),
    onOpenJournal: actions.onOpenJournal,
  };
  return (
    <>
      {sheet?.kind === 'mode' && modeView && (
        <ModeGuideSheet modeName={getModeById(sheet.id)?.name ?? ''} view={modeView} {...sheetProps(sheet)} />
      )}
      {sheet?.kind === 'schema' && schemaView && (
        <SchemaGuideSheet schemaName={getSchemaById(sheet.id)?.name ?? ''} view={schemaView} {...sheetProps(sheet)} />
      )}
      {technique && (
        <TechniqueSheet technique={technique} mark={mark || undefined} onClose={onCloseTechnique} backRef={backRefs?.technique} />
      )}
    </>
  );
}
