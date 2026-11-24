// Тест гейта check-own-button.mjs: CSS-правило с btn|cta|submit в селекторе, задающее
// фон и скругление вне .ds-btn…, не растёт. Оба исхода и контрольные образцы.
import { runGate } from './gate-sandbox';

const GATE = 'check-own-button.mjs';
const run = (css: string, baseline: Record<string, number> = {}) =>
  runGate(GATE, {
    'webapp/src/a.css': css + '\n',
    'shared/src/b.css': '.k { color: red; }\n',
    'scripts/own-button-baseline.json': JSON.stringify(baseline),
  });

describe('check-own-button.mjs', () => {
  it('своя кнопка: фон + скругление в .x-submit — красный с селектором', () => {
    const res = run(
      '.x-submit { background: var(--accent); border-radius: 26px; }',
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('.x-submit');
  });

  it('background-color и список селекторов тоже считаются', () => {
    const res = run(
      '.a, .b-cta:hover { background-color: red; border-radius: 4px; }',
    );
    expect(res.status).toBe(1);
  });

  it.each([
    [
      'модификатор примитива',
      '.ds-btn.x-btn { background: var(--surface); border-radius: 8px; }',
    ],
    ['только раскладка', '.x-btn { display: flex; width: 100%; }'],
    ['фон без скругления', '.x-btn { background: var(--surface); }'],
    [
      'не кнопка',
      '.x-card { background: var(--surface); border-radius: 8px; }',
    ],
  ])('контроль: %s — не считается', (_n, css) => {
    expect(run(css).status).toBe(0);
  });

  it('файл в бейслайне со своим числом — зелёный; рост — красный', () => {
    const one = '.x-btn { background: red; border-radius: 4px; }';
    expect(run(one, { 'webapp/src/a.css': 1 }).status).toBe(0);
    const two = `${one}\n.y-cta { background: red; border-radius: 4px; }`;
    expect(run(two, { 'webapp/src/a.css': 1 }).status).toBe(1);
  });
});
