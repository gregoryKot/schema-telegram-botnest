// Текст «Экспорт концепта» (краткая концептуализация для шаринга и буфера) —
// один билдер на оба фронтенда. До QA 2026-11 копий было две
// (useClientDetail сайта и conceptExport мини-аппа), и обе разошлись с формой:
// поле «Стили совладания» уходило в экспорт под заголовком «ДЕЗАДАПТИВНЫЕ
// КОПИНГИ», «Переключение режимов» не уходило вовсе, а пустой концепт давал
// пустую строку — кнопка молчала. Подписи полей теперь из CONCEPT_FIELDS (та
// же таблица рисует форму), пустоту видно заранее — isConceptEmpty.
import type { UserId } from '../userId';
import { getModeById, getSchemaById } from '../schemaTherapy/schemaTherapyData';
import { fmtDate, todayStr } from '../utils/format';
import { momentDayKey } from '../utils/momentDate';
import type { ClientConceptualizationBase } from './clientConceptualization';
import { CONCEPT_FIELDS } from './clientSheetHelpers';
import { formatConceptLinksExport } from './conceptGraph/conceptLinksExport';
import { clientDisplayName } from './clientInitials';

type Concept = Partial<ClientConceptualizationBase>;

export interface ConceptExportInput {
  client: {
    telegramId: UserId;
    name?: string | null;
    clientAlias?: string | null;
  } | null;
  /** Ответ сервера; null — концептуализацию ещё не сохраняли. */
  concept: Concept | null;
  /** Несохранённые правки — важнее ответа сервера. */
  localConcept: Concept;
  activeSchemaIds: string[];
  activeModeIds: string[];
  /** Мини-апп подписывает экспорт именем терапевта. */
  therapistName?: string;
}

/** Подсказка у недоступного экспорта (кнопка не молчит на пустом концепте). */
export const CONCEPT_EXPORT_EMPTY =
  'В концепте пока пусто — экспортировать нечего';

/** Нечего экспортировать: ни схем, ни режимов, ни одного заполненного поля. */
export function isConceptEmpty(
  c: Concept,
  schemaIds: string[],
  modeIds: string[],
): boolean {
  return (
    schemaIds.length === 0 &&
    modeIds.length === 0 &&
    CONCEPT_FIELDS.every((f) => !c[f.key]?.trim())
  );
}

const names = (
  ids: string[],
  find: (id: string) => { name: string } | undefined,
) => ids.map((id) => find(id)?.name ?? id).join(' · ') || null;

/** Текст экспорта; '' — нет клиента или концепт пуст (isConceptEmpty). */
export function buildConceptExport(input: ConceptExportInput): string {
  const { client, concept, activeSchemaIds, activeModeIds } = input;
  const c: Concept = { ...concept, ...input.localConcept };
  if (!client || isConceptEmpty(c, activeSchemaIds, activeModeIds)) return '';
  const clientName = clientDisplayName(client);
  const date = concept?.updatedAt
    ? fmtDate(momentDayKey(concept.updatedAt))
    : todayStr();
  const who = input.therapistName ? `Терапевт: ${input.therapistName}   ` : '';
  const row = (label: string, value: string | null | undefined) =>
    `${label.toUpperCase()}\n${value?.trim() || '—'}\n`;
  const div = '─'.repeat(44);
  const links = formatConceptLinksExport(activeSchemaIds, activeModeIds, c);
  return [
    `${who}Клиент: ${clientName}   Дата: ${date}`,
    '',
    '══════ КРАТКАЯ КОНЦЕПТУАЛИЗАЦИЯ ══════',
    '',
    div,
    row('Актуальные схемы (ЭДС)', names(activeSchemaIds, getSchemaById)),
    div,
    row('Карта режимов', names(activeModeIds, getModeById)),
    ...(links ? [div, `${links}\n`] : []),
    ...CONCEPT_FIELDS.flatMap((f) => [div, row(f.label, c[f.key])]),
    div,
    '',
    '@SchemeHappens · Всё по схеме',
  ].join('\n');
}
