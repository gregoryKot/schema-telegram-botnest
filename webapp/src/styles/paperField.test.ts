// @vitest-environment node
// Поле-лист .pa-field (paper-app.css) — одно поле свободного текста на всё приложение (правило №3, сведение g2 и g3,
// ревью g3 r5): заметка к дню, «Что случилось?», быстрая запись и тетрадь благодарности. До сведения быстрая запись
// (.qe-area) и тетрадь (.sd-grat-sheet) несли свой дубль листа — белый фон, радиус, тень сдвинутым слоем и кольцо
// фокуса; правка вида в .pa-field до них бы не дошла. Экран задаёт только высоту и раскладку, вид — у .pa-field.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allCssRules, readCss } from './cssRules.test-helpers';

/** Класс экрана рядом с pa-field → файл компонента, где он стоит в className. */
const USERS = {
  'sd-note-area': 'components/NoteSheet.tsx',
  'cq-field': 'components/caseFlow/CaseSceneStep.tsx',
  'qe-area': 'components/diary/quickEntry/QuickWriteStep.tsx',
  'sd-grat-sheet': 'components/diary/GratitudeEntrySheet.tsx',
} as const;
/** Вид листа, который принадлежит .pa-field: экран его не переопределяет. */
const LOOK = /(?:^|;)\s*(background|background-color|box-shadow|border|border-radius|border-color|outline|font|font-family)\s*:/;

const rules = allCssRules();
const subject = (sel: string) => sel.split(/[\s>+~]+/).pop() ?? '';

describe('поле-лист .pa-field — один вид на все поля свободного текста', () => {
  it.each(Object.entries(USERS))('%s: в className рядом с pa-field и правила только .pa-field.%s', (cls, file) => {
    const src = readFileSync(join(__dirname, '..', file), 'utf8');
    expect(src, file).toMatch(new RegExp(`className="pa-field ${cls}"`));
    expect(rules.some((r) => r.selectors.some((s) => subject(s) === `.pa-field.${cls}`)), `.pa-field.${cls}`).toBe(true);
  });

  it.each(Object.keys(USERS))('%s: экран не рисует свой лист (фон, тень, рамка, шрифт, кольцо фокуса)', (cls) => {
    const own = rules.filter((r) => r.selectors.some((s) => new RegExp(`\\.${cls}(?![\\w-])`).test(subject(s))) && LOOK.test(r.body));
    expect(own.map((r) => `${r.f} ${r.selectors.join(', ')} { ${r.body.trim()} }`)).toEqual([]);
  });

  it('фокус — кромкой и у поля, и у тетради (focus-within), без кольца поверх тени', () => {
    const focus = readCss('paper-app.css').filter((r) => r.selectors.some((s) => s.startsWith('.pa-field:focus')));
    expect(focus.map((r) => r.selectors.join(', '))).toEqual(['.pa-field:focus-within']);
    expect(focus[0].body).toMatch(/border-color:\s*var\(--accent\)/);
    expect(focus[0].body).not.toMatch(/box-shadow/);
  });
});
