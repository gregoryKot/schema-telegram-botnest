// Блок «Страница ссылок» для /stats (правило №8): какие кнопки нажимают на
// kotlarewski.gr/privet и из каких соцсетей приходят. Чистый форматтер.
import {
  LINKS_PAGE_FROM,
  LINKS_PAGE_TARGETS,
} from '../analytics/links-page.constants';
import { FROM_LABELS, TARGET_LABELS } from './links-page-metrics.labels';

export interface LinksPageMetrics {
  /** За месяц: все нажатия кнопок на странице ссылок. */
  total30: number;
  /** Нажатия по кнопкам (meta.target). */
  byTarget: Record<string, number>;
  /** Нажатия по источникам (meta.from). */
  byFrom: Record<string, number>;
}

/** Ненулевые счётчики в порядке реестра: «подпись — число». */
const parts = <K extends string>(
  keys: readonly K[],
  labels: Record<K, string>,
  counts: Record<string, number>,
): string =>
  keys
    .filter((k) => (counts[k] ?? 0) > 0)
    .map((k) => `${labels[k]} — ${counts[k]}`)
    .join(', ');

/** Текстовый блок для /stats. Чистая функция. */
export function formatLinksPageMetrics(m: LinksPageMetrics): string {
  const lines = [`🔗 <b>Страница ссылок</b> (за месяц)`];
  if (m.total30 === 0) {
    lines.push('Пока никто не нажимал кнопки на странице ссылок.');
    return lines.join('\n');
  }
  lines.push(`Нажали на кнопки: ${m.total30}`);
  const targets = parts(LINKS_PAGE_TARGETS, TARGET_LABELS, m.byTarget);
  if (targets) lines.push(`Куда: ${targets}`);
  const from = parts(LINKS_PAGE_FROM, FROM_LABELS, m.byFrom);
  if (from) lines.push(`Откуда пришли: ${from}`);
  return lines.join('\n');
}
