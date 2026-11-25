import { it } from 'vitest';
import { writeFileSync, readFileSync } from 'fs';
import * as NEW from './schemaTherapy/guide/index';
// @ts-ignore
import * as OLD from '/private/tmp/claude-502/-Users-gregory-telegram-bot-2--claude-worktrees-nervous-elion-62936a/a6d71f35-6cb9-46f4-884c-e0bed5a5c1a2/scratchpad/w/main/shared/src/schemaTherapy/guide/index';

const tr = (a: string) => a;
const collect = (G: any) => {
  const out: Record<string, any> = {};
  for (const m of G.buildModeGuides(tr)) out['mode:' + m.modeId] = m;
  for (const t of G.buildTechniqueGuides(tr)) out['tech:' + t.id] = t;
  for (const s of G.buildSchemaGuides(tr))
    out['schema:' + (s.schemaId ?? s.guide?.schemaId)] = s.guide ?? s;
  for (const n of G.practiceNotes(tr)) out['note:' + n.id] = n;
  for (const c of G.buildConcernGuides(tr)) out['concern:' + c.id] = c;
  return out;
};
it('dump', () => {
  const a = collect(OLD),
    b = collect(NEW);
  writeFileSync('/tmp/old.json', JSON.stringify(a));
  const bad: string[] = [];
  for (const k of Object.keys(a)) {
    for (const f of Object.keys(a[k])) {
      let x = a[k][f],
        y = b[k]?.[f];
      if (!Array.isArray(x) || typeof x[0] !== 'string') continue;
      const skip = readFileSync(__dirname + '/schemaTherapy/guide/schemas/childhood.ts', 'utf8') + readFileSync(__dirname + '/schemaTherapy/guide/modes/sessionSigns.ts', 'utf8');
      x = [...x]; y = y ? [...y] : y;
      while (x.length && skip.includes(x[x.length - 1])) x.pop();
      while (y && y.length && skip.includes(y[y.length - 1])) y.pop();
      const pref = x.every((v: string, i: number) => y?.[i] === v);
      const dup =
        y && new Set(y).size !== y.length && new Set(x).size === x.length;
      const addedDup = y
        ? y.length - new Set(y).size - (x.length - new Set(x).size)
        : 0;
      if (!pref || addedDup > 0)
        bad.push(
          `${k}.${f}: prefix=${pref} addedDup=${addedDup} old=${x.length} new=${y?.length}`,
        );
    }
  }
  writeFileSync('/tmp/bad.txt', bad.join('\n'));
});
