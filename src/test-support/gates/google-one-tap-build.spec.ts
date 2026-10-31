// Google One Tap на сайте включается сборкой (аудит 2026-10, п.16).
// Хук useGoogleOneTap читает VITE_GOOGLE_CLIENT_ID, а Dockerfile его не задавал:
// окно «Продолжить как…» молча не показывалось никому. При этом скрипт Google
// грузился статическим тегом в index.html на каждой странице сайта и визитки,
// хотя политика конфиденциальности описывает обращение к Google только на
// странице входа. Теперь id задаёт Dockerfile, а скрипт грузит сам хук.
// Гейт держит три места согласованными: имя переменной в хуке и Dockerfile,
// формат id, отсутствие статического тега Google в index.html.
import { readFileSync } from 'fs';
import { join } from 'path';
import { frontendSources } from '../frontend-sources';

const ROOT = join(__dirname, '..', '..', '..');
const readReal = (file: string) => readFileSync(join(ROOT, file), 'utf8');

const BUILD_LINE = 'RUN npm run build --prefix webapp';
const CLIENT_ID_FORMAT = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

/** `ARG VITE_GOOGLE_CLIENT_ID=<id>` — id или null, если строки нет. */
function dockerArgClientId(dockerfile: string): string | null {
  return /^ARG VITE_GOOGLE_CLIENT_ID=(\S+)/m.exec(dockerfile)?.[1] ?? null;
}

const lineIndex = (text: string, re: RegExp): number => text.search(re);

/** Статический тег скрипта Google (GIS) в HTML. */
function hasGoogleScriptTag(html: string): boolean {
  return /<script\b[^>]*accounts\.google\.com/i.test(html);
}

describe('Dockerfile: client id Google One Tap задан при сборке сайта', () => {
  const dockerfile = readReal('Dockerfile');

  it('ARG VITE_GOOGLE_CLIENT_ID с id в формате OAuth-клиента Google', () => {
    const id = dockerArgClientId(dockerfile);
    expect(id).not.toBeNull();
    expect(id).toMatch(CLIENT_ID_FORMAT);
  });

  it('ENV VITE_GOOGLE_CLIENT_ID берёт значение из ARG', () => {
    expect(dockerfile).toMatch(
      /^ENV VITE_GOOGLE_CLIENT_ID=\$VITE_GOOGLE_CLIENT_ID$/m,
    );
  });

  it('обе строки стоят раньше сборки сайта (иначе в бандл не попадут)', () => {
    const build = dockerfile.indexOf(BUILD_LINE);
    expect(build).toBeGreaterThan(-1);
    const arg = lineIndex(dockerfile, /^ARG VITE_GOOGLE_CLIENT_ID=/m);
    const env = lineIndex(dockerfile, /^ENV VITE_GOOGLE_CLIENT_ID=/m);
    expect(arg).toBeGreaterThan(-1);
    expect(env).toBeGreaterThan(-1);
    expect(arg).toBeLessThan(build);
    expect(env).toBeLessThan(build);
  });

  it('контрольный: без строки ARG извлекатель говорит «не найдено»', () => {
    const withoutArg = dockerfile.replace(
      /^ARG VITE_GOOGLE_CLIENT_ID=.*$/m,
      '',
    );
    expect(dockerArgClientId(withoutArg)).toBeNull();
  });

  it('контрольный: формат id отвергает чужие значения', () => {
    expect('283410385894-abc123.apps.googleusercontent.com').toMatch(
      CLIENT_ID_FORMAT,
    );
    expect('not-a-client-id').not.toMatch(CLIENT_ID_FORMAT);
    expect('123-abc.apps.googleusercontent.com.evil').not.toMatch(
      CLIENT_ID_FORMAT,
    );
  });
});

describe('хук читает ту же переменную, что задаёт Dockerfile', () => {
  it('useGoogleOneTap.ts: import.meta.env.VITE_GOOGLE_CLIENT_ID', () => {
    expect(readReal('webapp/src/hooks/useGoogleOneTap.ts')).toContain(
      'import.meta.env.VITE_GOOGLE_CLIENT_ID',
    );
  });
});

describe('index.html: скрипт Google не грузится на каждой странице', () => {
  it('нет <script> с accounts.google.com (его грузит хук на странице входа)', () => {
    expect(hasGoogleScriptTag(readReal('webapp/index.html'))).toBe(false);
  });

  it('контрольный: проверка ловит старый статический тег', () => {
    const old =
      '<head><script src="https://accounts.google.com/gsi/client" async></script></head>';
    expect(hasGoogleScriptTag(old)).toBe(true);
  });
});

// Политика обещает Google «на странице входа» (webapp/src/pages/privacy/processors.ts):
// шов «текст политики ↔ код» — где грузится скрипт Google и кто зовёт окно.
describe('скрипт Google — только на странице входа', () => {
  const sources = frontendSources().filter(
    (f) => !/\.test\.tsx?$/.test(f.path),
  );

  it('адрес скрипта GIS знает только загрузчик gsiScript.ts (и ни одна HTML-страница)', () => {
    const users = sources
      .filter((f) => f.text.includes('accounts.google.com/gsi/client'))
      .map((f) => f.path);
    expect(users).toEqual(['webapp/src/hooks/gsiScript.ts']);
  });

  it('окно One Tap зовёт только экран входа', () => {
    const callers = sources
      .filter((f) => f.path !== 'webapp/src/hooks/useGoogleOneTap.ts')
      .filter((f) => /\buseGoogleOneTap\(/.test(f.text))
      .map((f) => f.path);
    expect(callers).toEqual([
      'webapp/src/pages/login/LoginProviderButtons.tsx',
    ]);
  });
});
