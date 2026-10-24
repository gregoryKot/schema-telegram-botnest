// Заготовки имени части (шаг name) — словарь-константа без собственной
// логики, но денормализованная относительно CASE_IMPULSES (правило №4
// CLAUDE.md: два места, обязанные совпадать, — под тестом-сверкой). Ключ,
// потерявший пару при переименовании чипа порыва, тихо перестал бы
// показывать заготовку на шаге name — и это не поймал бы ни один тип, только
// сверка списков.
import { describe, it, expect } from 'vitest';
import { CASE_ALIAS_CHIPS } from './caseAliasChips';
import { CASE_IMPULSES } from './caseImpulses';

describe('CASE_ALIAS_CHIPS — сверка с CASE_IMPULSES', () => {
  const impulseIds = CASE_IMPULSES.map((c) => c.id);

  it('каждый ключ — реальный id чипа порыва, а не опечатка/устаревший id', () => {
    for (const key of Object.keys(CASE_ALIAS_CHIPS)) {
      expect(impulseIds).toContain(key);
    }
  });

  it('каждый чип порыва, кроме «своё» (impulse_own), имеет заготовку имени', () => {
    for (const id of impulseIds) {
      if (id === 'impulse_own') continue;
      expect(CASE_ALIAS_CHIPS[id]).toBeTruthy();
    }
  });

  it('impulse_own сознательно без заготовки — «своё» уже текст человека', () => {
    expect(CASE_ALIAS_CHIPS['impulse_own']).toBeUndefined();
  });

  it('значения — непустые русские слова, без обращения на ты/вы (это имя части, не реплика)', () => {
    for (const alias of Object.values(CASE_ALIAS_CHIPS)) {
      expect(alias.trim().length).toBeGreaterThan(0);
      expect(alias).not.toMatch(/[Тт]ы\b|[Вв]ы\b/);
    }
  });
});
