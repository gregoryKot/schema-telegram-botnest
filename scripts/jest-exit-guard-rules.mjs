// Правила сторожа jest (scripts/jest-exit-guard.mjs): что в выводе jest значит
// «прогон закончен», «утечка» и «код выхода не от тестов». Движок их только
// импортирует (правило №10: движок не растёт вместе со списком правил).
//
// Формы строк сверены с записанным выводом jest 30 в обоих режимах nightly —
// test/fixtures/recorded/jest-run-output.json (правило №23): с --silent и
// воркерами строки «Ran all test suites» НЕТ, сводка «Test Suites: … total»
// есть в обоих. Все шаблоны привязаны к началу строки: текст упавшего
// утверждения jest печатает с отступом, и «Expected: "Ran all test suites."»
// внутри него не должен сойти за конец прогона.

const ANSI = /\x1b\[[0-9;]*m/g;

/** Вывод без цветовых кодов: под CI chalk может их включить. */
export const plain = (text) => text.replace(ANSI, '');

/** Сводка jest — последнее, что он печатает о тестах, в обоих режимах. */
const RUN_DONE = /^Test Suites: .*\btotal$/m;

/** Прогон закончился: jest напечатал сводку. */
export const runFinished = (text) => RUN_DONE.test(plain(text));

/** Признаки утечки, которые jest печатает сам, и что они значат. */
export const LEAK_SIGNS = [
  [
    /^A worker process has failed to exit gracefully/m,
    'воркер jest не вышел сам и был убит («failed to exit gracefully»): тест оставил живой хендл',
  ],
  [
    /^Jest has detected the following \d+ open handles?/m,
    'jest нашёл открытые хендлы — список выше, под «Jest has detected the following»',
  ],
  [
    /^Jest did not exit one second after the test run has completed/m,
    'после всех тестов процесс jest не вышел сам («Jest did not exit»): его держит живой хендл',
  ],
];

/** Строка «Tests: …» сводки, если ни сьют, ни тест в ней не упали. */
function cleanSummary(text) {
  const suites = /^Test Suites: (.*)$/m.exec(text)?.[1];
  const tests = /^Tests: +(.*)$/m.exec(text)?.[1];
  if (!suites || !tests || /failed/.test(suites + tests)) return null;
  return tests.trim();
}

export const HINT =
  'Найти виновника: npx jest <каталог> --detectOpenHandles по каталогам, ' +
  'затем по одному спеку без --forceExit; сокеты и поллинг jest в список не включает.';

/**
 * Вердикты по итогам прогона. `killedFor` — 'held' (не вышел после сводки) или
 * 'budget' (сводки не дождались); `pipesHeld` — команда вышла, а её вывод
 * держит кто-то ещё.
 */
export function verdicts({
  output,
  code,
  killedFor,
  pipesHeld,
  grace,
  budget,
}) {
  const text = plain(output);
  const found = [];
  if (killedFor === 'held') {
    found.push(
      `тесты закончились, а процесс jest не вышел за ${grace} с — его держит живой хендл (таймер, сервер, сокет, поллинг, дочерний процесс); процесс убит`,
    );
  }
  if (killedFor === 'budget') {
    found.push(
      `тесты не закончились за ${budget} с — завис тест (или прогон стал в разы медленнее обычного); процесс убит`,
    );
  }
  if (pipesHeld) {
    found.push(
      'jest вышел, но процесс, запущенный тестами, пережил его и держит вывод открытым — тест не убил своего потомка',
    );
  }
  for (const [re, meaning] of LEAK_SIGNS)
    if (re.test(text)) found.push(meaning);
  const tests = cleanSummary(text);
  if (!killedFor && code !== 0 && code !== null && tests) {
    found.push(
      `jest вышел с кодом ${code}, хотя ни один тест не упал («Tests: ${tests}»): код выставил не jest — обычно тест или код под ним записал process.exitCode (так делает Telegraf без bot.catch)`,
    );
  }
  return found;
}
