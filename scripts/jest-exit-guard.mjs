#!/usr/bin/env node
// Сторож прогона jest в nightly (джоба backend-flaky): тест, оставивший живой
// хендл, не вешает шаг до отмены джобы, а роняет его с причиной в логе.
//
// Инцидент 2026-10-15 (ci-alarm #672): шаг `npx jest --detectOpenHandles
// --forceExit=false 2>&1 | tail -50` прогнал все спеки и висел 27 минут, пока
// джобу не сняли по таймауту. Процесс держал поллинг Telegraf, поднятый уже
// после stop() (telegram.polling.seam.spec.ts): он ретраил закрытый порт раз
// в 5 с. Списка хендлов jest не напечатал бы и без `tail` — сокеты в него не
// попадают, — а `tail` спрятал вообще всё: до выхода процесса он молчит.
// Шаги run1..3 видели ту же утечку строкой «A worker process has failed to
// exit gracefully» и оставались зелёными.
//
// Что делает: запускает команду, её вывод идёт в лог шага сразу, и
//   * после итоговой строки jest («Ran all test suites») ждёт выхода не
//     дольше --exit-grace секунд, потом убивает группу процессов и падает:
//     тесты закончились, а процесс держит незакрытый хендл;
//   * за общий бюджет --budget секунд тесты не закончились — падает: завис
//     тест (или прогон стал в разы медленнее обычного);
//   * признак утечки в выводе (см. LEAK_SIGNS) роняет шаг и при нулевом коде;
//   * иначе выходит с кодом команды.
//
//   node scripts/jest-exit-guard.mjs [--budget 600] [--exit-grace 60] -- npx jest …
import { spawn } from 'child_process';

const RUN_DONE = /Ran all test suites/;

/** Признаки утечки, которые jest печатает сам, и что они значат. */
const LEAK_SIGNS = [
  [
    /A worker process has failed to exit gracefully/,
    'воркер jest не вышел сам и был убит («failed to exit gracefully»): тест оставил живой хендл',
  ],
  [
    /Jest has detected the following \d+ open handles?/,
    'jest нашёл открытые хендлы — список выше, под «Jest has detected the following»',
  ],
  [
    /Jest did not exit one second after the test run has completed/,
    'после всех тестов процесс jest не вышел сам («Jest did not exit»): его держит живой хендл',
  ],
];

const HINT =
  'Найти виновника: npx jest <каталог> --detectOpenHandles по каталогам, ' +
  'затем по одному спеку без --forceExit; сокеты и поллинг jest в список не включает.';

function usage(msg) {
  console.error(`jest-exit-guard: ${msg}`);
  console.error(
    'использование: node scripts/jest-exit-guard.mjs [--budget сек] [--exit-grace сек] -- команда …',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { budget: 600, grace: 60 };
  const sep = argv.indexOf('--');
  if (sep < 0 || sep === argv.length - 1) usage('нет команды после --');
  const flags = argv.slice(0, sep);
  for (let i = 0; i < flags.length; i += 2) {
    const key = { '--budget': 'budget', '--exit-grace': 'grace' }[flags[i]];
    const value = Number(flags[i + 1]);
    if (!key) usage(`неизвестный флаг ${flags[i]}`);
    if (!(value > 0)) usage(`${flags[i]} ждёт число секунд больше нуля`);
    opts[key] = value;
  }
  return { ...opts, command: argv.slice(sep + 1) };
}

function main() {
  const { budget, grace, command } = parseArgs(process.argv.slice(2));
  const started = Date.now();
  // detached: команда — лидер своей группы, убиваем её целиком (npx → jest →
  // воркеры), иначе внук с нашими пайпами пережил бы убийство.
  const child = spawn(command[0], command.slice(1), {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let out = '';
  let killedFor = null;
  let graceTimer;
  let exited = false;
  let finished = false;

  const kill = (reason) => {
    if (exited) return;
    killedFor ??= reason;
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // группа уже вышла — убивать некого
    }
  };
  const budgetTimer = setTimeout(
    () => kill(RUN_DONE.test(out) ? 'held' : 'budget'),
    budget * 1000,
  );
  const relay = (sink) => (chunk) => {
    sink.write(chunk);
    const before = out.length;
    out += chunk.toString();
    // Хвост прошлого куска — строка могла разрезаться на границе.
    if (!graceTimer && RUN_DONE.test(out.slice(Math.max(0, before - 64)))) {
      graceTimer = setTimeout(() => kill('held'), grace * 1000);
    }
  };
  child.stdout.on('data', relay(process.stdout));
  child.stderr.on('data', relay(process.stderr));

  const finish = (code, signal, pipesHeld) => {
    if (finished) return;
    finished = true;
    clearTimeout(budgetTimer);
    clearTimeout(graceTimer);
    const verdicts = [];
    if (killedFor === 'held') {
      verdicts.push(
        `тесты закончились, а процесс jest не вышел за ${grace} с — его держит живой хендл (таймер, сервер, сокет, поллинг, дочерний процесс); процесс убит`,
      );
    }
    if (killedFor === 'budget') {
      verdicts.push(
        `тесты не закончились за ${budget} с — завис тест (или прогон стал в разы медленнее обычного); процесс убит`,
      );
    }
    if (pipesHeld) {
      verdicts.push(
        'jest вышел, но процесс, запущенный тестами, пережил его и держит вывод открытым — тест не убил своего потомка',
      );
    }
    for (const [re, meaning] of LEAK_SIGNS)
      if (re.test(out)) verdicts.push(meaning);
    const secs = Math.round((Date.now() - started) / 1000);
    console.log(
      `\njest-exit-guard: команда завершилась (код ${code ?? '—'}, сигнал ${signal ?? '—'}) за ${secs} с`,
    );
    for (const v of verdicts)
      console.log(`::error title=jest-exit-guard::${v}`);
    if (verdicts.length === 0) process.exit(code ?? 1);
    console.log(HINT);
    process.exit(code || 1);
  };
  child.on('error', (err) => {
    console.log(
      `::error title=jest-exit-guard::команда не запустилась: ${err.message}`,
    );
    process.exit(1);
  });
  // 'close' ждёт и пайпы; процесс вне группы, унаследовавший их, держал бы
  // его вечно — после 'exit' даём выводу 2 с, дальше это тоже утечка.
  child.on('close', (code, signal) => finish(code, signal, false));
  child.on('exit', (code, signal) => {
    exited = true;
    setTimeout(() => finish(code, signal, true), 2000);
  });
}

main();
