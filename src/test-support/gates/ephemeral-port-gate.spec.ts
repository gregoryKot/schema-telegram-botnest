// Тест гейта check-ephemeral-port.mjs: «занял эфемерный порт, отпустил,
// биндит позже» (#547, TEST_IMPROVEMENT_PLAN п. 3.4). Оба исхода: красный на
// своих `freePort()` (обе формы, что жили в репозитории) и зелёный на
// законных серверах на порту 0 — поднят в одной функции, закрыт в другой.
// Последний случай — настоящее дерево репозитория.
import { spawnSync } from 'child_process';
import { join } from 'path';
import { REAL_SCRIPTS_DIR, runGate } from './gate-sandbox';
import { callExport, loadStringList } from './pattern-loader';

const GATE = 'check-ephemeral-port.mjs';
const run = (files: Record<string, string>) => runGate(GATE, files);
const lines = (...l: string[]) => l.join('\n') + '\n';

// Форма из docker-healthcheck.spec.ts: close в колбэке самого listen.
const CALLBACK_RELEASE = lines(
  "import { createServer } from 'net';",
  'function freePort(): Promise<number> {',
  '  return new Promise((resolve, reject) => {',
  '    const srv = createServer();',
  "    srv.on('error', reject);",
  "    srv.listen(0, '127.0.0.1', () => {",
  '      const { port } = srv.address() as { port: number };',
  '      srv.close(() => resolve(port));',
  '    });',
  '  });',
  '}',
);

// Копия reservePort: await listen, затем await close той же функцией.
const AWAIT_RELEASE = lines(
  'export async function port(): Promise<number> {',
  '  const s = createServer();',
  "  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));",
  '  const { port } = s.address() as AddressInfo;',
  '  await new Promise<void>((r) => s.close(() => r()));',
  '  return port;',
  '}',
);

describe('check-ephemeral-port.mjs: красный', () => {
  it('close в колбэке listen(0) — exit 1, файл:строка', () => {
    const res = run({ 'src/infra/x.spec.ts': CALLBACK_RELEASE });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/infra/x.spec.ts:6');
    expect(res.stderr).toContain('reservePort() + listenWithRetry()');
  });

  it('await listen(0) и await close в одной функции (копия reservePort) — exit 1', () => {
    const res = run({ 'test/y.e2e-spec.ts': AWAIT_RELEASE });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('test/y.e2e-spec.ts:3');
  });

  it('listen({ port: 0 }) — та же форма', () => {
    const src = AWAIT_RELEASE.replace("0, '127.0.0.1', r", '{ port: 0 }, r');
    expect(run({ 'e2e-browser/z.ts': src }).status).toBe(1);
  });
});

describe('check-ephemeral-port.mjs: зелёный', () => {
  it('beforeAll поднимает, afterAll закрывает (обе формы стрелок)', () => {
    const res = run({
      'src/a.spec.ts': lines(
        'beforeAll(async () => {',
        "  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));",
        '});',
        'afterAll(() => new Promise<void>((r) => server.close(() => r())));',
        "describe('b', () => {",
        '  beforeAll(() => new Promise<void>((r) => other.listen(0, r)));',
        '  afterAll(() => new Promise<void>((r) => other.close(() => r())));',
        '});',
      ),
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('класс: start() слушает 0, stop() закрывает; фабрика отдаёт close наружу', () => {
    const res = run({
      'src/test-support/fake.ts': lines(
        'class Fake {',
        '  async start(): Promise<this> {',
        "    await new Promise<void>((r) => this.server.listen(0, '127.0.0.1', r));",
        '    return this;',
        '  }',
        '  stop(): Promise<void> {',
        '    return new Promise((r) => this.server.close(() => r()));',
        '  }',
        '}',
        'export async function startFake() {',
        '  await new Promise<void>((r) => server.listen(0, r));',
        '  return { close: () => new Promise((r) => server.close(r)) };',
        '}',
      ),
    });
    expect(res.status).toBe(0);
  });

  it('listen(0) и close в строке или комментарии — не код', () => {
    const res = run({
      'src/c.spec.ts': lines(
        '// srv.listen(0, h, () => srv.close())',
        "const cmd = 'srv.listen(0); srv.close()';",
      ),
    });
    expect(res.status).toBe(0);
  });

  it('ALLOWED — только ephemeral-port.ts, и там та же форма законна', () => {
    const allowed = loadStringList('check-ephemeral-port.mjs', 'ALLOWED');
    expect(allowed).toEqual(['src/test-support/ephemeral-port.ts']);
    expect(run({ [allowed[0]]: AWAIT_RELEASE }).status).toBe(0);
    // контроль: соседний файл с тем же текстом — красный
    expect(run({ 'src/test-support/other.ts': AWAIT_RELEASE }).status).toBe(1);
  });

  it('настоящее дерево репозитория — exit 0', () => {
    const res = spawnSync('node', [join(REAL_SCRIPTS_DIR, GATE)], {
      encoding: 'utf8',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });
});

// Разбор отдельно от обхода дерева: ближайшая функция listen и close.
describe('ephemeral-port-scan.mjs: findReleasedPorts', () => {
  const scan = (src: string) =>
    callExport('ephemeral-port-scan.mjs', 'findReleasedPorts', src) as unknown;

  it('номера строк — каждого listen(0) с close в той же функции', () => {
    expect(scan(CALLBACK_RELEASE)).toEqual([6]);
    expect(scan(AWAIT_RELEASE + CALLBACK_RELEASE)).toEqual([3, 13]);
  });

  it('контроль: close в другой функции, в строке и в комментарии — не в счёт', () => {
    expect(
      scan(
        lines(
          'function up() { s.listen(0); }',
          'function down() { s.close(); }',
          "const t = 's.listen(0); s.close()'; // s.listen(0); s.close()",
        ),
      ),
    ).toEqual([]);
  });

  it('if/for/catch — не функции: close в блоке той же функции считается', () => {
    expect(
      scan(
        lines(
          'async function f() {',
          '  s.listen(0);',
          '  if (x) { s.close(); }',
          '}',
        ),
      ),
    ).toEqual([2]);
  });
});
