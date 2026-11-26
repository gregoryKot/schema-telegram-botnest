// Правило №4: копия имён режимов для уведомлений (src/notification/mode-phrases.ts) совпадает с modeDisplayName.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FEEL_GATES } from './modeFeelGates';
import { modeDisplayName } from './modeDisplayName';

const copy = readFileSync(
  new URL('../../../src/notification/mode-phrases.ts', import.meta.url),
  'utf8',
);

describe('mode-phrases ↔ modeDisplayName', () => {
  const ids = [
    ...new Set(FEEL_GATES.flatMap((g) => g.leaves.map((l) => l.modeId))),
  ];
  it.each(ids)('%s — то же имя без алиаса', (id) => {
    expect(copy).toContain(`  ${id}: '${modeDisplayName(id)}',\n`);
  });
  it('лишних режимов в копии нет', () => {
    expect((copy.match(/^ {2}\w+: '/gm) ?? []).length).toBe(ids.length);
  });
});
