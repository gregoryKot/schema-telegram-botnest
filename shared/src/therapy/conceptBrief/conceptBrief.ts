// Экран «Главное» концептуализации: самое важное о клиенте на одном экране,
// блоки выбирает терапевт (2026-11, слова владельца: «всё самое важное на
// одном экране, и чтобы терапевт мог выбрать, что для него важно»). Чистая
// модель без React: реестр блоков с набором по умолчанию, разбор и запись
// выбора (строка localStorage), сборка секций из концептуализации с черновиком
// поверх. Плашки схем, режимов и потребностей — те же билдеры, что у сводки
// «Коротко» (conceptDigest.ts): одна механика — один модуль.
import { COPING_KIND_LABEL } from '../conceptGraph/modeLanes';
import { buildConceptGraph } from '../conceptGraph/conceptGraphModel';
import { conceptGraphSource } from '../conceptGraph/conceptGraphSource';
import type { GraphModeCard } from '../conceptGraph/conceptGraphTypes';
import type { ConceptLane } from '../conceptGraph/modeLanes';
import {
  modeHue,
  modeName,
  needItems,
  schemaItems,
  type DigestItem,
} from '../conceptGraph/conceptDigestModel';
import type { ClientConceptualizationBase } from '../clientConceptualization';

export type BriefBlockId =
  | 'schemas'
  | 'modes'
  | 'needs'
  | 'cycle'
  | 'goals'
  | 'problems'
  | 'triggers'
  | 'coping'
  | 'early';

export interface BriefBlock {
  id: BriefBlockId;
  label: string;
  /** Входит в набор по умолчанию, пока терапевт не выбрал своё. */
  on: boolean;
}

/** Порядок реестра — порядок карточек на экране: сначала схема случая, потом поля. */
export const BRIEF_BLOCKS: BriefBlock[] = [
  { id: 'schemas', label: 'Схемы', on: true },
  { id: 'modes', label: 'Режимы', on: true },
  { id: 'needs', label: 'Потребности', on: true },
  { id: 'cycle', label: 'Переключение режимов', on: true },
  { id: 'goals', label: 'Цели терапии', on: true },
  { id: 'problems', label: 'Актуальные проблемы', on: true },
  { id: 'triggers', label: 'Триггеры', on: false },
  { id: 'coping', label: 'Стили совладания', on: false },
  { id: 'early', label: 'Ранний опыт', on: false },
];

/** Ключ localStorage с выбором блоков — JSON-массив id. */
export const BRIEF_BLOCKS_KEY = 'concept_brief_blocks';

export const DEFAULT_BRIEF_BLOCKS: BriefBlockId[] = BRIEF_BLOCKS.filter(
  (b) => b.on,
).map((b) => b.id);

const KNOWN = new Set<string>(BRIEF_BLOCKS.map((b) => b.id));

/**
 * Выбор из хранилища: нет записи или мусор — набор по умолчанию; неизвестные id
 * отбрасываются, порядок — реестра. Пустой массив — законный выбор «ничего»:
 * терапевт снял все блоки, экран скажет об этом словами.
 */
export function parseBriefBlocks(
  raw: string | null | undefined,
): BriefBlockId[] {
  if (!raw) return DEFAULT_BRIEF_BLOCKS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_BRIEF_BLOCKS;
    const picked = new Set(
      parsed.filter((x): x is string => typeof x === 'string'),
    );
    return BRIEF_BLOCKS.filter((b) => picked.has(b.id)).map((b) => b.id);
  } catch {
    return DEFAULT_BRIEF_BLOCKS;
  }
}

export function serializeBriefBlocks(ids: BriefBlockId[]): string {
  return JSON.stringify(ids.filter((id) => KNOWN.has(id)));
}

/** Переключить блок; порядок всегда реестра, чтобы карточки не прыгали. */
export function toggleBriefBlock(
  ids: BriefBlockId[],
  id: BriefBlockId,
): BriefBlockId[] {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return BRIEF_BLOCKS.filter((b) => next.has(b.id)).map((b) => b.id);
}

/** Режим на экране «Главное»: имя (слова клиента), полоса, что говорит / делает. */
export interface BriefMode {
  modeId: string;
  name: string;
  hue?: number;
  lane: string;
  manifest: string;
  schemas: string[];
}

export interface BriefSection {
  id: BriefBlockId;
  label: string;
  kind: 'chips' | 'modes' | 'text';
  items: DigestItem[];
  modes: BriefMode[];
  text: string;
  /** Блок выбран, но заполнить нечем — карточка говорит «—», не пропадает. */
  empty: boolean;
}

const LANE_LABEL: Record<ConceptLane, string> = {
  child: 'Детский',
  critic: 'Критик',
  coping: 'Копинг',
  healthy: 'Здоровый',
};

const laneLabel = (m: GraphModeCard): string =>
  m.lane === 'coping' && m.copingKind
    ? COPING_KIND_LABEL[m.copingKind]
    : LANE_LABEL[m.lane];

export type BriefConcept = Partial<ClientConceptualizationBase>;

type TextField =
  | 'modeTransitions'
  | 'goals'
  | 'currentProblems'
  | 'triggers'
  | 'copingStyles'
  | 'earlyExperience';

const TEXT_FIELD: Partial<Record<BriefBlockId, TextField>> = {
  cycle: 'modeTransitions',
  goals: 'goals',
  problems: 'currentProblems',
  triggers: 'triggers',
  coping: 'copingStyles',
  early: 'earlyExperience',
};

/** Секции экрана в порядке реестра — только выбранные; сервер + черновик поверх. */
export function buildConceptBrief(
  concept: BriefConcept | null | undefined,
  local: BriefConcept | undefined,
  selected: BriefBlockId[],
): BriefSection[] {
  const c: BriefConcept = { ...concept, ...local };
  const graph = buildConceptGraph(conceptGraphSource(c), (ty) => ty);
  const chosen = new Set(selected);
  const base = {
    items: [] as DigestItem[],
    modes: [] as BriefMode[],
    text: '',
  };
  return BRIEF_BLOCKS.filter((b) => chosen.has(b.id)).map((b) => {
    if (b.id === 'schemas' || b.id === 'needs') {
      const items = b.id === 'schemas' ? schemaItems(graph) : needItems(graph);
      return {
        ...base,
        id: b.id,
        label: b.label,
        kind: 'chips',
        items,
        empty: items.length === 0,
      };
    }
    if (b.id === 'modes') {
      const modes = (['child', 'critic', 'coping', 'healthy'] as ConceptLane[])
        .flatMap((lane) => graph.lanes[lane])
        .map((m) => ({
          modeId: m.modeId,
          name: modeName(m),
          hue: modeHue(m.modeId),
          lane: laneLabel(m),
          manifest: m.manifest,
          schemas: m.schemas.map((s) => s.name),
        }));
      return {
        ...base,
        id: b.id,
        label: b.label,
        kind: 'modes',
        modes,
        empty: modes.length === 0,
      };
    }
    const field = TEXT_FIELD[b.id];
    const text = (field ? (c[field] ?? '') : '').trim();
    return {
      ...base,
      id: b.id,
      label: b.label,
      kind: 'text',
      text,
      empty: text === '',
    };
  });
}
