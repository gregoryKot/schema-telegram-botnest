// Учёт падений приложения супервизором старта (deploy/entrypoint.mjs): лимит
// серии и троттл DM о перезапуске. Состояние живёт здесь, в супервизоре, а не в
// приложении: процесс приложения после падения начинается с чистой памятью, и
// любой его собственный троттл обнулился бы на каждом круге.
//
// Аудит 2026-10, находка «Супервизор контейнера»: счётчик обнулял любой прогон
// дольше минуты — приложение, падающее каждые 61 с, вечно жило на «fails=1/3»,
// без лимита и паузы, а каждый круг слал владельцу DM о старте. Теперь:
//   - лимит серии по ДВУМ скользящим окнам: maxFails падений за windowMs (15 мин,
//     частый крашлуп) или hourMaxFails за час (редкий: период 8,5 мин даёт в
//     15-минутном окне лишь два падения и без второго окна крутился бы вечно);
//   - DM о перезапуске — только когда число падений за сутки равно 1, 2, 4, 8…
//     и об этом уровне (или выше) за сутки ещё не сообщали: не больше ~log2
//     падений в сутки, сколько бы раз процесс ни перезапускался.
// Падение раз в полчаса (утечка → OOM) — не крашлуп: оба окна его не паркуют.

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

/** Метки падений, попавшие в окно [now - windowMs, now], включая текущую. */
export function crashesInWindow(times, now, windowMs) {
  return [...times, now].filter((t) => now - t < windowMs);
}

/**
 * Положительное число из env, иначе значение по умолчанию. Без проверки
 * `STARTUP_CRASH_WINDOW_MS=abc` дал бы NaN, `now - t < NaN` всегда ложно — и
 * вечный крашлуп вернулся бы через опечатку в панели.
 */
export function positiveOr(raw, def) {
  const n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(n) && n > 0
    ? n
    : def;
}

const isPowerOfTwo = (n) => n > 0 && (n & (n - 1)) === 0;

/**
 * Сообщать ли о запуске при `crashes` падениях за сутки. Первый запуск (падений
 * нет) — DM о деплое всегда. Дальше — только на уровне-степени двойки, о котором
 * (или о более высоком) за окно ещё не сообщали: скользящее окно колеблется у
 * своего потолка, и без второго условия «64 → 63 → 64» слало бы DM снова.
 */
export function shouldNotice(crashes, notices, now, windowMs) {
  if (crashes === 0) return true;
  if (!isPowerOfTwo(crashes)) return false;
  return !notices.some((n) => now - n.at < windowMs && n.k >= crashes);
}

/**
 * Книга падений одного контейнера. cfg: windowMs, maxFails, hourMaxFails
 * (окна и лимиты серии), hourMs и dayMs — только для тестов.
 */
export function createCrashBook(cfg) {
  const hourMs = cfg.hourMs ?? HOUR_MS;
  const dayMs = cfg.dayMs ?? DAY_MS;
  let series = []; // падения текущей серии за последний час
  let day = []; // падения контейнера за сутки — через серии
  let notices = []; // { at, k }: о каком числе падений за сутки уже сообщили
  let launches = 0;
  return {
    /** Новая серия после паузы — лимит считается заново, сутки помнятся. */
    newSeries() {
      series = [];
    },
    /** Env очередного запуска приложения (читает src/telegram/start-launch-env.ts). */
    launchEnv(now) {
      launches += 1;
      day = day.filter((t) => now - t < dayMs);
      notices = notices.filter((n) => now - n.at < dayMs);
      const k = day.length;
      const notice = shouldNotice(k, notices, now, dayMs);
      if (notice && k > 0) notices.push({ at: now, k });
      return {
        STARTUP_LAUNCH: String(launches),
        STARTUP_CRASHES_DAY: String(k),
        STARTUP_NOTICE: notice ? '1' : '0',
      };
    },
    /** Учёт падения: { fails, hourFails, limit, note } — note дописывается в лог. */
    crash(now) {
      series = crashesInWindow(series, now, hourMs);
      day = crashesInWindow(day, now, dayMs);
      const fails = series.filter((t) => now - t < cfg.windowMs).length;
      const hourFails = series.length;
      const limit = fails >= cfg.maxFails || hourFails >= cfg.hourMaxFails;
      return { fails, hourFails, limit, note: `, за час ${hourFails}/${cfg.hourMaxFails}` };
    },
  };
}
