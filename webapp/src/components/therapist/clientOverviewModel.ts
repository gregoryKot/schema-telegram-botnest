// Чистые вычисления вкладки «Обзор» и шапки карточки клиента: группировка
// схем по доменам, сводка режимов, бары потребностей, столбики индекса,
// превью дневника. Цвета не здесь — только hue (lib/tone.ts) и уровни.
import { SCHEMA_DOMAINS, MODE_GROUPS, getModeById } from '../../schemaTherapyData';
import { DOMAIN_HUE, MODE_GROUP_HUE, DIARY_HUE, NEED_HUE, indexLevel, type IndexLevel } from '../../lib/tone';

export interface DomainTile {
  id: string;
  name: string;
  hue: number;
  schemas: { id: string; name: string }[];
}

/** Активные схемы, сгруппированные по доменам (порядок доменов — как в справочнике; пустые домены опущены). */
export function groupSchemasByDomain(activeIds: readonly string[]): DomainTile[] {
  const tiles: DomainTile[] = [];
  for (const d of SCHEMA_DOMAINS) {
    const schemas = d.schemas.filter((s) => activeIds.includes(s.id)).map((s) => ({ id: s.id, name: s.name }));
    if (schemas.length > 0) tiles.push({ id: d.id, name: d.domain, hue: DOMAIN_HUE[d.id], schemas });
  }
  return tiles;
}

export interface ModeColumn {
  id: string;
  name: string;
  hue: number;
  modes: { id: string; name: string }[];
}

/** Все группы режимов с их активными режимами (пустая группа остаётся колонкой). */
export function summarizeModes(activeIds: readonly string[]): ModeColumn[] {
  return MODE_GROUPS.map((g) => ({
    id: g.id,
    name: g.group,
    hue: MODE_GROUP_HUE[g.id],
    modes: g.items.filter((m) => activeIds.includes(m.id)).map((m) => ({ id: m.id, name: m.name })),
  }));
}

export interface NeedBar {
  id: string;
  label: string;
  hue: number;
  value: number;
  /** Ширина заливки, %: оценка 0..10 → 0..100. */
  widthPct: number;
  /** Оценка ≤4 — подсвечивается как сигнал. */
  low: boolean;
}

const NEED_ROWS = [
  ['attachment', 'Привязанность'],
  ['autonomy', 'Автономия'],
  ['expression', 'Выражение чувств'],
  ['play', 'Спонтанность'],
  ['limits', 'Границы'],
] as const;

/** Бары потребностей дня; потребности без оценки пропускаются. */
export function needBars(ratings: Record<string, number> | undefined): NeedBar[] {
  const bars: NeedBar[] = [];
  for (const [id, label] of NEED_ROWS) {
    const v = ratings?.[id];
    if (v == null) continue;
    bars.push({ id, label, hue: NEED_HUE[id], value: v, widthPct: Math.max(0, Math.min(10, v)) * 10, low: v <= 4 });
  }
  return bars;
}

export interface SparkBar {
  heightPct: number;
  level: IndexLevel;
}

/** Столбики индекса за N дней в хронологическом порядке; на входе index 0 = сегодня. Пропуск → пустой столбик. */
export function indexSparkBars(history: readonly { index: number | null }[], days = 14): SparkBar[] {
  return history
    .slice(0, days)
    .map((d) => ({
      heightPct: d.index == null ? 0 : Math.max(0, Math.min(10, d.index)) * 10,
      level: indexLevel(d.index),
    }))
    .reverse();
}

export interface DiaryEntryLike {
  type: 'schema' | 'mode' | 'gratitude';
  date: string;
  schemaIds?: string[];
  modeId?: string;
  excerpt: string;
}

export interface DiaryPreviewRow {
  hue: number;
  typeLabel: string;
  title: string;
  excerpt: string;
  date: string;
}

const flatSchemas = SCHEMA_DOMAINS.flatMap((d) => d.schemas);

/** Последние записи клиента для строк превью: тип (бейдж), заголовок, фрагмент. */
export function diaryPreview(entries: readonly DiaryEntryLike[], limit = 5): DiaryPreviewRow[] {
  return entries.slice(0, limit).map((e) => {
    if (e.type === 'schema') {
      const ids = e.schemaIds ?? [];
      const first = flatSchemas.find((s) => s.id === ids[0]);
      const extra = ids.length > 1 ? ` +${ids.length - 1}` : '';
      return { hue: DIARY_HUE.schema, typeLabel: 'Схема-дневник', title: (first ? first.name : ids.join(', ') || 'Схема') + extra, excerpt: e.excerpt, date: e.date };
    }
    if (e.type === 'mode') {
      const mode = getModeById(e.modeId ?? '');
      return { hue: DIARY_HUE.mode, typeLabel: 'Режим-дневник', title: mode ? mode.name : (e.modeId ?? 'Режим'), excerpt: e.excerpt, date: e.date };
    }
    return { hue: DIARY_HUE.gratitude, typeLabel: 'Благодарность', title: 'Благодарность', excerpt: e.excerpt, date: e.date };
  });
}

/** Инициалы для аватара: первые буквы до двух слов. */
export function clientInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words.slice(0, 2).map((w) => Array.from(w)[0]).join('').toUpperCase();
}

/**
 * Отличие индекса сегодня от среднего за предыдущие дни (index 0 = сегодня).
 * Нужно ≥7 записей истории и хотя бы одна оценка до сегодня; иначе null — не выдумываем.
 */
export function weekDelta(history: readonly { index: number | null }[], todayIndex: number): number | null {
  if (history.length < 7) return null;
  const prev = history.slice(1, 8).map((d) => d.index).filter((v): v is number => v != null);
  if (prev.length === 0) return null;
  return todayIndex - prev.reduce((s, v) => s + v, 0) / prev.length;
}
