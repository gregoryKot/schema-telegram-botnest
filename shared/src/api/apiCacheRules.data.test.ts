// Смок по ВСЕЙ карте мутаций (apiCacheRules.data.ts) — по образцу
// sharedApi.test.ts: каждое правило обязано вернуть валидный список целей
// (строка-ключ или { prefix }), ни одно не падает и не остаётся мёртвым кодом.
import { describe, it, expect } from 'vitest';
import { RULES } from './apiCacheRules.data';
import type { InvalidationTarget } from './apiCache';

function isValidTarget(t: InvalidationTarget): boolean {
  if (typeof t === 'string') return t.startsWith('/');
  return typeof t.prefix === 'string' && t.prefix.startsWith('/');
}

// Тело с максимумом полей, которые может ожидать любое правило — так каждая
// ветка «если поле есть» реально срабатывает хотя бы раз.
const FULL_BODY = {
  date: '2026-01-05',
  needId: 'safety',
  clientId: 7,
};
const FAKE_MATCH = ['/x', '7'] as unknown as RegExpMatchArray;

describe('RULES: каждое правило даёт валидные цели', () => {
  it.each(RULES.map((r, i) => [i, r.method, r.pattern.source] as const))(
    'правило #%i (%s %s)',
    (_i, _method, _src) => {
      const rule = RULES[_i];
      if (rule.clearAll) return; // clearAll проверен отдельно в apiCacheRules.test.ts
      const targets = rule.targets?.(FAKE_MATCH, FULL_BODY) ?? [];
      expect(Array.isArray(targets)).toBe(true);
      for (const t of targets) expect(isValidTarget(t)).toBe(true);
    },
  );

  it('правила с body-зависимой целью — пустой массив без нужного поля', () => {
    const noteRule = RULES.find((r) => r.pattern.source.endsWith('note$'))!;
    expect(noteRule.targets?.(FAKE_MATCH, undefined)).toEqual([]);

    const practicesRule = RULES.find(
      (r) => r.method === 'POST' && r.pattern.source.endsWith('practices$'),
    )!;
    expect(practicesRule.targets?.(FAKE_MATCH, undefined)).toEqual([]);

    const tasksRule = RULES.find(
      (r) => r.method === 'POST' && r.pattern.source.endsWith('tasks$'),
    )!;
    expect(tasksRule.targets?.(FAKE_MATCH, undefined)).toEqual([
      '/api/therapy/tasks',
    ]);
  });
});
