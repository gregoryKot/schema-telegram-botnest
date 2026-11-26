// Сводка «Коротко» концептуализации (#902): строки «что с клиентом» из модели
// схемы случая — первое, что видно на вкладке сайта. Чистая функция без React:
// порядок строк фиксирован (схемы → режимы → цикл → потребности → цель), пустая
// строка опускается, пустая модель даёт [] — карточки нет. Строка несёт плашки
// (`items`: у схемы знак домена, у режима — группы, у потребности — свой) и
// склейку `text` для экспорта и тестов. Те же билдеры берёт экран «Главное».
import { NEED_ORDER, getNeedData } from '../../needs/needData';
import {
  getModeById,
  getSchemaById,
} from '../../schemaTherapy/schemaTherapyData';
import { MODE_GROUP_HUE } from '../../theme/entityHue';
import { domainLook, modeLook, needLook } from '../../theme/entityLook';
import type { SignKey } from '../../theme/entityLook';
import type { ConceptGraphModel, GraphModeCard } from './conceptGraphTypes';

export type DigestKey = 'schemas' | 'modes' | 'cycle' | 'needs' | 'goal';

/** Плашка строки: с hue — цветной чип сущности; `plain` — слово между плашками: стрелка «→» или подпись группы («блокированы:»). */
export interface DigestItem {
  text: string;
  hue?: number;
  sign?: SignKey;
  plain?: 'arrow' | 'caption';
}

export interface DigestRow {
  key: DigestKey;
  label: string;
  /** Плашками или текстом: «Цикл» и «Цель» — свободный текст, остальное — сущности. */
  kind: 'chips' | 'text';
  items: DigestItem[];
  /** Та же строка одним текстом (плашки через « · »). */
  text: string;
}

/** Заголовок карточки сводки — один для компонента и тестов. */
export const DIGEST_TITLE = 'Коротко';

/** Предел строки «Цель»: длиннее — обрезка по слову с «…». */
export const GOAL_CLIP = 160;
/** «Цикл» — свободный текст до 5000 знаков; в сводке — только начало, целиком он под схемой и в «Полях». */
export const CYCLE_CLIP = 200;

const ORDER: DigestKey[] = ['schemas', 'modes', 'cycle', 'needs', 'goal'];

const LABELS: Record<DigestKey, string> = {
  schemas: 'Схемы',
  modes: 'Режимы',
  cycle: 'Цикл',
  needs: 'Потребности',
  goal: 'Цель',
};

export const DIGEST_SEP = ' · ';

/**
 * Обрезка по границе слова: текст в пределе (и ровно в предел) — как есть,
 * пробелы и переносы схлопываются в один; длиннее — до последнего пробела не
 * дальше предела плюс «…»; одно слово длиннее предела режется по пределу.
 */
export function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(' ', max);
  return `${t.slice(0, cut > 0 ? cut : max).replace(/[\s,;:—–-]+$/, '')}…`;
}

/** Слова клиента, в скобках — название режима; без alias — только название. */
export const modeName = (m: Pick<GraphModeCard, 'name' | 'alias'>): string =>
  m.alias ? `${m.alias} (${m.name})` : m.name;

/** Hue группы режима — тон плашки и точки (MODE_GROUP_HUE). */
export const modeHue = (modeId: string): number | undefined =>
  MODE_GROUP_HUE[getModeById(modeId)?.groupId ?? ''];

/** Схемы в тоне домена, порядок модели (домены). */
export function schemaItems({ schemas }: ConceptGraphModel): DigestItem[] {
  return schemas.map((s) => ({
    text: s.name,
    ...domainLook(getSchemaById(s.id)?.domainId ?? ''),
  }));
}

/** Детские → критикующие → копинг (внутри полосы — порядок модели), затем «→» и здоровые. */
export function modeItems({ lanes }: ConceptGraphModel): DigestItem[] {
  const chip = (m: GraphModeCard): DigestItem => ({
    text: modeName(m),
    ...modeLook(m.modeId, getModeById(m.modeId)?.groupId),
  });
  const main = [...lanes.child, ...lanes.critic, ...lanes.coping].map(chip);
  const healthy = lanes.healthy.map(chip);
  if (main.length === 0 || healthy.length === 0) return [...main, ...healthy];
  return [...main, { text: '→', plain: 'arrow' }, ...healthy];
}

/** «блокированы:» — схемами, «есть опора:» — здоровые режимы заботятся; порядок NEED_ORDER. Слова, не только знаки: легенда схемы свёрнута. */
export function needItems({ schemas, lanes }: ConceptGraphModel): DigestItem[] {
  const data = getNeedData('ty');
  const chips = (ids: Set<string>): DigestItem[] =>
    NEED_ORDER.filter((id) => ids.has(id)).map((id) => ({
      text: data[id].name,
      ...needLook(id),
    }));
  const caption = (text: string): DigestItem => ({ text, plain: 'caption' });
  const blocked = chips(new Set(schemas.flatMap((s) => s.needIds)));
  const met = chips(
    new Set(lanes.healthy.flatMap((m) => m.needs.map((n) => n.id))),
  );
  return [
    ...(blocked.length ? [caption('✗ блокированы:'), ...blocked] : []),
    ...(met.length ? [caption('✓ есть опора:'), ...met] : []),
  ];
}

/** Склейка плашек в одну строку: чипы и подписи через « · », стрелка — пробелами. */
export function itemsText(items: DigestItem[]): string {
  return items.reduce((acc, it, i) => {
    if (i === 0) return it.text;
    const prev = items[i - 1];
    const glue = it.plain === 'arrow' || prev.plain ? ' ' : DIGEST_SEP;
    return `${acc}${glue}${it.text}`;
  }, '');
}

export function buildConceptDigest(
  graph: ConceptGraphModel,
  goals: string | null | undefined,
): DigestRow[] {
  const textRow = (t: string): DigestItem[] => (t ? [{ text: t }] : []);
  const items: Record<DigestKey, DigestItem[]> = {
    schemas: schemaItems(graph),
    modes: modeItems(graph),
    cycle: textRow(clip(graph.sequence, CYCLE_CLIP)),
    needs: needItems(graph),
    goal: textRow(clip(goals ?? '', GOAL_CLIP)),
  };
  return ORDER.filter((key) => items[key].length > 0).map((key) => ({
    key,
    label: LABELS[key],
    kind: key === 'cycle' || key === 'goal' ? 'text' : 'chips',
    items: items[key],
    text: itemsText(items[key]),
  }));
}
