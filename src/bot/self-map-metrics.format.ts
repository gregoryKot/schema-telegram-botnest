// Блок «Карта себя: переходы» для /stats (правило №8). Чистый форматтер.
import type { SelfMapLinkTarget } from '../analytics/self-map-events.constants';

export type SelfMapMetrics = Record<SelfMapLinkTarget, number>;

export const EMPTY_SELF_MAP_METRICS: SelfMapMetrics = {
  mode: 0,
  schema: 0,
  patterns: 0,
  ysq_test: 0,
  map: 0,
};

/** Текстовый блок для /stats. Чистая функция; язык без терминов. */
export function formatSelfMapMetrics(m: SelfMapMetrics): string {
  const lines = ['🗺 <b>Карта себя: переходы</b> (за месяц)'];
  const total = m.mode + m.schema + m.patterns + m.ysq_test + m.map;
  if (total === 0) {
    lines.push('Пока никто не переходил');
    return lines.join('\n');
  }
  lines.push(
    `В карточку режима ${m.mode} · в схему ${m.schema} · в «Мои паттерны» ${m.patterns} · в тест ${m.ysq_test} · из «Моих паттернов» на карту ${m.map}`,
  );
  return lines.join('\n');
}
