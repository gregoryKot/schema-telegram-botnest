// Схема случая глазами клиента: что уходит человеку, когда терапевт включил
// «Показать клиенту» (ClientConceptualization.sharedWithClientAt). Решение
// владельца (BACKLOG, 2026-11): клиент видит вид «Схема» — схемы, режимы и их
// цикл, потребности, — без истоков (детский опыт), задач терапии, рабочих
// полей и истории версий. Холст «Графических карт» сюда не входит.
// Белый список, а не чёрный: поле, которого нет в CLIENT_CONCEPT_FIELDS (и
// внутри связей — в сборщиках ниже), клиенту не уходит. Спек сверяет список со
// schema.prisma: новая колонка — либо сюда, либо в CLIENT_CONCEPT_HIDDEN с
// причиной. Тем же видом клиент выгружает свои данные (export-policy.client.ts).
import type { ClientConceptualization } from '@prisma/client';
import { decryptConceptFields } from './concept-store';

/** Колонки строки, которые видит клиент. */
export const CLIENT_CONCEPT_FIELDS = [
  'schemaIds',
  'modeIds',
  'modeTransitions',
  'modeLinks',
  'schemaLinks',
  'sharedWithClientAt',
  'updatedAt',
] as const;

const WORK =
  'рабочее поле терапевта: в вид «Схема» не входит, клиенту не показывается';

/** Остальные колонки и почему клиент их не видит. */
export const CLIENT_CONCEPT_HIDDEN: Record<string, string> = {
  id: 'внутренний id строки, клиенту ни к чему',
  therapistId: 'кто терапевт — клиент знает из «Мой терапевт»',
  clientId: 'это сам клиент — ключ выборки',
  earlyExperience:
    'истоки: ранний опыт — решение владельца, клиенту не показывать',
  unmetNeeds: WORK,
  triggers: WORK,
  copingStyles: WORK,
  goals: 'задачи терапии — решение владельца, клиенту не показывать',
  currentProblems: WORK,
  modeMapNodes: 'старый холст карты режимов — рабочая копия терапевта',
  modeMapEdges: 'старый холст карты режимов — рабочая копия терапевта',
  needLinks:
    'колесо потребностей: оценки и заметки терапевта по периодам — рабочая запись',
  history: 'история версий — клиент видит только текущую',
};

/** Режим на схеме клиента: без `origin` (истоки) и `strategy` (задачи терапии). */
export interface ClientModeLink {
  modeId: string;
  alias: string;
  schemaIds: string[];
  needIds: string[];
  manifest: string;
}

/** Схема на схеме клиента: без `origin` (детский опыт). */
export interface ClientSchemaLink {
  schemaId: string;
  belief: string;
  needIds: string[];
}

export interface ClientConceptView {
  schemaIds: string[];
  modeIds: string[];
  modeTransitions: string | null;
  modeLinks: ClientModeLink[];
  schemaLinks: ClientSchemaLink[];
  sharedWithClientAt: Date;
  updatedAt: Date;
}

type Obj = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const objs = (v: unknown): Obj[] =>
  Array.isArray(v)
    ? v.filter((x): x is Obj => typeof x === 'object' && x !== null)
    : [];

// Связи собираются поле за полем: новое поле ConceptModeLink/ConceptSchemaLink
// клиенту не уходит, пока его не добавят сюда осознанно.
const modeLink = (l: Obj): ClientModeLink => ({
  modeId: str(l.modeId),
  alias: str(l.alias),
  schemaIds: strs(l.schemaIds),
  needIds: strs(l.needIds),
  manifest: str(l.manifest),
});

const schemaLink = (l: Obj): ClientSchemaLink => ({
  schemaId: str(l.schemaId),
  belief: str(l.belief),
  needIds: strs(l.needIds),
});

/** Строка концептуализации → вид клиента; не показана — null. */
export function clientConceptView(
  row: ClientConceptualization,
): ClientConceptView | null {
  if (!row.sharedWithClientAt) return null;
  const d = decryptConceptFields(row);
  return {
    schemaIds: strs(d.schemaIds),
    modeIds: strs(d.modeIds),
    modeTransitions:
      typeof d.modeTransitions === 'string' ? d.modeTransitions : null,
    modeLinks: objs(d.modeLinks).map(modeLink),
    schemaLinks: objs(d.schemaLinks).map(schemaLink),
    sharedWithClientAt: row.sharedWithClientAt,
    updatedAt: row.updatedAt,
  };
}
