// Правило №4: копия имён режимов для уведомлений (src/notification/mode-names.ts) совпадает с modeClinicalName.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FEEL_GATES } from './modeFeelGates';
import { modeClinicalName } from './modeDisplayName';

const copy = readFileSync(
  new URL('../../../src/notification/mode-names.ts', import.meta.url),
  'utf8',
);

describe('mode-names ↔ modeClinicalName', () => {
  const ids = [
    ...new Set(FEEL_GATES.flatMap((g) => g.leaves.map((l) => l.modeId))),
  ];
  it.each(ids)('%s — то же каноническое имя', (id) => {
    expect(copy).toContain(`  ${id}: '${modeClinicalName(id)}',\n`);
  });
  it('лишних режимов в копии нет', () => {
    expect((copy.match(/^ {2}\w+: '/gm) ?? []).length).toBe(ids.length);
  });
});
