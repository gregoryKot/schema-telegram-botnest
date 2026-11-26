import type { EdgeType, ModeMapEdge } from '../../api';

// Типы связи карты режимов и готовые подписи к ним (вынесено из ModeMapEdgeEditor.tsx).
// «✗ блокирует» и «✓ заботится» — те же линии, что рисует схема случая
// (conceptToModeMap): от схемы к потребности и от Здорового Взрослого к ней.
// Раньше руками их было не провести — только подписать стрелку вручную.

export const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  activates:  'активирует',
  protects:   'защищает от',
  suppresses: 'подавляет',
  leads_to:   'ведёт к',
  blocks:     'блокирует потребность',
  meets:      'заботится о потребности',
};

/** Знак перед подписью типа в панели: у линий к потребности — ✗ и ✓, у остальных — стрелка. */
export const EDGE_TYPE_MARK: Partial<Record<EdgeType, string>> = { blocks: '✗', meets: '✓' };

/** Вид линии, который тип задаёт сразу: красный пунктир ✗ и зелёная ✓, как в схеме случая. */
export const EDGE_TYPE_STYLE: Partial<Record<EdgeType, NonNullable<ModeMapEdge['data']>>> = {
  blocks: { color: 'var(--accent-red)', lineStyle: 'dashed' },
  meets:  { color: 'var(--accent-green)' },
};

// Подписи по типу: выбор типа ставит на линию случайную, «окошко» в панели даёт выбрать другую.
const EDGE_TYPE_PHRASES: Record<EdgeType, string[]> = {
  activates:  ['активирует', 'запускает', 'будит', 'включает', 'провоцирует', 'пробуждает', 'цепляет', 'триггерит'],
  protects:   ['защищает от', 'прикрывает', 'оберегает от', 'спасает от', 'отгораживает от', 'прячет'],
  suppresses: ['подавляет', 'давит на', 'заглушает', 'наказывает', 'обесценивает', 'критикует', 'стыдит', 'требует от'],
  leads_to:   ['ведёт к', 'приводит к', 'оборачивается', 'заканчивается', 'усиливает', 'подкрепляет'],
  blocks:     ['✗', '✗ блокирует', '✗ не даёт', '✗ лишает'],
  meets:      ['✓', '✓ заботится', '✓ питает', '✓ даёт'],
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function pickPhrases(type: string, n: number): string[] {
  return shuffle(EDGE_TYPE_PHRASES[type as EdgeType] ?? []).slice(0, n);
}
