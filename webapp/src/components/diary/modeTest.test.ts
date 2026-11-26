// Сверка теста режимов (shared/mode/modeTest) с реестром MODE_GROUPS webapp.
// Правило №4 CLAUDE.md: два места, обязанные совпадать, держит тест-сверка,
// падающая при рассинхроне. Здесь — биекция: каждый лист теста ↔ ровно один
// режим MODE_GROUPS, без пропущенных и без лишних.
import { describe, it, expect } from 'vitest';
import { ALL_TEST_MODE_IDS } from '../../../../shared/src/mode/modeTest';
import { MODE_GROUPS } from '../../schemaTherapyData';

const webappIds = MODE_GROUPS.flatMap(g => g.items.map(m => m.id));

describe('modeTest ↔ MODE_GROUPS (правило №4)', () => {
  it('каждый modeId теста существует в MODE_GROUPS', () => {
    for (const id of ALL_TEST_MODE_IDS) {
      expect(webappIds).toContain(id);
    }
  });

  it('каждый режим MODE_GROUPS покрыт тестом ровно один раз', () => {
    for (const id of webappIds) {
      const count = ALL_TEST_MODE_IDS.filter(x => x === id).length;
      expect(count).toBe(1);
    }
  });

  it('в тесте нет дублей и лишних id (полная биекция)', () => {
    expect(new Set(ALL_TEST_MODE_IDS).size).toBe(ALL_TEST_MODE_IDS.length);
    expect(ALL_TEST_MODE_IDS.length).toBe(webappIds.length);
  });
});
