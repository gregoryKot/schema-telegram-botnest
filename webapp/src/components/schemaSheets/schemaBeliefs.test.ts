// Сверка таблицы убеждений с источником id схем (реестр kb/tables.ts, .claude/rules/knowledge-base.md).
import { describe, expect, it } from 'vitest';
import { ALL_SCHEMAS } from '../../schemaTherapyData';
import { BELIEFS } from './schemaBeliefs';

describe('BELIEFS', () => {
  it('ключи — ровно id схем из shared, у каждой схемы есть убеждения', () => {
    expect(Object.keys(BELIEFS).sort()).toEqual(
      ALL_SCHEMAS.map((s) => s.id).sort(),
    );
    for (const lines of Object.values(BELIEFS))
      expect(lines.length).toBeGreaterThan(0);
  });
});
