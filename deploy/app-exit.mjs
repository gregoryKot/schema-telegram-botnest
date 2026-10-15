// Что делать супервизору, когда приложение (ребёнок entrypoint) завершилось.
// Вынесено из entrypoint.mjs, чтобы решение жило в одном читаемом месте, а сам
// entrypoint не рос (правило №10).
//
// Без перезапуска выходим только когда остановку попросили МЫ (SIGTERM/SIGINT
// самому entrypoint → shuttingDown). Сигнал, пришедший ребёнку от кого-то ещё,
// — это смерть, а не остановка: V8 при heap-OOM шлёт себе SIGABRT, OOM-killer
// хоста — SIGKILL, нативный модуль — SIGSEGV. Раньше любой сигнал читался как
// штатный, и прод навсегда парковался на техработах без перезапуска и без
// строки в логе (аудит 2026-10-11, r2-3#0). run() отдаёт code=0 при сигнале
// (code === null), поэтому «чистый выход» обязан проверять и signal.
//
// 'stop'  — остановка по нашей просьбе, не перезапускаем;
// 'clean' — приложение само вышло с кодом 0, выходим и мы;
// 'crash' — упало с кодом или убито сигналом: счётчик, бэкофф, перезапуск.
export function classifyAppExit(app, shuttingDown) {
  if (shuttingDown) return 'stop';
  if (!app.signal && app.code === 0) return 'clean';
  return 'crash';
}

export function crashMessage(app, ranMs, fails, maxFails) {
  const tail = `ranMs=${ranMs}, fails=${fails}/${maxFails}`;
  return app.signal
    ? `[entrypoint] приложение убито сигналом ${app.signal} (${tail})`
    : `[entrypoint] приложение упало (code=${app.code}, ${tail})`;
}

// Пауза перед следующей серией запусков, когда лимит перезапусков исчерпан или
// БД не поднялась: base, затем ×2 на каждом круге подряд, потолок max. Без неё
// супервизор паркуется навсегда (аудит 2026-10-11, infra#13): контейнер жив,
// restart-policy не срабатывает, а чинить сбой, прошедший сам, — некому.
// Рост нужен, чтобы затяжная авария не слала DM «Деплой завершён» каждые
// несколько минут: троттлы AlertLogger живут в памяти и с процессом не
// переживают, поэтому шторм гасит только эта пауза.
export function cooldownMs(round, base, max) {
  if (!(base > 0)) return 0;
  return Math.min(base * 2 ** Math.max(0, round), Math.max(base, max));
}

function humanDuration(ms) {
  if (ms >= 60000) return `${Math.round(ms / 60000)} мин`;
  if (ms >= 1000) return `${Math.round(ms / 1000)} с`;
  return `${ms} мс`;
}

const COOLDOWN_REASONS = {
  limit: 'лимит перезапусков исчерпан',
  db: 'БД не поднялась в отведённое время',
};

export function cooldownMessage(reason, ms) {
  return `[entrypoint] ${COOLDOWN_REASONS[reason]} — техработы, следующая серия через ${humanDuration(ms)}`;
}

// Внешний цикл супервизора: серия (runSeries) кончилась лимитом или недоступной
// БД → пауза cooldownMs и новая серия. Пауза растёт с каждой серией подряд и
// сбрасывается, когда в серии приложение хоть раз проработало «здоровое» время.
// runSeries отдаёт undefined, когда продолжать нечего (остановка, чистый выход,
// парковка по migrate: её повтор задвоил бы DML неидемпотентной миграции).
export async function superviseSeries(runSeries, { base, max, stopping, sleep, log }) {
  let round = 0;
  for (;;) {
    const res = await runSeries();
    if (!res || stopping()) return;
    if (res.healthy) round = 0;
    const ms = cooldownMs(round++, base, max);
    log(cooldownMessage(res.reason, ms));
    await sleep(ms);
    if (stopping()) return;
  }
}
