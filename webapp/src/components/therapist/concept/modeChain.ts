import { createContext, useContext } from 'react';
import { getModeById } from '../../../schemaTherapyData';

// Цепочка раздела «Переключение режимов» строится из режимов, отмеченных у
// клиента в концептуализации. До 2026-10 там стояла константа «Уязвимый
// Ребёнок → Карающий Критик → Здоровый Взрослый» — одна и та же у любого
// клиента, даже если у него выбраны другие режимы (QA 2026-10-26; правило
// «данные пользователя — только реальные»).

export interface ChainStep { kind: string; modeId: string; name: string; group: string }

// Клинический порядок: боль ребёнка → атака критика → защита копинга → опора.
const STEPS: { kind: string; groups: string[]; prefer?: string }[] = [
  { kind: 'Ребёнок', groups: ['child'] },
  { kind: 'Критик', groups: ['critic'] },
  { kind: 'Копинг', groups: ['coping_surrender', 'coping_avoidance', 'coping_overcompensation'] },
  { kind: 'Здоровый', groups: ['healthy'], prefer: 'healthy_adult' },
];

/**
 * По одному режиму клиента на шаг (в порядке, в каком их отметили; у здоровых
 * первым — Здоровый Взрослый). Меньше двух шагов — переключаться не между чем,
 * цепочки нет: пустой массив, а не выдуманная схема.
 */
export function buildModeChain(modeIds: string[]): ChainStep[] {
  const modes = modeIds.map(id => getModeById(id)).filter(m => m !== undefined);
  const chain = STEPS.flatMap(step => {
    const own = modes.filter(m => step.groups.includes(m.groupId));
    const pick = own.find(m => m.id === step.prefer) ?? own[0];
    return pick ? [{ kind: step.kind, modeId: pick.id, name: pick.name, group: pick.groupId }] : [];
  });
  return chain.length >= 2 ? chain : [];
}

/** Режимы клиента для форм разделов концептуализации (ставит ClientConceptTab). */
export const ConceptModeIdsContext = createContext<string[]>([]);
export const useConceptModeChain = () => buildModeChain(useContext(ConceptModeIdsContext));
