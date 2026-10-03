// Шов «Мой путь» мини-аппа: без вызова registerMiniappJourneyHeroes в
// JourneySheet JourneyView рисует тело без шапки (shared/journey/journeyHeroes.ts)
// — тест JourneySheet мокает JourneyView и этого не увидит.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('JourneySheet мини-аппа', () => {
  it('регистрирует градиентного героя при загрузке модуля', () => {
    const src = readFileSync(resolve(__dirname, 'JourneySheet.tsx'), 'utf8');
    expect(src).toMatch(/^registerMiniappJourneyHeroes\(\);/m);
  });
});
