// Чистые вычисления экрана «Мои паттерны»: выраженные схемы по результатам
// YSQ, группировка полной карты по доменам, уровень оценки потребности.
import type { SchemaDomain } from '../../schemaTherapyData';
import { DOMAIN_HUE } from '../../lib/tone';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';

export interface YsqScore { pct5plus: number; avg: number }

export interface ExpressedSchema {
  id: string;
  name: string;
  hue: number | undefined;
  /** Ширина бара, 0–100: по среднему баллу (1–6). */
  barPct: number;
  /** Подпись справа от бара; '–' если баллов нет. */
  valueLabel: string;
}

export function shortName(name: string): string {
  return name.split(' / ')[0]
    .replace('Эмоциональная ', 'Эмоц. ')
    .replace('Социальная ', 'Соц. ')
    .replace('Недостаточность ', 'Недост. ');
}

export function readLocalIds(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch { return []; }
}

/** Домен и схема по id схемы; null — id неизвестен. */
export function findSchema(domains: SchemaDomain[], id: string) {
  const domain = domains.find(d => d.schemas.some(s => s.id === id));
  const schema = domain?.schemas.find(s => s.id === id);
  return domain && schema ? { domain, schema } : null;
}

/**
 * Активные по YSQ схемы, самые выраженные — первыми (средний балл, затем доля
 * ответов 5+). Без баллов порядок остаётся как в профиле. Неизвестные id
 * отбрасываются.
 */
export function rankExpressed(
  domains: SchemaDomain[],
  ids: string[],
  scores: Record<string, YsqScore>,
): ExpressedSchema[] {
  const items = ids.flatMap((id, index) => {
    const found = findSchema(domains, id);
    if (!found) return [];
    const score = scores[id];
    const avg = score?.avg ?? 0;
    const pct = score?.pct5plus ?? 0;
    return [{
      index, avg, pct,
      item: {
        id,
        name: found.schema.name,
        hue: DOMAIN_HUE[found.domain.id],
        // Классика может быть честным нулём (схема активна по среднему
        // баллу) — бар и цифра рисуются по среднему баллу.
        barPct: score ? Math.min(100, Math.max(0, Math.round(((avg - 1) / 5) * 100))) : 0,
        valueLabel: avg > 0 ? `${avg}/6` : pct > 0 ? `${pct}%` : '–',
      } satisfies ExpressedSchema,
    }];
  });
  items.sort((a, b) => b.avg - a.avg || b.pct - a.pct || a.index - b.index);
  return items.map(x => x.item);
}

export interface MapDomain {
  id: string;
  title: string;
  hue: number | undefined;
  total: number;
  activeCount: number;
  schemas: { id: string; name: string; desc: string; isMine: boolean }[];
}

/** Полная карта: домены в порядке данных, схемы с признаком «моя». */
export function groupMap(domains: SchemaDomain[], mineIds: string[]): MapDomain[] {
  const mine = new Set(mineIds);
  return domains.map(d => ({
    id: d.id,
    title: d.domain,
    hue: DOMAIN_HUE[d.id],
    total: d.schemas.length,
    activeCount: d.schemas.filter(s => mine.has(s.id)).length,
    schemas: d.schemas.map(s => ({ id: s.id, name: s.name, desc: s.desc, isMine: mine.has(s.id) })),
  }));
}

export function countSchemas(domains: SchemaDomain[]): number {
  return domains.reduce((n, d) => n + d.schemas.length, 0);
}

export function schemasWord(n: number): string {
  return pluralRu(n, 'схема', 'схемы', 'схем');
}

export function domainsWord(n: number): string {
  return pluralRu(n, 'домен', 'домена', 'доменов');
}

/** Подпись домена на карте: «2 из 4 отмечены» или «4 схемы». */
export function domainCountLabel(d: Pick<MapDomain, 'total' | 'activeCount'>): string {
  return d.activeCount > 0
    ? `${d.activeCount} из ${d.total} отмечены`
    : `${d.total} ${schemasWord(d.total)}`;
}

/** Оценка потребности в детстве (0–10): до 3 — плохо, до 6 — средне, иначе хорошо. */
export function needLevel(v: number): 'ok' | 'warn' | 'err' {
  if (v <= 3) return 'err';
  if (v <= 6) return 'warn';
  return 'ok';
}
