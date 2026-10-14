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
