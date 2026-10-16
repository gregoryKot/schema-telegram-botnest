// Разбор текста воркфлоу GitHub Actions для гейтов над `.github/workflows`
// (deploy-needs-ci.ts, job-timeouts.ts, ci-concurrency.spec.ts). Только
// разбор, правил здесь нет: что считать нарушением, решает каждый гейт сам.
// yaml-парсера в зависимостях нет, а нужные места (`on:`, джобы верхнего
// уровня) в репозитории плоские и однотипные, поэтому разбор идёт по строкам.
// Образцы и прогон по настоящим файлам — в спеках потребителей.

export const stripComments = (text: string): string =>
  text
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');

/** Блок `on:` по событиям: { push: '…строки под ключом…', … }. */
export function triggerBlocks(text: string): Record<string, string> {
  const lines = stripComments(text).split('\n');
  const start = lines.findIndex((l) => /^["']?on["']?:/.test(l));
  if (start < 0) return {};
  const inline = lines[start].replace(/^["']?on["']?:\s*/, '').trim();
  if (inline) {
    const names = inline.replace(/[[\]]/g, '').split(',');
    return Object.fromEntries(
      names.map((n) => [n.trim(), '']).filter(([n]) => n),
    );
  }
  const body: string[] = [];
  for (const l of lines.slice(start + 1)) {
    if (l.trim() && !/^\s/.test(l)) break;
    body.push(l);
  }
  const blocks: Record<string, string> = {};
  let key = '';
  for (const l of body) {
    const m = /^ {2}([\w-]+):(.*)$/.exec(l);
    if (m) {
      key = m[1];
      blocks[key] = m[2];
    } else if (key) {
      blocks[key] += '\n' + l;
    }
  }
  return blocks;
}

/** Тексты джоб воркфлоу без комментариев: { id: 'всё, что под ключом' }. */
export function jobBlocks(text: string): Record<string, string> {
  const src = stripComments(text);
  const at = src.search(/^jobs:[ \t]*(?:#.*)?$/m);
  if (at < 0) return {};
  const out: Record<string, string> = {};
  for (const part of src
    .slice(at)
    // Ключ джобы может нести хвостовой комментарий (`  build: # …`).
    .split(/^ {2}(?=[\w-]+:[ \t]*(?:#.*)?$)/m)
    .slice(1)) {
    out[part.slice(0, part.indexOf(':'))] = part;
  }
  return out;
}
