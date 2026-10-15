// Тест гейта check-e2e-in-ci.mjs — «каждый e2e-спек гоняется в CI».
//
// Аудит 2026-10-11: test/exercise-delete-ownership и test/max-auth лежали в
// test/ без единого прогона. Шов здесь — ci.yml ↔ test/, поэтому песочница
// получает ci.yml реальной формы: свёрнутый `>-`, однострочный run,
// комментарии `#`, префиксы вместо полных путей, шаг без jest-e2e.
//
// Оба исхода плюс контрольные образцы (правило №15): комментарий, чужой шаг и
// несовпавший префикс обязаны оставаться красными. Бейслайна у гейта нет
// намеренно, поэтому check-gate-exemptions пинить нечего.
import { runGate } from './gate-sandbox';

const SPEC = (name: string) => `test/${name}.e2e-spec.ts`;
const specs = (...names: string[]) =>
  Object.fromEntries(names.map((n) => [SPEC(n), '// spec\n']));

const CI = (body: string) =>
  ['name: CI', 'jobs:', '  backend:', '    steps:', body, ''].join('\n');

const FOLDED = [
  '      - run: >-',
  '          npx jest --config ./test/jest-e2e.json --cacheDirectory="$JEST_CACHE_DIR"',
  '          test/alpha test/beta-ownership',
  '        env:',
  "          E2E_REAL_DB: '1'",
].join('\n');

const gate = (ci: string, files: Record<string, string>) =>
  runGate('check-e2e-in-ci.mjs', { '.github/workflows/ci.yml': ci, ...files });

describe('check-e2e-in-ci.mjs', () => {
  it('чистое дерево: префикс и полный путь в свёрнутом run покрывают все спеки', () => {
    const res = gate(
      CI(
        FOLDED +
          '\n      - run: npx jest --config ./test/jest-e2e.json --runInBand test/gamma.e2e-spec.ts',
      ),
      specs('alpha', 'beta-ownership', 'beta-ownership-2', 'gamma'),
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('4 спеков');
  });

  it('спек-сирота краснеет и называется по имени', () => {
    const res = gate(CI(FOLDED), specs('alpha', 'beta-ownership', 'orphan'));
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('test/orphan.e2e-spec.ts');
    expect(res.stderr).not.toContain('test/alpha.e2e-spec.ts');
  });

  it('контроль: упоминание только в YAML-комментарии не засчитывается', () => {
    const res = gate(
      CI(
        '      # пояснение: test/orphan.e2e-spec.ts гоняется отдельно\n' +
          FOLDED,
      ),
      specs('alpha', 'beta-ownership', 'orphan'),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('test/orphan.e2e-spec.ts');
  });

  it('контроль: путь в шаге без jest-e2e не засчитывается и не считается мёртвым', () => {
    const res = gate(
      CI(
        FOLDED +
          '\n      - run: npx tsx test/perf/seed.ts && echo test/orphan.e2e-spec.ts',
      ),
      specs('alpha', 'beta-ownership', 'orphan'),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('test/orphan.e2e-spec.ts');
    expect(res.stderr).not.toContain('test/perf/seed.ts');
  });

  it('контроль: путь после && в том же шаге уже не аргумент jest', () => {
    const res = gate(
      CI(
        '      - run: npx jest --config ./test/jest-e2e.json test/alpha && node x.mjs test/orphan.e2e-spec.ts',
      ),
      specs('alpha', 'orphan'),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('test/orphan.e2e-spec.ts');
  });

  it('контроль: префикс не засчитывается спеку, на который не матчится', () => {
    const res = gate(
      CI(FOLDED),
      specs('alpha', 'beta-ownership', 'beta-other'),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('test/beta-other.e2e-spec.ts');
  });

  it('токен в CI без файла краснеет: переименованный спек не прячется', () => {
    const res = gate(CI(FOLDED), specs('alpha'));
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('test/beta-ownership');
    expect(res.stderr).toContain('не соответствует ни один e2e-спек');
  });

  it('спек в nightly.yml тоже считается прогоном', () => {
    const res = runGate('check-e2e-in-ci.mjs', {
      '.github/workflows/ci.yml': CI(FOLDED),
      '.github/workflows/nightly.yml': CI(
        '      - run: npx jest --config ./test/jest-e2e.json test/night',
      ),
      ...specs('alpha', 'beta-ownership', 'night'),
    });
    expect(res.status).toBe(0);
  });

  it('вложенный каталог test/ обходится: спек в подпапке без прогона краснеет', () => {
    const res = gate(CI(FOLDED), {
      ...specs('alpha', 'beta-ownership'),
      'test/sub/deep.e2e-spec.ts': '// spec\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('test/sub/deep.e2e-spec.ts');
  });
});
