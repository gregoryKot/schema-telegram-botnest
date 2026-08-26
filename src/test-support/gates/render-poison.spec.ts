// Тест гейта check-render-poison.mjs (расследование скорости 2026-08-26):
// пофайловый храповик backdrop-filter/filter: blur во фронтендах — в
// установленном на телефон PWA WebKit считает их программно, ~1.4с на кадр.
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate, cleanupTmp } from './gate-sandbox';
import { loadNamedPatterns } from './pattern-loader';

describe('check-render-poison.mjs', () => {
  it('новый файл с backdropFilter (JSX) — exit 1', () => {
    const res = runGate('check-render-poison.mjs', {
      'scripts/render-poison-baseline.json': JSON.stringify({}),
      'webapp/src/foo.tsx':
        "export const x = <div style={{ backdropFilter: 'blur(8px)' }} />;\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'webapp/src/foo.tsx: новый файл с 1 нарушениями',
    );
    expect(res.stderr).toContain('backdropFilter');
  });

  it('backdrop-filter в .css — exit 1', () => {
    const res = runGate('check-render-poison.mjs', {
      'scripts/render-poison-baseline.json': JSON.stringify({}),
      'schema-miniapp/src/foo.css': '.nav { backdrop-filter: blur(10px); }\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'schema-miniapp/src/foo.css: новый файл с 1 нарушениями',
    );
  });

  it('-webkit-backdrop-filter (вендорный префикс) — exit 1', () => {
    const res = runGate('check-render-poison.mjs', {
      'scripts/render-poison-baseline.json': JSON.stringify({}),
      'webapp/src/foo.css': '.x { -webkit-backdrop-filter: blur(4px); }\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('css-backdrop-filter-webkit');
  });

  it('рост счётчика в известном файле — exit 1 с "было → стало"', () => {
    const res = runGate('check-render-poison.mjs', {
      'scripts/render-poison-baseline.json': JSON.stringify({
        'webapp/src/known.css': 1,
      }),
      'webapp/src/known.css': [
        '.a { backdrop-filter: blur(4px); }',
        '.b { filter: blur(6px); }',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/known.css: 1 → 2');
  });

  it('снижение счётчика — exit 0, предлагает зафиксировать --update', () => {
    const res = runGate('check-render-poison.mjs', {
      'scripts/render-poison-baseline.json': JSON.stringify({
        'webapp/src/known.css': 2,
      }),
      'webapp/src/known.css': '.a { backdrop-filter: blur(4px); }\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 < 2 — стало лучше');
  });

  it('значение none (выключатель размытия) НЕ считается', () => {
    const res = runGate('check-render-poison.mjs', {
      'scripts/render-poison-baseline.json': JSON.stringify({}),
      // Тот же приём, что schema-miniapp/src/utils/perfExperiments.ts:
      // экспериментальный CSS-переключатель, а не поражённый код.
      'schema-miniapp/src/utils/perfExperiments.ts':
        "const off = '*{backdrop-filter:none!important;" +
        "-webkit-backdrop-filter:none!important;filter:none!important}';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик размытия: 0 (без роста)');
  });

  it('упоминание в // -комментарии НЕ считается', () => {
    const res = runGate('check-render-poison.mjs', {
      'scripts/render-poison-baseline.json': JSON.stringify({}),
      'schema-miniapp/src/components/Foo.tsx': [
        'export function Foo() {',
        '  return (',
        '    <div',
        '      style={{',
        '        // Без backdrop-filter — см. BottomNav.tsx (замеры 2026-08-26).',
        "        background: 'var(--nav-bg)',",
        '      }}',
        '    />',
        '  );',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик размытия: 0 (без роста)');
  });

  it('упоминание в /* */ -комментарии (в т.ч. с двоеточием сразу после имени) НЕ считается', () => {
    // Реальный фрагмент webapp/src/index.css: комментарий говорит именно
    // «backdrop-filter:» с двоеточием — без вырезания комментария такая
    // строка ложно матчится как настоящее объявление свойства.
    const res = runGate('check-render-poison.mjs', {
      'scripts/render-poison-baseline.json': JSON.stringify({}),
      'webapp/src/index.css': [
        '.mobile-nav {',
        '  background: var(--nav-bg);',
        '  /* Без backdrop-filter: в установленном на телефон приложении (PWA) iOS',
        '     считает размытие программно, и каждый кадр экрана стоил ~1.4с —',
        '     приложение вязло метрономом. */',
        '  border-top: 1px solid var(--line);',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик размытия: 0 (без роста)');
  });

  it('*.test.tsx не сканируется', () => {
    const res = runGate('check-render-poison.mjs', {
      'scripts/render-poison-baseline.json': JSON.stringify({}),
      'webapp/src/foo.test.tsx':
        "export const x = <div style={{ backdropFilter: 'blur(8px)' }} />;\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик размытия: 0 (без роста)');
  });

  it('нет бейслайна — понятная ошибка, exit 1', () => {
    const res = runGate('check-render-poison.mjs', {
      'webapp/src/clean.css': '.a { color: red; }\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Нет бейслайна');
  });

  it('--update пишет отсортированный бейслайн', () => {
    const res = runGate(
      'check-render-poison.mjs',
      {
        'webapp/src/z.css': '.a { backdrop-filter: blur(4px); }\n',
        'webapp/src/a.css': '.a { backdrop-filter: blur(4px); }\n',
      },
      { args: ['--update'], keepTmp: true },
    );
    expect(res.status).toBe(0);
    const written = JSON.parse(
      readFileSync(
        join(res.tmp, 'scripts/render-poison-baseline.json'),
        'utf8',
      ),
    );
    expect(Object.keys(written)).toEqual([
      'webapp/src/a.css',
      'webapp/src/z.css',
    ]);
    cleanupTmp(res.tmp);
  });

  it('вне SCAN_DIRS (например src/) не сканируется', () => {
    const res = runGate('check-render-poison.mjs', {
      'scripts/render-poison-baseline.json': JSON.stringify({}),
      'src/some-backend-file.ts':
        "const style = { backdropFilter: 'blur(8px)' };\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик размытия: 0 (без роста)');
  });

  it('в .css строка с url(https://…) не прячет размытие: `//` там не комментарий', () => {
    // Дыра ревью 2026-08-26: движок резал `//` во всех файлах, и объявление
    // после незакавыченного адреса становилось невидимым для гейта.
    const res = runGate('check-render-poison.mjs', {
      'scripts/render-poison-baseline.json': JSON.stringify({}),
      'schema-miniapp/src/theme.css':
        '.a { background: url(https://cdn.example.com/x.png); backdrop-filter: blur(4px); }\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('schema-miniapp/src/theme.css');
  });

  it('КОНТРОЛЬ: то же значение backdrop-filter вне комментария — по-прежнему exit 1', () => {
    const res = runGate('check-render-poison.mjs', {
      'scripts/render-poison-baseline.json': JSON.stringify({}),
      'schema-miniapp/src/components/Bar.tsx':
        "export const x = <div style={{ backdropFilter: 'blur(8px)' }} />; // не убрано\n",
    });
    expect(res.status).toBe(1);
  });
});

// Механизм вместо добросовестности: у каждого именованного паттерна — живой
// образец, который ловит именно он (см. robot-phrases.spec.ts). Новый
// паттерн без образца в POSITIVE роняет первый тест ниже сразу.
describe('каждый паттерн пойман своим образцом', () => {
  const PATTERNS = loadNamedPatterns('render-poison-patterns.mjs', 'PATTERNS');

  const POSITIVE: Record<string, string> = {
    'css-backdrop-filter': '.a { backdrop-filter: blur(6px); }',
    'css-backdrop-filter-webkit': '.a { -webkit-backdrop-filter: blur(6px); }',
    'jsx-backdrop-filter': "{ backdropFilter: 'blur(8px)' }",
    'jsx-backdrop-filter-webkit': "{ WebkitBackdropFilter: 'blur(8px)' }",
    'filter-blur': "{ filter: 'blur(120px)' }",
    'filter-blur-webkit': '.a { -webkit-filter: blur(120px); }',
    'filter-blur-jsx-webkit': "{ WebkitFilter: 'blur(120px)' }",
  };

  // Размытие возвращают не только объявлением через двоеточие. Формы найдены
  // адверсариальным ревью 2026-08-26: до их закрытия гейт молчал на всех
  // трёх, хотя перед ним стояла ровно задача не пустить blur обратно.
  const IMPERATIVE: [string, string][] = [
    ['jsx-backdrop-filter', "el.style.backdropFilter = 'blur(4px)'"],
    ['css-backdrop-filter', "setProperty('backdrop-filter', 'blur(4px)')"],
    ['css-backdrop-filter', "{ 'backdrop-filter': 'blur(4px)' }"],
  ];

  it.each(IMPERATIVE)(
    'паттерн «%s» ловит и не-объявление: %s',
    (name, sample) => {
      const p = PATTERNS.find((x) => x.name === name)!;
      expect(new RegExp(p.source, p.flags).test(sample)).toBe(true);
    },
  );

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

  // Значение none — задокументированное исключение (эксперимент noblur):
  // паттерны на backdrop-filter НЕ обязаны его ловить.
  it.each([
    ['css-backdrop-filter', 'backdrop-filter:none!important'],
    ['css-backdrop-filter-webkit', '-webkit-backdrop-filter:none!important'],
    ['jsx-backdrop-filter', "backdropFilter: 'none'"],
    ['jsx-backdrop-filter-webkit', "WebkitBackdropFilter: 'none'"],
  ])('паттерн «%s» НЕ ловит значение none: %s', (name, sample) => {
    const p = PATTERNS.find((x) => x.name === name)!;
    const re = new RegExp(p.source, p.flags);
    expect(re.test(sample)).toBe(false);
  });
});
