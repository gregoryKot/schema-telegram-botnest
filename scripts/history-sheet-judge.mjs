// Сверка компонентов-оверлеев файла с записью бейслайна для гейта check-history-sheet.mjs.
// Компонент рисует не больше оверлеев, чем вызывает useHistorySheet (без хука — один, и тот
// записан); больше — запись "overlays": { "<компонент>": N } с причиной (ветки одного листа,
// подтверждение поверх листа). Тест — history-sheet-components.spec.ts.

/** Оверлеи компонента без повторов: два класса-оверлея одного className — одна точка. */
export const overlayCount = (c) => new Set(c.hits.map((h) => h.line)).size;

/** Нужна ли файлу запись: компонент без хука или оверлеев больше, чем вызовов хука. */
export const needsEntry = (comps) => comps.some((c) => c.calls === 0 || overlayCount(c) > c.calls);

const where = (file, c) => `   ${file} › ${c.name}  (L${c.hits[0].line}: ${c.hits[0].what})`;

/**
 * comps — overlaysByComponent файла, entry — его запись бейслайна (или undefined).
 * Возвращает { missing, problems }: missing — компоненты без хука и без записи.
 */
export function judgeFile(file, comps, entry) {
  const missing = [];
  const problems = [];
  const bare = comps.filter((c) => c.calls === 0);
  const listed = Array.isArray(entry?.components) ? entry.components : null;
  const stated = entry?.overlays ?? {};
  if (entry && !listed && bare.length > 1) {
    problems.push(
      `${file}: одна запись бейслайна, а компонентов-оверлеев без хука ${bare.length} ` +
        `(${bare.map((c) => c.name).join(', ')}) — хук или поле "components" с перечнем`,
    );
  }
  const covered = (c) => Boolean(entry) && (!listed || listed.includes(c.name));
  for (const c of comps) {
    if (c.calls === 0 && !covered(c)) {
      missing.push(where(file, c));
      continue;
    }
    const n = overlayCount(c);
    const limit = c.calls || 1;
    const say = stated[c.name];
    if (n > limit && say !== n) {
      const has = c.calls ? `вызовов useHistorySheet ${c.calls}` : 'запись закрывает один';
      problems.push(
        say === undefined
          ? `${file} › ${c.name}: оверлеев ${n}, а ${has} — у второго нет своей записи истории: ` +
              `хук или "overlays": { "${c.name}": ${n} } в записи с причиной`
          : `${file} › ${c.name}: в "overlays" ${say}, а оверлеев ${n} — сверься с кодом и обнови запись`,
      );
    } else if (n <= limit && say !== undefined) {
      problems.push(`протухшая запись: ${file} — "overlays".${c.name}: оверлеев ${n}, хватает хука или записи`);
    }
  }
  for (const name of Object.keys(stated).filter((k) => !comps.some((c) => c.name === k))) {
    problems.push(`протухшая запись: ${file} — "overlays".${name}: такого компонента-оверлея нет`);
  }
  if (listed) {
    const gone = listed.filter((n) => !bare.some((c) => c.name === n));
    if (gone.length) problems.push(`протухшая запись: ${file} — в components ${gone.join(', ')}: хук уже есть или оверлея нет`);
  }
  return { missing, problems };
}
