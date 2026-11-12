import { describe, it, expect } from 'vitest';
import { ASSIGN_TEMPLATES } from './assignTemplates';
import { TASK_OPTIONS } from '../taskCreate/taskOptions';
import { hueGap, NEIGHBOUR_HUE_GAP } from '../../../../shared/src/theme/hueGap';

// QA 2026-10-26: все шаблоны открывали «Трекер потребностей», а «Imagery
// rescripting» и «Дневник режима» обещали типы, которых в назначении нет.
describe('ASSIGN_TEMPLATES', () => {
  it('каждый шаблон ведёт в тип, который есть в листе назначения', () => {
    const types = new Set(TASK_OPTIONS.map(o => o.type));
    for (const t of ASSIGN_TEMPLATES) expect(types.has(t.preset.type)).toBe(true);
  });

  it('у шаблонов разные типы или тексты — не один лист на все', () => {
    const keys = ASSIGN_TEMPLATES.map(t => `${t.preset.type}|${t.preset.text ?? ''}`);
    expect(new Set(keys).size).toBe(ASSIGN_TEMPLATES.length);
  });

  // b31, принцип 2: плитки 2×2 на телефоне и в ряд на компьютере — любые две соседние не ближе 40° по кругу.
  it('плитки — бумага сущности со знаком, соседи по ряду и по колонке 2×2 не ближе 40°', () => {
    const h = ASSIGN_TEMPLATES.map(t => t.look.hue);
    expect(h).toEqual([28, 240, 290, 135]);
    // r2: «Дневник режима» создаёт «Своё задание» — у плитки знак своего задания (Check), как у строки задания.
    expect(ASSIGN_TEMPLATES.map(t => t.look.sign)).toEqual(['layers', 'check', 'sheets', 'haven']);
    const pairs: [number, number][] = [[0, 1], [1, 2], [2, 3], [0, 2], [1, 3]];
    for (const [a, b] of pairs) expect(hueGap(h[a], h[b]), `${a}-${b}`).toBeGreaterThanOrEqual(NEIGHBOUR_HUE_GAP);
  });

  it('«Своё задание» в шаблоне приезжает с заготовкой текста; аудио-практики нет', () => {
    for (const t of ASSIGN_TEMPLATES.filter(x => x.preset.type === 'custom')) {
      expect(t.preset.text?.trim()).toBeTruthy();
    }
    expect(ASSIGN_TEMPLATES.some(t => /аудио|imagery/i.test(t.title + t.sub))).toBe(false);
  });
});
