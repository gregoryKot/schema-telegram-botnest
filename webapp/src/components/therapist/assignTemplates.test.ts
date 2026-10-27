import { describe, it, expect } from 'vitest';
import { ASSIGN_TEMPLATES } from './assignTemplates';
import { TASK_OPTIONS } from '../taskCreate/taskOptions';

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

  it('«Своё задание» в шаблоне приезжает с заготовкой текста; аудио-практики нет', () => {
    for (const t of ASSIGN_TEMPLATES.filter(x => x.preset.type === 'custom')) {
      expect(t.preset.text?.trim()).toBeTruthy();
    }
    expect(ASSIGN_TEMPLATES.some(t => /аудио|imagery/i.test(t.title + t.sub))).toBe(false);
  });
});
