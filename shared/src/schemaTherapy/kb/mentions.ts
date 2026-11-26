// Названия режимов в тексте раздела (.claude/rules/knowledge-base.md, «Название в тексте —
// значит, и связь в поле»): поиск по основам слов, без морфологии.
import type { SchemaGuide } from '../guide/types';

const norm = (s: string) => s.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Регэксп названия по основам слов (слово без двух последних букв): «Уязвимый Ребёнок» ловит
 * и «Уязвимого Ребёнка». Название из одного слова — с учётом регистра: «Агрессор» — режим,
 * «агрессивный» — нет.
 */
export function modeNamePattern(name: string): RegExp {
  const words = norm(name)
    .split(/[\s/–—-]+/)
    .filter(Boolean);
  const stems = words.map(
    (w) => `${escape(w.slice(0, Math.max(4, w.length - 2)))}\\S*`,
  );
  const flags = words.length > 1 ? 'giu' : 'gu';
  return new RegExp(`(?<!\\p{L})${stems.join('[\\s-]+')}`, flags);
}

/**
 * id режимов, чьи названия встречаются в тексте. Длинные названия ищутся первыми и
 * вырезаются: «Подозрительный Гиперконтролёр» не засчитывается ещё и «Гиперконтролёру».
 */
export function mentionedModes(
  text: string,
  modes: readonly { id: string; name: string }[],
): string[] {
  let rest = norm(text);
  const words = (n: string) => n.split(/[\s-]+/).length;
  const found: string[] = [];
  for (const m of [...modes].sort((a, b) => words(b.name) - words(a.name))) {
    const re = modeNamePattern(m.name);
    if (!re.test(rest)) continue;
    found.push(m.id);
    rest = rest.replace(re, ' ');
  }
  return found;
}

/** Текстовые поля раздела схемы, где может стоять название режима. */
export function schemaGuideText(g: SchemaGuide): string {
  return [
    g.essence,
    g.need,
    g.coping.surrender,
    g.coping.avoidance,
    g.coping.overcompensation,
    g.inSession,
    g.reparenting,
    ...g.interventions,
    g.stuck ?? '',
    ...(g.voice ?? []),
    ...(g.more ?? []),
  ].join('\n');
}
