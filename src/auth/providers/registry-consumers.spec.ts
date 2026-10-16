// Сверка реестра провайдеров входа с фронтом (правило №4, №14; находка
// аудита 2026-10 «мёртвый роут /api/auth/telegram-oidc»).
//
// Провайдер, зарегистрированный в registry.ts, открывает публичный вход
// `/api/auth/<id>`. Если ни один экран его не зовёт, это мёртвая поверхность
// с расползающейся логикой — а в случае telegram-oidc ещё и вход, который
// рождал второй web-only аккаунт вместо `userId = telegramId`. check-feature-
// parity.mjs смотрит только в src/api/**, контроллеры src/auth/* для него
// слепая зона, поэтому класс закрыт здесь.
//
// Потребитель — НЕ-тестовый файл фронта (webapp/src, schema-miniapp/src,
// shared/src), в котором есть вызов `/api/auth/<id>` вне комментария (блочного,
// JSX-шного или хвостового `//`). Спек в потребители не годится (правило №11).
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { collectSourceFiles } from '../../security/collect-source-files';

const ROOT = join(__dirname, '..', '..', '..');
const PROVIDERS_DIR = __dirname;
const FRONT_DIRS = ['webapp/src', 'schema-miniapp/src', 'shared/src'];

// Исключения: id провайдера → причина, почему у него законно нет фронтового
// потребителя. Пусто намеренно (правило №15): вход без потребителя удаляют.
const ALLOW: Record<string, string> = {};

const TEST_FILE = /(\.(test|spec)\.(ts|tsx)$|[\\/]__tests__[\\/])/;

/** id провайдеров из `readonly id = '…'` в *.provider.ts (без спеков). */
export function providerIdsOf(source: string): string[] {
  return [...source.matchAll(/readonly id = '([^']+)'/g)].map((m) => m[1]);
}

// Строка в любой из трёх кавычек ИЛИ комментарий. Альтернативы пробуются слева
// направо с каждой позиции, поэтому оба направления работают сами: `//` внутри
// строки комментарием не становится ('https://host/api/auth/x' — адрес), а
// кавычка внутри комментария его не открывает. Одинокий апостроф в тексте JSX
// парной кавычки до конца строки не находит и строкой не считается.
// `(?<!:)` — запас на `https://` вне кавычек (текст внутри JSX-тега).
const STRING_OR_COMMENT =
  /('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|(?<!:)\/\/[^\n]*/g;

// Код без комментариев: блочных (в том числе многострочных и JSX-шных
// `{/* … */}`) и `//` — и полностроковых, и хвостовых. Содержимое строк
// остаётся: в нём и живёт путь вызова.
function stripComments(source: string): string {
  return source.replace(STRING_OR_COMMENT, (_m, str?: string) => str ?? ' ');
}

/** Есть ли в тексте вызов `/api/auth/<id>` — id целиком, не префикс другого. */
export function callsAuthRoute(source: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`/api/auth/${escaped}(?=[/'"\`?])`).test(
    stripComments(source),
  );
}

/** Есть ли у id потребитель среди файлов: [путь, текст]. Тесты не считаются. */
export function hasConsumer(
  id: string,
  files: Array<[string, string]>,
): boolean {
  return files.some(
    ([path, text]) => !TEST_FILE.test(path) && callsAuthRoute(text, id),
  );
}

const providerFiles = readdirSync(PROVIDERS_DIR).filter((f) =>
  f.endsWith('.provider.ts'),
);
const providers = providerFiles.flatMap((file) =>
  providerIdsOf(readFileSync(join(PROVIDERS_DIR, file), 'utf8')).map((id) => ({
    id,
    file,
  })),
);
const registrySource = readFileSync(join(PROVIDERS_DIR, 'registry.ts'), 'utf8');
const frontFiles: Array<[string, string]> = FRONT_DIRS.flatMap((d) =>
  collectSourceFiles(join(ROOT, d), { extensions: ['.ts', '.tsx'] }).map(
    (p): [string, string] => [p, readFileSync(p, 'utf8')],
  ),
);

describe('провайдеры входа ⇄ registry.ts ⇄ фронт', () => {
  it('находит провайдеров (сверка не пустая)', () => {
    expect(providers.map((p) => p.id).sort()).toEqual([
      'google',
      'max',
      'telegram',
      'vk',
    ]);
  });

  it.each(providers)(
    '$id ($file) зарегистрирован в registry.ts',
    ({ file }) => {
      const base = file.replace(/\.ts$/, '');
      expect(registrySource).toContain(`from './${base}'`);
    },
  );

  it.each(providers)(
    '$id: у /api/auth/$id есть не-тестовый потребитель на фронте',
    ({ id }) => {
      if (ALLOW[id]) return;
      expect(hasConsumer(id, frontFiles)).toBe(true);
    },
  );

  it('у каждой записи ALLOW есть причина и живой провайдер', () => {
    for (const [id, reason] of Object.entries(ALLOW)) {
      expect(reason.length).toBeGreaterThan(20);
      expect(providers.map((p) => p.id)).toContain(id);
    }
  });
});

describe('сверка потребителей — контрольные образцы (правило №15)', () => {
  const route = 'fetch(`${API_BASE}/api/auth/telegram/widget`)';

  it('вызов в не-тестовом файле засчитывается', () => {
    expect(hasConsumer('telegram', [['webapp/src/A.tsx', route]])).toBe(true);
  });

  it('id, упомянутый только в тесте, не засчитывается', () => {
    const files: Array<[string, string]> = [
      ['webapp/src/A.test.tsx', route],
      ['shared/src/__tests__/b.ts', route],
    ];
    expect(hasConsumer('telegram', files)).toBe(false);
  });

  it('упоминание только в комментарии не засчитывается', () => {
    const text =
      "// ушли с /api/auth/telegram/redirect\n/**\n * ещё /api/auth/telegram'\n */";
    expect(callsAuthRoute(text, 'telegram')).toBe(false);
  });

  it('id только в JSX-комментарии не засчитывается', () => {
    const text = "<div>{/* fetch('/api/auth/x/start') */}</div>";
    expect(callsAuthRoute(text, 'x')).toBe(false);
  });

  it('id только в многострочном блочном комментарии не засчитывается', () => {
    const text = "const a = 1; /* раньше:\n  fetch('/api/auth/x/start')\n*/";
    expect(callsAuthRoute(text, 'x')).toBe(false);
  });

  it('id только в хвостовом // комментарии не засчитывается', () => {
    expect(callsAuthRoute("foo(); // '/api/auth/x/start'", 'x')).toBe(false);
    expect(callsAuthRoute('foo(); // see /api/auth/x/start', 'x')).toBe(false);
  });

  it('вызов в строке засчитывается, хвостовой комментарий его не съедает', () => {
    expect(
      callsAuthRoute('fetch(`${base}/api/auth/x/start`) // комментарий', 'x'),
    ).toBe(true);
    expect(callsAuthRoute("go('https://host/api/auth/x/start')", 'x')).toBe(
      true,
    );
    expect(
      callsAuthRoute(
        "go('https://host/api/auth/x/start'); // /api/auth/y/start",
        'x',
      ),
    ).toBe(true);
  });

  it('комментарий рядом с вызовом другого id не засчитывает свой', () => {
    const text = "go('https://host/api/auth/y/start'); // /api/auth/x/start";
    expect(callsAuthRoute(text, 'x')).toBe(false);
    expect(callsAuthRoute(text, 'y')).toBe(true);
  });

  it("'telegram' не засчитывается за 'telegram-oidc' и наоборот", () => {
    expect(
      callsAuthRoute("go('/api/auth/telegram/redirect')", 'telegram-oidc'),
    ).toBe(false);
    expect(callsAuthRoute("go('/api/auth/telegram-oidc')", 'telegram')).toBe(
      false,
    );
    expect(
      callsAuthRoute("go('/api/auth/telegram-oidc')", 'telegram-oidc'),
    ).toBe(true);
  });

  it('providerIdsOf достаёт id и не путает с типами', () => {
    expect(
      providerIdsOf("  readonly id = 'vk';\n  readonly id: string;"),
    ).toEqual(['vk']);
  });
});
