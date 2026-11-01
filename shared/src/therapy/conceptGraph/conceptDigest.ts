// Сводка «Коротко» концептуализации (#902): строки «что с клиентом» из модели
// схемы случая — первое, что видно на вкладке сайта и в листе мини-аппа, до
// фигур схемы и карточек полей. Чистая функция без React: порядок строк
// фиксирован (схемы → режимы → цикл → потребности → цель), пустая строка
// опускается, пустая модель даёт [] — тогда карточки нет вовсе.
import { NEED_ORDER, getNeedData } from '../../needs/needData';
import type { ConceptGraphModel, GraphModeCard } from './conceptGraphTypes';

export type DigestKey = 'schemas' | 'modes' | 'cycle' | 'needs' | 'goal';

export interface DigestRow {
  key: DigestKey;
  label: string;
  text: string;
}

/** Заголовок карточки сводки — один для компонента и тестов. */
export const DIGEST_TITLE = 'Коротко';

/** Предел строки «Цель»: длиннее — обрезка по слову с «…». */
export const GOAL_CLIP = 160;

const ORDER: DigestKey[] = ['schemas', 'modes', 'cycle', 'needs', 'goal'];

const LABELS: Record<DigestKey, string> = {
  schemas: 'Схемы',
  modes: 'Режимы',
  cycle: 'Цикл',
  needs: 'Потребности',
  goal: 'Цель',
};

const SEP = ' · ';

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
const modeName = (m: GraphModeCard): string =>
  m.alias ? `${m.alias} (${m.name})` : m.name;

/** Детские → критикующие → копинг (внутри полосы — порядок модели), затем « → » и здоровые. */
function modesText({ lanes }: ConceptGraphModel): string {
  const main = [...lanes.child, ...lanes.critic, ...lanes.coping]
    .map(modeName)
    .join(SEP);
  const healthy = lanes.healthy.map(modeName).join(SEP);
  if (!main || !healthy) return main || healthy;
  return `${main} → ${healthy}`;
}

/** «✗» — блокируемые схемами, «✓» — о которых заботятся здоровые режимы; порядок NEED_ORDER. */
function needsText({ schemas, lanes }: ConceptGraphModel): string {
  const data = getNeedData('ty');
  const names = (ids: Set<string>): string =>
    NEED_ORDER.filter((id) => ids.has(id))
      .map((id) => data[id].name)
      .join(SEP);
  const blocked = names(new Set(schemas.flatMap((s) => s.needIds)));
  const met = names(
    new Set(lanes.healthy.flatMap((m) => m.needs.map((n) => n.id))),
  );
  return [blocked && `✗ ${blocked}`, met && `✓ ${met}`]
    .filter(Boolean)
    .join(SEP);
}

export function buildConceptDigest(
  graph: ConceptGraphModel,
  goals: string | null | undefined,
): DigestRow[] {
  const texts: Record<DigestKey, string> = {
    schemas: graph.schemas.map((s) => s.name).join(SEP),
    modes: modesText(graph),
    cycle: graph.sequence,
    needs: needsText(graph),
    goal: clip(goals ?? '', GOAL_CLIP),
  };
  return ORDER.filter((key) => texts[key]).map((key) => ({
    key,
    label: LABELS[key],
    text: texts[key],
  }));
}
