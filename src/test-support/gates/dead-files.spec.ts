// Тест гейта check-dead-files.mjs (правило №11 CLAUDE.md). Инцидент, ради
// которого гейт написан: в репозитории лежали ДВЕ копии одного фильтра —
// живая и мёртвая, и на мёртвую написали спек, который был зелёным. Гейт
// требует у каждого прод-файла хотя бы одного НЕ-тестового потребителя.
//
// Важно про синтаксис фикстур: IMPORT_RE в скрипте ловит только
// `from '...'`, `require('...')` и динамический `import('...')` — статический
// side-effect `import './x';` (без `from`) он не видит. Фикстуры ниже
// намеренно пишут `import { x } from './y'`, а не голый `import './y'`.
import { runGate } from './gate-sandbox';

// entry.ts — во всех тестах баз-пиненный "искусственный main.ts": файл, у
// которого по смыслу нет потребителя (как реальные src/main.ts,
// webapp/src/main.tsx в бейслайне проекта), и его нужно явно пиннить в
// бейслайне, чтобы он не засорял тест как "неожиданный fresh-орфан".
const ENTRY_REASON =
  'входная точка — не импортируется по смыслу, только по факту работы';

function baseline(extra: Record<string, string> = {}) {
  return JSON.stringify({ 'src/entry.ts': ENTRY_REASON, ...extra });
}

const ENTRY_FILE =
  "import { helperValue } from './helper';\nexport const entry = helperValue;\n";
const HELPER_FILE = 'export const helperValue = 1;\n';

describe('check-dead-files.mjs', () => {
  it('файл без единого импорта, не в бейслайне — exit 1, путь в stderr', () => {
    const res = runGate('check-dead-files.mjs', {
      'scripts/dead-files-baseline.json': baseline(),
      'src/entry.ts': ENTRY_FILE,
      'src/helper.ts': HELPER_FILE,
      'src/orphan.ts': 'export const orphanValue = 2;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('файлы без единого потребителя');
    expect(res.stderr).toContain('src/orphan.ts');
  });

  it('файл, импортируемый ТОЛЬКО своим .spec.ts — exit 1 (спек не потребитель)', () => {
    const res = runGate('check-dead-files.mjs', {
      'scripts/dead-files-baseline.json': baseline(),
      'src/entry.ts': ENTRY_FILE,
      'src/helper.ts': HELPER_FILE,
      'src/dead.ts': 'export const deadValue = 3;\n',
      // Спек не входит в `production` (список файлов, которые сканируются на
      // импорты) — этот импорт гейт обязан игнорировать.
      'src/dead.spec.ts':
        "import { deadValue } from './dead';\nit('x', () => deadValue);\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/dead.ts');
  });

  it('запись бейслайна протухла (файла больше нет) — exit 1', () => {
    const res = runGate('check-dead-files.mjs', {
      // 'src/ghost.ts' в бейслайне, но не создан — ни фактического файла,
      // ни потребителя для него быть не может.
      'scripts/dead-files-baseline.json': baseline({
        'src/ghost.ts': 'старая заглушка, которую давно удалили из дерева',
      }),
      'src/entry.ts': ENTRY_FILE,
      'src/helper.ts': HELPER_FILE,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухли');
    expect(res.stderr).toContain('src/ghost.ts');
  });

  it('запись бейслайна протухла (у файла появился потребитель) — exit 1', () => {
    const res = runGate('check-dead-files.mjs', {
      // 'src/nowUsed.ts' раньше был осознанным исключением, но теперь его
      // кто-то подключил — запись в бейслайне больше не соответствует факту.
      'scripts/dead-files-baseline.json': baseline({
        'src/nowUsed.ts':
          'раньше был точкой входа без импортов, зафиксировано осознанно',
      }),
      'src/entry.ts':
        "import { helperValue } from './helper';\nimport { usedValue } from './nowUsed';\nexport const entry = helperValue + usedValue;\n",
      'src/helper.ts': HELPER_FILE,
      'src/nowUsed.ts': 'export const usedValue = 5;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухли');
    expect(res.stderr).toContain('src/nowUsed.ts');
  });

  it('причина в бейслайне короче 20 символов — exit 1', () => {
    const res = runGate('check-dead-files.mjs', {
      'scripts/dead-files-baseline.json': baseline({
        'src/shortreason.ts': 'коротко',
      }),
      'src/entry.ts': ENTRY_FILE,
      'src/helper.ts': HELPER_FILE,
      // Реально существующий, реально не потреблённый файл — единственная
      // проблема тут причина, а не сама запись бейслайна.
      'src/shortreason.ts': 'export const shortReasonValue = 6;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('исключение без внятной причины');
    expect(res.stderr).toContain('src/shortreason.ts');
  });

  it('всё подключено, бейслайн актуален — exit 0', () => {
    const res = runGate('check-dead-files.mjs', {
      'scripts/dead-files-baseline.json': baseline(),
      'src/entry.ts': ENTRY_FILE,
      'src/helper.ts': HELPER_FILE,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ гейт мёртвых файлов: 2 файлов, без потребителя — только 1 известных',
    );
  });

  it("import './dir' резолвится в './dir/index.ts' — index-файл не мёртвый", () => {
    const res = runGate('check-dead-files.mjs', {
      'scripts/dead-files-baseline.json': baseline(),
      'src/entry.ts':
        "import { subValue } from './sub';\nexport const entry = subValue;\n",
      'src/sub/index.ts': 'export const subValue = 7;\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ гейт мёртвых файлов: 2 файлов, без потребителя — только 1 известных',
    );
  });

  it('тест-инфраструктура (test-support/, .test-helpers., .fixture., *Mock.tsx) не требует потребителя', () => {
    const res = runGate('check-dead-files.mjs', {
      'scripts/dead-files-baseline.json': baseline(),
      'src/entry.ts': ENTRY_FILE,
      'src/helper.ts': HELPER_FILE,
      'src/test-support/orphanHelper.ts': 'export const a = 1;\n',
      'src/foo.test-helpers.ts': 'export const b = 2;\n',
      'webapp/src/bar.fixture.ts': 'export const c = 3;\n',
      'webapp/src/BazMock.tsx': 'export const Baz = () => null;\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт мёртвых файлов');
  });

  // IMPORT_RE ловит три формы; до этого теста фикстуры использовали только
  // `from '...'` — require()/динамический import() были не покрыты ни одним
  // тестом (замер 2026-08: сузить регэксп до одной формы ни один тест не ловил).
  it("require('./x') и import('./x') тоже считаются потреблением", () => {
    const res = runGate('check-dead-files.mjs', {
      'scripts/dead-files-baseline.json': baseline({
        'src/entry.ts': ENTRY_REASON,
      }),
      'src/entry.ts': [
        "const req = require('./reqHelper');",
        "const dyn = () => import('./dynHelper');",
        'export const entry = { req, dyn };',
        '',
      ].join('\n'),
      'src/reqHelper.ts': 'export const reqValue = 1;\n',
      'src/dynHelper.ts': 'export const dynValue = 2;\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ гейт мёртвых файлов: 3 файлов, без потребителя — только 1 известных',
    );
  });

  // TEST регексп ловит и .spec., и .test. — фикстуры выше проверяли только
  // .spec.ts (см. заголовок файла). Файл, потреблённый ТОЛЬКО своим .test.ts,
  // обязан остаться орфаном ровно как в .spec.ts-кейсе.
  it('файл, импортируемый ТОЛЬКО своим .test.ts — exit 1 (test не потребитель)', () => {
    const res = runGate('check-dead-files.mjs', {
      'scripts/dead-files-baseline.json': baseline(),
      'src/entry.ts': ENTRY_FILE,
      'src/helper.ts': HELPER_FILE,
      'src/dead.ts': 'export const deadValue = 3;\n',
      'src/dead.test.ts':
        "import { deadValue } from './dead';\nit('x', () => deadValue);\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/dead.ts');
  });

  // .d.ts исключены из сканирования — они описывают типы, а не рантайм-код,
  // и требовать у них "потребителя" бессмысленно. Ни один тест этого не
  // проверял: убрать исключение ни один тест не ловил.
  it('.d.ts файл без потребителя не считается мёртвым — исключён из сканирования', () => {
    const res = runGate('check-dead-files.mjs', {
      'scripts/dead-files-baseline.json': baseline(),
      'src/entry.ts': ENTRY_FILE,
      'src/helper.ts': HELPER_FILE,
      'src/globals.d.ts': 'declare const FOO: string;\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ гейт мёртвых файлов: 2 файлов, без потребителя — только 1 известных',
    );
  });
});
