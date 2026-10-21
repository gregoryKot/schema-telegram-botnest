// Тест гейта check-agent-docs.mjs — «документы для агентов не врут».
//
// Гейт держит CLAUDE.md в бюджете (он грузится в каждую сессию), требует
// `paths:` у правил `.claude/rules/`, а карту кода (docs/ARCHITECTURE.md +
// docs/architecture/*.md) — в согласии с деревом: каталоги и гейты названы,
// пути в обратных кавычках живы, ссылки ведут куда-то, реестры открытого
// проиндексированы. Сломанный гейт не краснеет — карта гнила бы молча.
//
// Оба исхода (правило проекта): чистое дерево зелёное, каждая из семи проверок
// имеет свой красный случай, и у каждого исключения есть контрольный образец,
// похожий, но незаконный (правило №15 п.2). Тест НЕ гоняет гейт по настоящему
// репозиторию: карта живёт и меняется отдельно, а фикстуры от неё не зависят.
//
// Песочница получает копию скрипта вместе с agent-docs-rules.mjs и
// agent-docs-fs.mjs, поэтому `scripts/` и сам check-agent-docs.mjs — часть
// фикстуры, и карта в ней обязана их называть (как настоящая).
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { runGate } from './gate-sandbox';
import { importExport } from './pattern-loader';

const OK = '✓ документы для агентов';
const CLAUDE = [
  '# Проект',
  '',
  'Короткий индекс. Карта кода — [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).',
  '',
].join('\n');
const MAP = [
  '# Карта кода',
  '',
  'Каталоги: `src/`, `src/bot/`, `scripts/`, `docs/`.',
  'Гейты: `scripts/check-agent-docs.mjs`.',
  '',
].join('\n');
const RULE = '---\npaths:\n  - "src/**"\n---\n\n# Правило\n';
const OPEN_README =
  '# Docs\n\n| Реестр | Файл |\n|---|---|\n| Бэкенд | [open/backend.md](open/backend.md) |\n';

/** Минимальное зелёное дерево; `null` в overrides удаляет файл. */
function tree(
  overrides: Record<string, string | null> = {},
): Record<string, string> {
  const base: Record<string, string> = {
    'CLAUDE.md': CLAUDE,
    'docs/ARCHITECTURE.md': MAP,
    '.claude/rules/tests.md': RULE,
    'src/bot/bot.service.ts': 'export const bot = 1;\n',
  };
  const out: Record<string, string> = { ...base };
  for (const [path, content] of Object.entries(overrides)) {
    if (content === null) delete out[path];
    else out[path] = content;
  }
  return out;
}

const gate = (
  overrides: Record<string, string | null> = {},
  setup?: (tmp: string) => void,
) => runGate('check-agent-docs.mjs', tree(overrides), { setup });

/** N строк, из них первая — заголовок; без хвостового перевода строки + `\n`. */
const linesDoc = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    i === 0 ? '# Проект' : `строка ${i}`,
  ).join('\n') + '\n';

/** CLAUDE.md ровно с `n` видимыми знаками (одна строка-наполнитель). */
const claudeVisible = (n: number) =>
  CLAUDE + 'я'.repeat(n - CLAUDE.length - 1) + '\n';

const bigComment = (n: number) => `<!-- ${'комментарий '.repeat(n)} -->\n`;

describe('check-agent-docs.mjs: чистое дерево', () => {
  it('минимальное дерево зелёное и пишет сводку', () => {
    const res = gate();
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK);
  });
});

describe('check-agent-docs.mjs: 1. бюджет CLAUDE.md', () => {
  it('201 строка краснеет, ровно 200 — нет', () => {
    const red = gate({ 'CLAUDE.md': linesDoc(201) });
    expect(red.status).toBe(1);
    expect(red.stderr).toContain('CLAUDE.md: 201 строк при потолке 200');
    expect(gate({ 'CLAUDE.md': linesDoc(200) }).status).toBe(0);
  });

  it('больше 16000 видимых знаков краснеет, ровно 16000 — нет', () => {
    const red = gate({ 'CLAUDE.md': claudeVisible(16001) });
    expect(red.status).toBe(1);
    expect(red.stderr).toContain('16001 видимых знаков при потолке 16000');
    expect(gate({ 'CLAUDE.md': claudeVisible(16000) }).status).toBe(0);
  });

  it('контроль: блочный HTML-комментарий в бюджет знаков не входит', () => {
    const comment = bigComment(3000);
    expect(comment.length).toBeGreaterThan(30000);
    const res = gate({ 'CLAUDE.md': CLAUDE + comment });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('контроль: комментарий не прячет видимый перебор рядом с ним', () => {
    const res = gate({
      'CLAUDE.md': claudeVisible(16001) + bigComment(10),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('видимых знаков');
  });

  it('нет CLAUDE.md — красное', () => {
    const res = gate({ 'CLAUDE.md': null });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('CLAUDE.md: файла нет');
  });
});

describe('check-agent-docs.mjs: 2. правила .claude/rules', () => {
  it.each([
    ['без frontmatter', '# Правило без шапки\n', 'нет frontmatter'],
    ['frontmatter без paths', '---\ndescription: x\n---\n# P\n', '`paths:`'],
    ['пустая строка в paths', '---\npaths: ""\n---\n# P\n', '`paths:`'],
    [
      'пустой список paths',
      '---\npaths:\ndescription: x\n---\n# P\n',
      '`paths:`',
    ],
    ['пустой frontmatter', '---\n---\n# P\n', '`paths:`'],
  ])('%s — красное, файл назван', (_name, text, phrase) => {
    const res = gate({ '.claude/rules/bad.md': text });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('.claude/rules/bad.md');
    expect(res.stderr).toContain(phrase);
    expect(res.stderr).not.toContain('.claude/rules/tests.md');
  });

  it.each([
    ['список', '---\npaths:\n  - "src/**"\n  - "test/**"\n---\n# P\n'],
    ['строка', '---\npaths: "src/**"\n---\n# P\n'],
    [
      'строка в одинарных кавычках после других ключей',
      "---\ndescription: x\npaths: 'src/**'\n---\n# P\n",
    ],
    ['inline-список', '---\npaths: ["src/**", "test/**"]\n---\n# P\n'],
    ['CRLF', '---\r\npaths:\r\n  - "src/**"\r\n---\r\n# P\r\n'],
  ])('paths как %s — зелёное', (_name, text) => {
    const res = gate({ '.claude/rules/ok.md': text });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('вложенный каталог правил проверяется так же', () => {
    const res = gate({ '.claude/rules/sub/deep.md': '# без шапки\n' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('.claude/rules/sub/deep.md');
  });

  it('файл правила больше 24000 видимых знаков краснеет', () => {
    const res = gate({ '.claude/rules/huge.md': RULE + 'я'.repeat(24001) });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('.claude/rules/huge.md');
    expect(res.stderr).toContain('при потолке 24000');
  });

  it('контроль: комментарий в файле правила в размер не входит', () => {
    const res = gate({ '.claude/rules/huge.md': RULE + bigComment(3000) });
    expect(res.status).toBe(0);
  });

  it('контроль: md вне .claude/rules шапки не требует', () => {
    const res = gate({ '.claude/notes.md': '# заметка без шапки\n' });
    expect(res.status).toBe(0);
  });
});

describe('check-agent-docs.mjs: 3. ссылки', () => {
  it('битая ссылка в CLAUDE.md краснеет и называет строку', () => {
    const res = gate({ 'CLAUDE.md': CLAUDE + '\nСм. [нет](docs/NOPE.md).\n' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('CLAUDE.md:5: ссылка на docs/NOPE.md');
  });

  it('якорь, :строка, каталог и внешние ссылки не мешают', () => {
    const res = gate({
      'CLAUDE.md':
        CLAUDE +
        [
          '[a](docs/ARCHITECTURE.md#карта)',
          '[b](docs/ARCHITECTURE.md:12)',
          '[c](docs/ARCHITECTURE.md:12-20)',
          '[d](src/bot/)',
          '[e](https://example.com/x)',
          '[f](mailto:a@b.c)',
          '[g](#вверх)',
          '[h](/api/health)',
          '',
        ].join('\n'),
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('контроль: ссылка в ограждённом блоке кода не читается', () => {
    const res = gate({
      'CLAUDE.md': CLAUDE + '\n```md\n[пример](docs/NOPE.md)\n```\n',
    });
    expect(res.status).toBe(0);
  });

  it('контроль: ссылка внутри `кода` не читается, а после блока — читается', () => {
    const inline = gate({
      'CLAUDE.md': CLAUDE + '\nСинтаксис: `[текст](docs/NOPE.md)`.\n',
    });
    expect(inline.status).toBe(0);
    const after = gate({
      'CLAUDE.md': CLAUDE + '\n```\nx\n```\n\n[нет](docs/NOPE.md)\n',
    });
    expect(after.status).toBe(1);
    expect(after.stderr).toContain('docs/NOPE.md');
  });

  it('путь считается от каталога файла: ../../CLAUDE.md из правила живой, ../CLAUDE.md — нет', () => {
    const ok = gate({
      '.claude/rules/tests.md': RULE + '[ok](../../CLAUDE.md)\n',
    });
    expect(ok.status).toBe(0);
    const bad = gate({
      '.claude/rules/tests.md': RULE + '[bad](../CLAUDE.md)\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('.claude/rules/tests.md');
  });

  it.each([
    ['docs/architecture/x.md', '# Область\n\n[нет](../NOPE.md)\n'],
    ['docs/open/backend.md', '# Реестр\n\n[нет](../NOPE.md)\n'],
    ['docs/agent/NAV_LOG.md', '# Журнал\n\n[нет](../NOPE.md)\n'],
    ['docs/ARCHITECTURE.md', MAP + '[нет](NOPE.md)\n'],
  ])('ссылки в %s тоже проверяются', (file, text) => {
    const res = gate({
      'docs/open/backend.md': '# Реестр\n',
      'docs/README.md': OPEN_README,
      [file]: text,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${file}:`);
    expect(res.stderr).toContain('NOPE.md');
  });

  it('контроль: файлы вне перечня (docs/archive) не проверяются', () => {
    const res = gate({ 'docs/archive/old.md': '[нет](NOPE.md)\n' });
    expect(res.status).toBe(0);
  });
});

describe('check-agent-docs.mjs: 4. карта называет каждый каталог', () => {
  it('неупомянутый подкаталог src/ краснеет и назван полным путём', () => {
    const res = gate({ 'src/foo/foo.ts': 'export const f = 1;\n' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('в карте нет каталога src/foo/');
    expect(res.stderr).toContain('docs/architecture/<область>.md');
    expect(res.stderr).not.toContain('src/bot/');
  });

  it('неупомянутый каталог верхнего уровня краснеет', () => {
    const res = gate({ 'assets/logo.svg': '<svg/>' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('в карте нет каталога assets/');
  });

  it('каталоги корней webapp/src, schema-miniapp/src, shared/src тоже читаются', () => {
    const files = {
      'webapp/src/pages/Home.tsx': 'export {};\n',
      'schema-miniapp/src/hooks/useX.ts': 'export {};\n',
      'shared/src/about/aboutData.ts': 'export {};\n',
    };
    const res = gate(files);
    expect(res.status).toBe(1);
    for (const d of [
      'webapp/',
      'schema-miniapp/',
      'shared/',
      'webapp/src/pages/',
      'schema-miniapp/src/hooks/',
      'shared/src/about/',
    ]) {
      expect(res.stderr).toContain(`в карте нет каталога ${d}`);
    }
    const mapped = gate({
      ...files,
      'docs/ARCHITECTURE.md':
        MAP +
        '`webapp/` `webapp/src/` `webapp/src/pages/` `schema-miniapp/` `schema-miniapp/src/hooks/`' +
        ' `shared/` `shared/src/about/`\n',
    });
    expect(mapped.stderr).not.toContain('webapp/src/pages/');
    expect(mapped.status).toBe(0);
  });

  it('контроль: `shared/src/pages/` не закрывает `src/pages/`', () => {
    const res = gate({
      'src/pages/p.ts': 'export {};\n',
      'shared/src/pages/p.ts': 'export {};\n',
      'docs/ARCHITECTURE.md':
        MAP + '`shared/` `shared/src/` `shared/src/pages/`\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('в карте нет каталога src/pages/');
    expect(res.stderr).not.toContain('в карте нет каталога shared/src/pages/');
  });

  it('служебные каталоги не требуют записи: node_modules, dist, coverage, снимки, dot-каталоги', () => {
    const res = gate({
      'node_modules/pkg/index.js': '',
      'dist/main.js': '',
      'coverage/lcov.info': '',
      'build/out.js': '',
      '.cache/x.json': '{}',
      'src/__snapshots__/a.snap': '',
      'src/dist/bundle.js': '',
      'src/.jest-cache/x': '',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('каталог, целиком записанный в .gitignore, и пустой каталог записи не требуют', () => {
    const res = gate(
      {
        '.gitignore': '/reports/\ntest-results\n',
        'reports/r.json': '{}',
        'test-results/t.json': '{}',
      },
      (tmp) => mkdirSync(join(tmp, 'src', 'empty'), { recursive: true }),
    );
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('контроль: каталога нет в .gitignore — запись нужна', () => {
    const res = gate({ '.gitignore': '/reports/\n', 'output/o.json': '{}' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('в карте нет каталога output/');
  });

  it('нет docs/ARCHITECTURE.md — красное', () => {
    const res = gate({ 'docs/ARCHITECTURE.md': null });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('docs/ARCHITECTURE.md: файла нет');
  });

  it('упоминание только в docs/architecture/*.md засчитывается', () => {
    const res = gate({
      'src/foo/foo.ts': 'export const f = 1;\n',
      'scripts/check-foo.mjs': '//\n',
      'docs/architecture/backend.md':
        '# Бэкенд\n\n`src/foo/` — модуль foo. Гейт `scripts/check-foo.mjs`.\n',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('контроль: docs/architecture есть, но каталог в нём не назван — красное', () => {
    const res = gate({
      'src/foo/foo.ts': 'export const f = 1;\n',
      'docs/architecture/backend.md': '# Бэкенд\n\n`src/bot/`\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('в карте нет каталога src/foo/');
  });
});

describe('check-agent-docs.mjs: 5. карта называет каждый гейт', () => {
  it.each(['check-foo.mjs', 'check-foo.ts'])(
    'гейт scripts/%s без упоминания краснеет',
    (name) => {
      const res = gate({ [`scripts/${name}`]: '//\n' });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(`scripts/${name}: гейта нет в карте`);
      expect(res.stderr).not.toContain('scripts/check-agent-docs.mjs');
    },
  );

  it('упоминание по имени засчитывается, с путём и без', () => {
    const res = gate({
      'scripts/check-foo.mjs': '//\n',
      'scripts/check-bar.ts': '//\n',
      'docs/ARCHITECTURE.md':
        MAP + 'Гейт check-foo.mjs и `scripts/check-bar.ts`.\n',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('контроль: имя другого гейта не закрывает этот', () => {
    const res = gate({
      'scripts/check-foo.mjs': '//\n',
      'scripts/check-foo-bar.mjs': '//\n',
      'docs/ARCHITECTURE.md': MAP + '`scripts/check-foo-bar.mjs`\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('scripts/check-foo.mjs: гейта нет в карте');
    expect(res.stderr).not.toContain('scripts/check-foo-bar.mjs');
  });

  it('контроль: не-гейты в scripts/ записи не требуют', () => {
    const res = gate({
      'scripts/helper.mjs': '//\n',
      'scripts/foo-baseline.json': '{}',
      'scripts/check-foo.sh': '#!/bin/sh\n',
    });
    expect(res.status).toBe(0);
  });
});

describe('check-agent-docs.mjs: 6. пути в обратных кавычках', () => {
  it('несуществующий путь в CLAUDE.md и в карте краснеет', () => {
    const res = gate({
      'CLAUDE.md': CLAUDE + '\nСм. `src/bot/gone.service.ts`.\n',
      'docs/ARCHITECTURE.md': MAP + '\nСтарое: `scripts/old-baseline.json`\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'CLAUDE.md: путь `src/bot/gone.service.ts` не существует',
    );
    expect(res.stderr).toContain(
      'docs/ARCHITECTURE.md: путь `scripts/old-baseline.json` не существует',
    );
  });

  it('и в docs/architecture/*.md тоже', () => {
    const res = gate({
      'docs/architecture/x.md':
        '`src/missing/` и `.github/workflows/gone.yml`\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('docs/architecture/x.md: путь `src/missing/`');
    expect(res.stderr).toContain('`.github/workflows/gone.yml`');
  });

  it('существующие файлы, каталоги и пути со :строкой, диапазоном и #якорем — зелёное', () => {
    const res = gate({
      'CLAUDE.md':
        CLAUDE +
        '\n`src/bot/bot.service.ts` `src/bot/` `src/bot/bot.service.ts:12` ' +
        '`src/bot/bot.service.ts:12-34` `src/bot/bot.service.ts#L10` `.claude/rules/tests.md`\n',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('контроль: :строка не прячет несуществующий файл', () => {
    const res = gate({ 'CLAUDE.md': CLAUDE + '\n`src/bot/gone.ts:12-34`\n' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('`src/bot/gone.ts:12-34`');
  });

  it('контроль: путь с «/» на конце обязан быть каталогом, а не файлом', () => {
    const res = gate({ 'CLAUDE.md': CLAUDE + '\n`src/bot/bot.service.ts/`\n' });
    expect(res.status).toBe(1);
  });

  it.each([
    ['глоб', '`src/**/*.spec.ts`'],
    ['заглушка', '`src/<модуль>/x.ts`'],
    ['фигурные скобки', '`src/{bot,api}/x.ts`'],
    ['многоточие', '`src/bot/…`'],
    ['три точки', '`src/bot/...`'],
    ['пробел (команда)', '`src/gone.ts --update`'],
    ['альтернатива', '`src/a.ts|src/b.ts`'],
    ['каталог сборки', '`src/dist/bundle.js`'],
    ['чужой префикс', '`./gone/x.ts` и `foo/bar.ts`'],
  ])('%s — токен не читается', (_name, token) => {
    const res = gate({ 'CLAUDE.md': CLAUDE + `\n${token}\n` });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('контроль: путь внутри ограждённого блока — не токен', () => {
    const res = gate({
      'CLAUDE.md': CLAUDE + '\n```\ncat `src/gone.ts`\n```\n',
    });
    expect(res.status).toBe(0);
  });

  it('контроль: правила .claude/rules этой проверкой не охвачены (там исторические пути)', () => {
    const res = gate({ '.claude/rules/tests.md': RULE + '`src/gone.ts`\n' });
    expect(res.status).toBe(0);
  });
});

describe('check-agent-docs.mjs: 7. индекс открытого', () => {
  const open = { 'docs/open/backend.md': '# Реестр\n' };

  it('реестр без ссылки в docs/README.md краснеет', () => {
    const res = gate({
      ...open,
      'docs/open/security.md': '# Реестр\n',
      'docs/README.md': OPEN_README,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('нет ссылки на docs/open/security.md');
    expect(res.stderr).not.toContain('нет ссылки на docs/open/backend.md');
  });

  it('ссылки open/x.md, ./open/x.md и open/x.md#якорь засчитываются', () => {
    const res = gate({
      'docs/open/a.md': '#\n',
      'docs/open/b.md': '#\n',
      'docs/open/c.md': '#\n',
      'docs/README.md': '[a](open/a.md) [b](./open/b.md) [c](open/c.md#top)\n',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('контроль: упоминание в тексте и в блоке кода — не ссылка', () => {
    const res = gate({
      ...open,
      'docs/README.md':
        'Смотри open/backend.md.\n\n```\n[x](open/backend.md)\n```\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('нет ссылки на docs/open/backend.md');
  });

  it('есть реестры, но нет docs/README.md — красное', () => {
    const res = gate(open);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('docs/README.md: файла нет');
  });

  it('контроль: без docs/open индекс не нужен', () => {
    expect(gate({ 'docs/README.md': '# Docs\n' }).status).toBe(0);
  });

  // Ветка, начатая до разделения реестра, при слиянии вписывает запись в
  // старое место — в раздел README. Индекс обязан остаться таблицей.
  const INDEX =
    '## Что осталось открытым\n\nРеестр по областям.\n\n| Файл |\n|---|\n| [open/backend.md](open/backend.md) |\n';
  it.each([
    ['жирная запись', '**Новая находка** (#900): что сломано.\n'],
    ['пункт списка', '- **Флак** в `src/x.spec.ts`.\n'],
  ])('запись в индексе краснеет: %s', (_label, entry) => {
    const res = gate({
      ...open,
      'docs/README.md': `# Docs\n\n${INDEX}\n${entry}`,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('запись реестра в индексе');
  });

  it('контроль: записи в других разделах README законны', () => {
    const res = gate({
      ...open,
      'docs/README.md': `# Docs\n\n## Актуальное\n\n- **ENV.md** — переменные.\n\n${INDEX}`,
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });
});

// Чистые функции движка: проверяются напрямую, без песочницы.
describe('agent-docs-rules.mjs: чистые функции', () => {
  const call = (name: string, ...args: unknown[]): unknown =>
    JSON.parse(
      importExport(
        'agent-docs-rules.mjs',
        name,
        `(fn) => fn(...${JSON.stringify(args)})`,
      ),
    );

  it('countLines считает как wc -l', () => {
    expect(call('countLines', '')).toBe(0);
    expect(call('countLines', 'a\n')).toBe(1);
    expect(call('countLines', 'a\nb')).toBe(2);
    expect(call('countLines', 'a\n\nb\n')).toBe(3);
  });

  it('visibleText вырезает блочные комментарии, в том числе многострочные', () => {
    expect(call('visibleText', 'a<!-- x\ny -->b<!--z-->c')).toBe('abc');
    expect(call('visibleText', 'нет комментариев')).toBe('нет комментариев');
  });

  it('parseFrontmatter: формы paths и отсутствие шапки', () => {
    expect(call('parseFrontmatter', '# P')).toBeNull();
    expect(
      call('parseFrontmatter', '---\npaths:\n  - "a/**"\n  - b\n---\n'),
    ).toEqual({
      paths: ['a/**', 'b'],
    });
    expect(call('parseFrontmatter', '---\npaths: "a/**"\n---')).toEqual({
      paths: ['a/**'],
    });
    expect(call('parseFrontmatter', '---\npaths: [a, "b"]\n---\n')).toEqual({
      paths: ['a', 'b'],
    });
    expect(call('parseFrontmatter', '---\nname: x\n---\n')).toEqual({
      paths: [],
    });
    expect(call('parseFrontmatter', '---\npaths:\n---\n')).toEqual({
      paths: [],
    });
  });

  it('inlineCodeTokens: токены вне блоков, цепочки из нескольких кавычек', () => {
    expect(
      call('inlineCodeTokens', 'a `x/y` b ``c`d`` e\n```\n`z`\n```\n`w`'),
    ).toEqual(['x/y', 'c`d', 'w']);
  });

  it('markdownLinks: номера строк, заголовок ссылки, код пропущен', () => {
    expect(
      call(
        'markdownLinks',
        'a\n[x](p.md "t") `[y](q.md)`\n```\n[z](r.md)\n```\n![i](img.png)',
      ),
    ).toEqual([
      { target: 'p.md', line: 2 },
      { target: 'img.png', line: 6 },
    ]);
  });

  it.each([
    ['https://a.b/c', null],
    ['mailto:a@b.c', null],
    ['#top', null],
    ['/api/x', null],
    ['x.md#a', 'x.md'],
    ['x.md?plain=1', 'x.md'],
    ['x.ts:12', 'x.ts'],
    ['x.ts:12-20', 'x.ts'],
    ['dir/with%20space.md', 'dir/with space.md'],
  ])('linkFilePath(%s) → %s', (target, expected) => {
    expect(call('linkFilePath', target)).toBe(expected);
  });

  it.each([
    ['src/a.ts:12', 'src/a.ts'],
    ['src/a.ts:12-34', 'src/a.ts'],
    ['src/a.ts#L5', 'src/a.ts'],
    ['.github/workflows/ci.yml', '.github/workflows/ci.yml'],
    ['src/*.ts', null],
    ['src/a b.ts', null],
    ['webapp/dist/index.html', null],
    ['other/a.ts', null],
    ['srcx/a.ts', null],
  ])('tokenRepoPath(%s) → %s', (token, expected) => {
    expect(call('tokenRepoPath', token, ['src', 'webapp'])).toBe(expected);
  });

  it('mentionsDir: подпуть чужого корня не засчитывается, ./ и ../ — да', () => {
    expect(call('mentionsDir', '`src/bot/`', 'src/bot')).toBe(true);
    expect(call('mentionsDir', '../../src/bot/x', 'src/bot')).toBe(true);
    expect(call('mentionsDir', 'shared/src/bot/', 'src/bot')).toBe(false);
    expect(call('mentionsDir', 'src/bot-old/', 'src/bot')).toBe(false);
  });

  it('mentionsFile: целое имя, не кусок другого', () => {
    expect(call('mentionsFile', '`scripts/check-a.mjs`.', 'check-a.mjs')).toBe(
      true,
    );
    expect(call('mentionsFile', 'гейт (check-a.mjs)', 'check-a.mjs')).toBe(
      true,
    );
    expect(call('mentionsFile', 'recheck-a.mjs', 'check-a.mjs')).toBe(false);
    expect(call('mentionsFile', 'check-a.mjs-x', 'check-a.mjs')).toBe(false);
  });
});

describe('agent-docs-fs.mjs: чтение дерева', () => {
  it('topLevelDirs: без dot-каталогов, мусора сборки, игнорируемого и пустых', () => {
    const tmp = mkdtempSync(join(realpathSync(tmpdir()), 'agent-docs-fs-'));
    try {
      const put = (rel: string) => {
        mkdirSync(dirname(join(tmp, rel)), { recursive: true });
        writeFileSync(join(tmp, rel), '');
      };
      [
        'src/a.ts',
        'docs/d.md',
        '.hidden/h',
        'dist/o',
        'node_modules/m',
        'reports/r',
      ].forEach(put);
      writeFileSync(join(tmp, '.gitignore'), '/reports/\n');
      mkdirSync(join(tmp, 'empty'));
      const out = importExport(
        'agent-docs-fs.mjs',
        'topLevelDirs',
        `(fn) => fn(${JSON.stringify(tmp)})`,
      );
      expect(JSON.parse(out)).toEqual(['docs', 'src']);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
