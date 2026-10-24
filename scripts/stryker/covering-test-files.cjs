'use strict';
// Прогон мутанта грузит только спеки с покрывающими тестами (ночные
// mutation-волны с 2026-09-21 ни разу не уложились в 60 минут).
//
// Как было. На каждый мутант jest-раннер Stryker запускает
// `jest --findRelatedTests <мутируемый файл> --testNamePattern <покрывающие
// тесты>`. Фильтр по имени срабатывает ПОСЛЕ загрузки: jest поднимает каждый
// спек, который транзитивно импортирует файл, исполняет его импорты и только
// потом пропускает тесты. `crypto.ts` импортируют 139 спеков — и все 139
// грузились на каждый из ~170 его мутантов (~11 с вхолостую на мутант).
// Волне А (вход/шифрование) нужно было 65 тыс. загрузок спеков, из них с
// покрывающими тестами — 2,9 тыс.
//
// Как стало. Покрывающие тесты Stryker знает после пробного прогона
// (coverageAnalysis: perTest). Репортёр ниже, когда готов план, пишет карту
// «мутант → спеки с покрывающими тестами»; этот же файл, подключённый к jest
// как `filter`, в воркере оставляет из связанных спеков только спеки из
// карты. Тест, который мутант не исполняет, убить его не может — исход тот
// же, меняется время. A/B на security-log/crypto/merge (где есть гибридные
// мутанты): статусы совпали помутантно.
//
// Отказ — в сторону медленности, не тишины: нет карты, мутанта нет в карте,
// пересечение пустое — jest получает список без изменений (как до фильтра).
// Сломанный фильтр проявится таймаутом ночной джобы, а не «все мутанты
// выжили» — так выглядел первый прототип, где пути песочницы не совпали с
// путями проекта.
//
// Подключение — covering-test-files.plugin.mjs (плагин Stryker объявляется
// через ESM-пакет, а jest грузит `filter` через require, отсюда два файла);
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
    // Без testFilter мутант гоняет все тесты или не гоняется вовсе —
    // фильтру тут делать нечего.
    if (!runOptions?.testFilter) continue;
    const files = new Set();
    for (const id of runOptions.testFilter) {
      for (const f of filesByTest.get(id) ?? []) files.add(f);
    }
    byMutant[mutant.id] = [...files].sort();
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
  defaultMapPath,
  buildCoveringFiles,
  pickTestPaths,
  describeMap,
  CoveringTestFilesReporter,
});
