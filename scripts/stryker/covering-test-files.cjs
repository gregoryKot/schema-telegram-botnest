'use strict';
// Прогон мутанта грузит только спеки с покрывающими тестами: фильтр jest по
// имени теста срабатывает после загрузки, и на каждый мутант `crypto.ts`
// грузились все 139 импортирующих его спеков (docs/INCIDENTS.md, 2026-09-21).
// Репортёр ниже по итогам пробного прогона (coverageAnalysis: perTest) пишет
// карту «мутант → спеки с покрывающими тестами»; этот же файл как jest
// `filter` оставляет воркеру только их. Тест, который мутант не исполняет,
// убить его не может — исход тот же, меняется время.
//
// Крипто-ядро судят только свои спеки (OWN_SPECS): шифрованное поле пишут
// десятки спеков, и каждый новый удорожал волну А. Тут исход меняется
// осознанно — мутант, которого убивал лишь «чужой» спек, выживает.
//
// Отказ — в сторону медленности: нет карты, мутанта в ней или пересечения —
// jest получает список как есть; сломанный фильтр проявится таймаутом, а не
// «все мутанты выжили». Плагин Stryker (ESM) — covering-test-files.plugin.mjs;
// какие конфиги обязаны его подключать — stryker-covering-test-files.spec.ts.
const fs = require('fs');
const os = require('os');
const path = require('path');

/** Путь к карте. Плагин задаёт его в главном процессе Stryker до старта
 * воркеров — воркеры получают окружение родителя при fork. */
const MAP_ENV = 'STRYKER_COVERING_TEST_FILES';
/** Так jest-раннер Stryker сообщает воркеру активного мутанта
 * (INSTRUMENTER_CONSTANTS.ACTIVE_MUTANT_ENV_VARIABLE в @stryker-mutator/api). */
const ACTIVE_MUTANT_ENV = '__STRYKER_ACTIVE_MUTANT__';

const defaultMapPath = (pid = process.pid) =>
  path.join(os.tmpdir(), `stryker-covering-test-files-${pid}.json`);

// Главный процесс видит спеки по путям проекта, воркер — по путям песочницы,
// её копии. Общее у них — путь от корня (cwd), от него и сравниваем.
const fromRoot = (root, file) => path.relative(root, path.resolve(root, file));

const CRYPTO_CORE_SPECS = [
  'src/auth/totp.service.spec.ts',
  'src/utils/auth-provider-crypto.spec.ts',
  'src/utils/crypto-record.spec.ts',
  'src/utils/crypto-record.writable.spec.ts',
  'src/utils/crypto.spec.ts',
];
/** Мутируемый файл → единственные спеки, которым позволено его судить. */
const OWN_SPECS = {
  'src/utils/crypto.ts': CRYPTO_CORE_SPECS,
  'src/utils/crypto-record.ts': CRYPTO_CORE_SPECS,
};

/** Покрывающие спеки ∩ свои; пустое пересечение — все покрывающие. */
function ownSpecsOnly(mutantFile, files, root) {
  const own = mutantFile && OWN_SPECS[fromRoot(root, mutantFile)];
  const picked = own ? files.filter((f) => own.includes(f)) : [];
  return picked.length > 0 ? picked : files;
}

/**
 * Карта «id мутанта → спеки с покрывающими тестами». Id теста у jest-раннера —
 * полное имя, и одно имя бывает в двух спеках: берём все.
 */
function buildCoveringFiles(tests, mutantPlans, root = process.cwd()) {
  const filesByTest = new Map();
  for (const { id, fileName } of tests) {
    if (!fileName) continue;
    const files = filesByTest.get(id) ?? new Set();
    files.add(fromRoot(root, fileName));
    filesByTest.set(id, files);
  }
  const byMutant = {};
  for (const { mutant, runOptions } of mutantPlans) {
    // Без testFilter (статический мутант) гоняются все тесты или ни одного —
    // фильтру, и OWN_SPECS тоже, тут делать нечего.
    if (!runOptions?.testFilter) continue;
    const files = new Set();
    for (const id of runOptions.testFilter) {
      for (const f of filesByTest.get(id) ?? []) files.add(f);
    }
    const covering = [...files].sort();
    byMutant[mutant.id] = ownSpecsOnly(mutant.fileName, covering, root);
  }
  return byMutant;
}

/** Из связанных спеков — только покрывающие; пустое пересечение — как было. */
function pickTestPaths(testPaths, coveringFiles, root = process.cwd()) {
  if (!coveringFiles) return testPaths;
  const keep = new Set(coveringFiles);
  const picked = testPaths.filter((p) => keep.has(fromRoot(root, p)));
  return picked.length > 0 ? picked : testPaths;
}

function readMap() {
  const file = process.env[MAP_ENV];
  if (!file || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Jest `filter`: зовётся на каждый запуск jest в воркере Stryker. */
async function coveringTestFilesFilter(testPaths) {
  const mutantId = process.env[ACTIVE_MUTANT_ENV];
  // Пробный прогон (мутант не активен) обязан пройти все связанные тесты:
  // из него Stryker и узнаёт покрытие.
  if (mutantId === undefined) return { filtered: testPaths };
  return { filtered: pickTestPaths(testPaths, readMap()?.[mutantId]) };
}

function describeMap(map) {
  const lists = Object.values(map);
  const files = lists.reduce((sum, l) => sum + l.length, 0);
  const avg = lists.length ? (files / lists.length).toFixed(1) : '0';
  return `covering-test-files: карта на ${lists.length} мутантов, в среднем ${avg} спек-файла на мутант`;
}

/** Репортёр Stryker: запоминает тесты пробного прогона и пишет карту, когда
 * готов план, — до первого прогона мутанта. */
class CoveringTestFilesReporter {
  static inject = [];
  tests = [];

  onDryRunCompleted({ result }) {
    this.tests = result.tests;
  }

  onMutationTestingPlanReady({ mutantPlans }) {
    const map = buildCoveringFiles(this.tests, mutantPlans);
    fs.writeFileSync(process.env[MAP_ENV], JSON.stringify(map));
    console.log(describeMap(map));
  }

  wrapUp() {
    fs.rmSync(process.env[MAP_ENV], { force: true });
  }
}

module.exports = coveringTestFilesFilter;
Object.assign(module.exports, {
  MAP_ENV,
  ACTIVE_MUTANT_ENV,
  OWN_SPECS,
  defaultMapPath,
  buildCoveringFiles,
  pickTestPaths,
  describeMap,
  CoveringTestFilesReporter,
});
