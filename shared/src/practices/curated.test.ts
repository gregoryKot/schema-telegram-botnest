// Регресс: CURATED задублировался дословно в webapp/practiceCurated.ts и
// miniapp PlanSheet.tsx, и пунктуация независимо разъехалась (en-dash в
// webapp, em-dash в miniapp) — сигнал, что копии правили порознь. Единственный
// источник — этот файл; тест фиксирует НЕПУСТОЙ контент по каждой потребности
// и канонический em-dash (без случайного en-dash при будущей правке).
import { describe, it, expect } from 'vitest';
import { CURATED } from './curated';

const NEED_IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];

describe('CURATED', () => {
  it('содержит непустой список практик для каждой из 5 потребностей', () => {
    for (const id of NEED_IDS) {
      expect(CURATED[id]?.length).toBeGreaterThan(0);
      for (const text of CURATED[id]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('не содержит en-dash «–» (канон — em-dash «—»)', () => {
    for (const texts of Object.values(CURATED)) {
      for (const text of texts) {
        expect(text).not.toContain('–');
      }
    }
  });
});
