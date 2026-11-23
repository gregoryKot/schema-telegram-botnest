// Тест гейта check-spec-load-in-test.mjs: спек над мутационной зоной Stryker не
// грузит модули внутри `it` — код уровня модуля иначе засчитывается тесту.
// Оба исхода и контрольные образцы: хук, уровень файла, спек вне зоны.
import { spawnSync } from 'child_process';
import { join } from 'path';
import { runGate } from './gate-sandbox';
import { importExport } from './pattern-loader';

const ROOT = join(__dirname, '..', '..', '..');
const GATE = 'check-spec-load-in-test.mjs';
const SPEC = 'src/a/x.spec.ts';
const ZONE = {
  'stryker.a.config.json': JSON.stringify({ mutate: ['src/a/core.ts'] }),
  'src/a/core.ts': 'export const k = process.env.K;\n',
  'src/a/x.ts': "import { k } from './core';\nexport const x = k;\n",
};
const run = (spec: string, extra: Record<string, string> = {}) =>
  runGate(GATE, { ...ZONE, [SPEC]: spec, ...extra });
const LOAD =
  "const load = (key: string) => loadWithKeys({ key }, () => require('./x'));\n";

describe('check-spec-load-in-test.mjs', () => {
  it('настоящее дерево и бейслайн — зелёный', () => {
    const res = spawnSync('node', [`scripts/${GATE}`], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it.each([
    ['require в it', "it('t', () => { const m = require('./x'); });\n"],
    [
      'loadWithKeys в test',
      "test('t', () => { loadWithKeys({ key }, () => require('./x')); });\n",
    ],
    [
      'jest.isolateModules в it.each',
      "it.each([1])('t %s', () => { jest.isolateModules(() => { require('./x'); }); });\n",
    ],
    ['вызов загрузчика', `${LOAD}it('t', () => { load('a').x; });\n`],
    [
      'загрузчик через посредника',
      `${LOAD}const make = () => new (load('a').X)();\nit('t', () => { make(); });\n`,
    ],
    ['import() в it', "it('t', async () => { await import('./x'); });\n"],
  ])('красный: %s', (_name, spec) => {
    const res = run(spec);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${SPEC}: загрузок в тестах`);
    expect(res.stderr).toContain('зона: src/a/core.ts');
  });

  it.each([
    [
      'уровень файла',
      `${LOAD}const m = load('a');\nit('t', () => { m.x; });\n`,
    ],
    [
      'beforeAll',
      `${LOAD}let m;\nbeforeAll(() => { m = load('a'); });\nit('t', () => { m.x; });\n`,
    ],
    [
      'тело describe',
      `${LOAD}describe('d', () => {\n  const m = load('a');\n  it('t', () => { m.x; });\n});\n`,
    ],
    [
      'пакет из node_modules и комментарий',
      "it('t', () => { const n = require('@nestjs/common'); // require('./x')\n});\n",
    ],
    [
      'одноимённый метод объекта — не загрузчик',
      `${LOAD}const m = load('a');\nit('t', () => { repo.load('a'); });\n`,
    ],
  ])('контроль, зелёный: %s', (_name, spec) => {
    const res = run(spec);
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  // Исключение №15: предмет теста — сама загрузка. Образец, который оно гасит,
  // и контрольные: без причины и с обёрткой не в тесте — по-прежнему красные.
  it('loadAsSubject с причиной в тесте — зелёный', () => {
    const res = run(
      `${LOAD}it('t', () => {\n  loadAsSubject(\n    'разбор env при загрузке',\n    () => load('a'),\n  );\n  loadAsSubject('бросок', () => require('./x'));\n});\n`,
    );
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it.each([
    ['пустая причина', "loadAsSubject('', () => load('a'))"],
    ['причина из пробелов', "loadAsSubject('  ', () => load('a'))"],
    ['причина не литералом', "loadAsSubject(WHY, () => load('a'))"],
    [
      'загрузка рядом с обёрткой',
      "loadAsSubject('причина', () => 1); load('a')",
    ],
  ])('контроль, красный: loadAsSubject — %s', (_name, body) => {
    const res = run(`${LOAD}it('t', () => { ${body}; });\n`);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${SPEC}: загрузок в тестах 1`);
  });

  it('контроль, красный: обёртка внутри загрузчика не снимает его вызов из теста', () => {
    const res = run(
      `const sub = () => loadAsSubject('причина', () => require('./x'));\nit('t', () => { sub(); });\n`,
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('вызов загрузчика sub()');
  });

  it('спек вне графа зоны не проверяется', () => {
    const res = runGate(GATE, {
      ...ZONE,
      'src/b/y.ts': 'export const y = 1;\n',
      'src/b/y.spec.ts': "it('t', () => { require('./y'); });\n",
    });
    expect(res.status).toBe(0);
  });

  it('бейслайн: долг не растёт, нового спека в нём нет, --update пишет только уменьшение', () => {
    const two =
      "it('a', () => { require('./x'); });\nit('b', () => { require('./x'); });\n";
    const base = (n: number) => ({
      'scripts/spec-load-in-test-baseline.json': JSON.stringify({ [SPEC]: n }),
    });
    expect(run(two, base(2)).status).toBe(0);
    const grew = run(two, base(1));
    expect(grew.status).toBe(1);
    expect(grew.stderr).toContain('загрузок в тестах 2, в бейслайне 1');
    const shrunk = run(two, base(5));
    expect(shrunk.status).toBe(0);
    expect(shrunk.stdout).toContain('Усохло 1');
    const other = runGate(GATE, {
      ...ZONE,
      ...base(2),
      'src/a/z.spec.ts': "it('t', () => { require('./x'); });\n",
    });
    expect(other.stderr).toContain(
      'src/a/z.spec.ts: загрузок в тестах 1, в бейслайне 0',
    );
  });

  it('spec-load-in-test-rules: у it.each диапазон теста — вторая пара скобок', () => {
    const src = "it.each([load])('t', () => { run(); });";
    const got: unknown = JSON.parse(
      importExport(
        'spec-load-in-test-rules.mjs',
        'testRanges',
        `(r) => r(${JSON.stringify(src)})`,
      ),
    );
    expect(got).toEqual([[src.indexOf("('t'"), src.length - 2]]);
  });
});
