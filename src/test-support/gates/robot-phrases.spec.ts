// Тест гейта check-robot-phrases.mjs (docs/VOICE.md, свип 2026-07):
// пофайловый храповик роботных конструкций в user-facing тексте
// («это не X, это Y», канцелярит, метатекст, филлеры, мостики).
import { runGate } from './gate-sandbox';

describe('check-robot-phrases.mjs', () => {
  it('новый файл с запрещённой конструкцией — exit 1', () => {
    const res = runGate('check-robot-phrases.mjs', {
      'scripts/robot-phrases-baseline.json': JSON.stringify({}),
      // "не просто" — паттерн ne-prosto; строка содержит ≥4 кириллических
      // подряд, чтобы пройти фильтр "только строки с русским текстом".
      'src/foo.ts': "export const msg = 'Это не просто упражнение для тебя';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/foo.ts: новый файл с 1 конструкциями');
  });

  it('рост счётчика в известном файле — exit 1 с "было → стало"', () => {
    const res = runGate('check-robot-phrases.mjs', {
      'scripts/robot-phrases-baseline.json': JSON.stringify({
        'src/known.ts': 1,
      }),
      'src/known.ts': [
        "export const a = 'Это не просто задача';",
        "export const b = 'Важно отметить прогресс';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/known.ts: 1 → 2');
  });

  it('снижение счётчика — exit 0, предлагает зафиксировать --update', () => {
    const res = runGate('check-robot-phrases.mjs', {
      'scripts/robot-phrases-baseline.json': JSON.stringify({
        'src/known.ts': 2,
      }),
      'src/known.ts': "export const a = 'Это не просто задача';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 < 2 — стало лучше');
  });

  it('текст без запрещённых конструкций — exit 0, без роста', () => {
    const res = runGate('check-robot-phrases.mjs', {
      'scripts/robot-phrases-baseline.json': JSON.stringify({}),
      'src/clean.ts': "export const msg = 'Заполни дневник сегодня вечером';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик роботных конструкций: 0 (без роста)',
    );
  });
});
