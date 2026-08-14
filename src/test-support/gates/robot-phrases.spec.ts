// Тест гейта check-robot-phrases.mjs (docs/VOICE.md, свип 2026-07):
// пофайловый храповик роботных конструкций в user-facing тексте
// («это не X, это Y», канцелярит, метатекст, филлеры, мостики).
import { runGate } from './gate-sandbox';
import { loadNamedPatterns } from './pattern-loader';

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

// Механизм вместо добросовестности (как shared/src/utils/crisisMarkers.test.ts):
// тесты выше бьют по CLI через известные строки и НЕ пинят каждый паттерн —
// замер 2026-08-13 показал, что отключение регэкспа 8 из 10 паттернов
// (все, кроме ne-prosto и metatext) не роняло ни один из них. Поэтому здесь
// у КАЖДОГО паттерна — живой образец, который ловит именно он. Новый паттерн
// без образца в POSITIVE роняет первый тест ниже сразу.
describe('каждый паттерн пойман своим образцом', () => {
  const PATTERNS = loadNamedPatterns('check-robot-phrases.mjs', 'PATTERNS');

  const POSITIVE: Record<string, string> = {
    'eto-ne-eto': 'Это не упражнение, это способ прожить эмоцию',
    'eto-ne-pro': 'Это не про силу воли',
    'tire-eto-ne': 'Дневник — это не тест',
    'ne-prosto': 'Это не просто упражнение для тебя',
    'ne-znachit': 'Молчание не значит согласие, это значит страх',
    metatext: 'Важно отметить прогресс',
    kancelyarit: 'Практика является частью терапии',
    filler: 'Это ключевой момент',
    bridges: 'Таким образом, ты справишься',
    symmetry: 'С одной стороны это страшно',
  };

  it('в PATTERNS нет имени без образца в POSITIVE', () => {
    const missing = PATTERNS.map((p) => p.name).filter((n) => !(n in POSITIVE));
    expect(missing).toEqual([]);
  });

  it.each(PATTERNS.map((p) => [p.name] as const))(
    'паттерн «%s» ловит свой образец',
    (name) => {
      const p = PATTERNS.find((x) => x.name === name)!;
      const re = new RegExp(p.source, p.flags);
      expect(re.test(POSITIVE[name])).toBe(true);
    },
  );

  // Задокументированные в комментариях исключения: паттерн НЕ обязан их ловить.
  it.each([
    [
      'kancelyarit',
      'Тревога проявляется по-разному',
      'lookbehind не даёт «являет(ся)» поймать «проявляется»',
    ],
    ['kancelyarit', 'Симптом появляется вечером', 'то же для «появляется»'],
    [
      'kancelyarit',
      'Мысль воспроизводится снова',
      '«производится» не ловит «воспроизводится»',
    ],
    [
      'filler',
      'Значимые люди в его жизни',
      'термин «значимые люди» выведен из-под правила намеренно',
    ],
  ] as const)('паттерн «%s» НЕ ловит «%s» (%s)', (name, text) => {
    const p = PATTERNS.find((x) => x.name === name)!;
    const re = new RegExp(p.source, p.flags);
    expect(re.test(text)).toBe(false);
  });
});
