// У каждой команды из docs/RUNBOOKS.md есть смок (правило №14): команда без прогона
// ломается молча и всплывает только в аварии. Нет теста — строка в DEBT с причиной.
import { existsSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { collectSourceFiles } from '../security/collect-source-files';

const ROOT = join(__dirname, '..', '..');

// Команда ранбука без смока → причина. Список только сокращается.
const DEBT: Record<string, string> = {};

type RunbookCommand = {
  kind: 'script' | 'npm' | 'npx';
  key: string;
  /** Что тест обязан назвать: имя файла скрипта, `run X` или инструмент с подкомандой. */
  words: string[];
};

/** Тексты блоков кода и инлайн-кода; инлайн-код переносится внутри абзаца. */
function codeSpans(md: string): string[] {
  const spans: string[] = [];
  const prose = md.replace(
    /^[ \t]*(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm,
    (_all, _fence, body: string) => {
      spans.push(body);
      return '';
    },
  );
  for (const m of prose.matchAll(/`((?:[^`\n]|\n(?![ \t]*\n))+)`/g)) {
    spans.push(m[1]);
  }
  return spans.map((s) => s.replace(/\\\n/g, ' ').replace(/\s+/g, ' '));
}

const SCRIPT_RE =
  /(?<![\w./-])(?:\.\/)?(scripts\/[\w./-]*\.(?:sh|mjs|cjs|js|ts))(?![\w.-])/g;
const NPM_RE = /\bnpm (?:--prefix \S+ )?run ([\w:.-]+)/g;
const NPX_RE = /\bnpx (?:-\S+ )*([@\w./-]+(?: [a-z][\w:-]*(?=\s|$))*)/g;

/** Команды из кода markdown: скрипты `scripts/*`, `npm run X`, `npx инструмент подкоманда`. */
function runbookCommands(md: string): RunbookCommand[] {
  const found = new Map<string, RunbookCommand>();
  const add = (kind: RunbookCommand['kind'], key: string, words: string[]) =>
    found.set(key, { kind, key, words });
  for (const span of codeSpans(md)) {
    for (const m of span.matchAll(SCRIPT_RE)) {
      add('script', m[1], [basename(m[1])]);
    }
    for (const m of span.matchAll(NPM_RE)) {
      add('npm', `npm run ${m[1]}`, ['run', m[1]]);
    }
    for (const m of span.matchAll(NPX_RE)) {
      add('npx', `npx ${m[1]}`, m[1].split(' '));
    }
  }
  return [...found.values()];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ключи команд, которые не называет ни один тест из `corpus`. */
function missingSmoke(commands: RunbookCommand[], corpus: string): string[] {
  return commands
    .filter((c) => {
      const words = c.words.map(escapeRe).join(`[\\s'"\`,]+`);
      return !new RegExp(`(?<![\\w.-])${words}(?![\\w:.-])`).test(corpus);
    })
    .map((c) => c.key);
}

describe('разбор команд ранбука (самопроверка)', () => {
  const md = [
    'Скачать: `scripts/fetch.sh <каталог>`, проверить `npm run check-x`.',
    '',
    '```',
    'KEY=<ключ> bash scripts/restore.sh \\',
    '  file.enc [DATABASE_URL]',
    'npx prisma migrate resolve --rolled-back 1_init',
    '```',
    '',
    'Вне кода — не команда: bash scripts/prose.sh. А `curl -sD -',
    '  https://x/health` — не шаблон команды.',
  ].join('\n');
  const commands = runbookCommands(md);

  it('берёт команды только из кода, в том числе с переносом строки', () => {
    expect(commands.map((c) => c.key).sort()).toEqual([
      'npm run check-x',
      'npx prisma migrate resolve',
      'scripts/fetch.sh',
      'scripts/restore.sh',
    ]);
  });

  it('команда без упоминания в тестах — в отчёте, упомянутая — нет', () => {
    const corpus = [
      "spawnSync('bash', [join('scripts', 'restore.sh')]);",
      '// npm run check-x',
      "run('prisma', 'migrate', 'resolve');",
    ].join('\n');
    expect(missingSmoke(commands, corpus)).toEqual(['scripts/fetch.sh']);
    expect(missingSmoke(commands, `${corpus}\nbash('fetch.sh')`)).toEqual([]);
  });

  it('похожее имя смоком не считается', () => {
    const corpus = 'prefetch.sh restore.sh.bak npm run check-xy prisma migrate';
    expect(missingSmoke(commands, corpus)).toHaveLength(commands.length);
  });
});

const TEST_ROOTS = ['src', 'test', 'e2e-browser', 'webapp/src', 'shared/src'];
const TEST_FILE =
  /\.(spec|test|e2e-spec)\.[cm]?[jt]sx?$|[\\/](test-support|e2e-support)[\\/]/;

/** Тексты всех спеков, тестов и их опор, кроме этого файла. */
function testCorpus(): string {
  return TEST_ROOTS.flatMap((dir) =>
    collectSourceFiles(join(ROOT, dir), {
      extensions: ['.ts', '.tsx', '.mjs', '.cjs', '.js'],
      includeTests: true,
      filter: (p) => p !== __filename && TEST_FILE.test(p),
    }),
  )
    .map((p) => readFileSync(p, 'utf8'))
    .join('\n');
}

const npmScripts = new Set(
  ['package.json', 'webapp/package.json', 'shared/package.json'].flatMap(
    (p) => {
      const pkg = JSON.parse(readFileSync(join(ROOT, p), 'utf8')) as {
        scripts?: Record<string, string>;
      };
      return Object.keys(pkg.scripts ?? {});
    },
  ),
);

/** Скрипт лежит в репозитории, npm-скрипт объявлен; npx может скачать инструмент сам. */
function exists(c: RunbookCommand): boolean {
  if (c.kind === 'script') return existsSync(join(ROOT, c.key));
  return c.kind === 'npx' || npmScripts.has(c.words[1]);
}

describe('docs/RUNBOOKS.md: у каждой команды есть смок', () => {
  const commands = runbookCommands(
    readFileSync(join(ROOT, 'docs', 'RUNBOOKS.md'), 'utf8'),
  );
  const missing = missingSmoke(commands, testCorpus());

  it('команды нашлись (разбор не ослеп)', () => {
    expect(commands.map((c) => c.key)).toContain('scripts/restore-backup.sh');
  });

  it('команда не устарела: скрипт на месте, npm-скрипт объявлен', () => {
    expect(commands.filter((c) => !exists(c)).map((c) => c.key)).toEqual([]);
  });

  it('каждую команду называет спек или тест', () => {
    expect(missing.filter((k) => !(k in DEBT))).toEqual([]);
  });

  it('DEBT не протух: в нём только команды ранбука без смока', () => {
    expect(Object.keys(DEBT).filter((k) => !missing.includes(k))).toEqual([]);
  });
});
