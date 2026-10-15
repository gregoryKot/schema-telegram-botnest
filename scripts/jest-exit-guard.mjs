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
//   * после сводки jest («Test Suites: … total») ждёт выхода не дольше
//     --exit-grace секунд, потом убивает группу процессов и падает: тесты
//     закончились, а процесс держит незакрытый хендл;
//   * за общий бюджет --budget секунд сводки нет — падает: завис тест (или
//     прогон стал в разы медленнее обычного);
//   * признак утечки в выводе или ненулевой код при сводке без упавших
//     тестов роняет шаг с причиной (правила — jest-exit-guard-rules.mjs);
//   * иначе выходит с кодом команды.
//
//   node scripts/jest-exit-guard.mjs [--budget 600] [--exit-grace 60] -- npx jest …
import { spawn } from 'child_process';
import { HINT, runFinished, verdicts } from './jest-exit-guard-rules.mjs';

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
  // Потоки копятся раздельно: строка stdout, разрезанная куском stderr,
  // не должна склеиться в «начало строки» для шаблонов правил.
  const streams = { stdout: '', stderr: '' };
  let killedFor = null;
  let graceTimer;
  let exited = false;
  let finished = false;

  const killGroup = (signal = 'SIGKILL') => {
    try {
      process.kill(-child.pid, signal);
    } catch {
      // в группе никого не осталось — убивать некого
    }
  };
  // Причина убийства — только пока команда жива; после её выхода группу
  // всё равно добиваем: в ней может остаться потомок с нашими пайпами.
  const kill = (reason) => {
    if (!exited) killedFor ??= reason;
    killGroup();
  };
  const budgetTimer = setTimeout(
    () =>
      kill(
        runFinished(streams.stderr + '\n' + streams.stdout) ? 'held' : 'budget',
      ),
    budget * 1000,
  );
  const relay = (name, sink) => (chunk) => {
    sink.write(chunk);
    const before = streams[name].length;
    streams[name] += chunk.toString();
    // С начала строки, на которой кончился прошлый кусок: сводка могла
    // разрезаться на границе, а шаблоны правил привязаны к началу строки.
    const fresh = streams[name].slice(
      streams[name].lastIndexOf('\n', before - 1) + 1,
    );
    if (!graceTimer && runFinished(fresh)) {
      graceTimer = setTimeout(() => kill('held'), grace * 1000);
    }
  };
  child.stdout.on('data', relay('stdout', process.stdout));
  child.stderr.on('data', relay('stderr', process.stderr));
  // Отмена шага (SIGINT/SIGTERM) доходит до jest: он в своей группе.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => killGroup(signal));
  }

  const finish = (code, signal, pipesHeld) => {
    if (finished) return;
    finished = true;
    clearTimeout(budgetTimer);
    clearTimeout(graceTimer);
    if (pipesHeld) killGroup();
    const found = verdicts({
      output: streams.stderr + '\n' + streams.stdout,
      code,
      killedFor,
      pipesHeld,
      grace,
      budget,
    });
    const secs = Math.round((Date.now() - started) / 1000);
    console.log(
      `\njest-exit-guard: команда завершилась (код ${code ?? '—'}, сигнал ${signal ?? '—'}) за ${secs} с`,
    );
    for (const v of found) console.log(`::error title=jest-exit-guard::${v}`);
    if (found.length === 0) process.exit(code ?? 1);
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
