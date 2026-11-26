// Механизм (не таблица руками): окно аренды `LEASE_WINDOW.<x>`, переданное в
// `claimRun(имя, LEASE_WINDOW.<x>)` внутри тела кронового метода, обязано
// быть строго МЕНЬШЕ периода самого `@Cron(...)` — иначе законный тик
// пропускался бы навсегда (аренда предыдущего прогона ещё не истекла бы к
// моменту, когда крону пора сработать снова).
//
// Спек не хранит список кронов руками (это был бы храповик, слепой к новому
// крону, пока его не впишут — тот же изъян, что у `USER_DATA_TABLES` до
// табличного реестра-сверки). Вместо этого он читает исходники через общий
// сканер `src/test-support/cron-source-scan.ts` (находит пары
// `@Cron(<выражение>)` + `claimRun('имя', LEASE_WINDOW.<x>)` в теле того же
// метода — тот же сканер использует cron-lease-registry.spec.ts, чтобы не
// заводить вторую копию парсера), сам вычисляет период из cron-выражения и
// сверяет `окно < период`. Константы окон берутся импортом из
// cron-leader.service.ts, а не копией чисел.
import { LEASE_WINDOW } from './cron-leader.service';
import { scanCronClaims } from '../test-support/cron-source-scan';

/** Период между двумя тиками для поддержанных форм cron-выражения: minute —
 * "каждые N минут" или фиксированная минута; hour — любой час или конкретный
 * (см. examples в тестах ниже: five-minutes-in-two-hours, every-15-minutes,
 * once-an-hour, once-a-day). Форма шире этого списка — осознанно
 * неподдержана (падение говорит явно, что спек не умеет посчитать период,
 * а не молча считает окно валидным). */
function cronPeriodMs(expr: string): number {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`cron-leader-windows: не 5 полей в выражении «${expr}»`);
  }
  const [minute, hour] = parts;
  const everyN = minute.match(/^\*\/(\d+)$/);
  if (everyN) return Number(everyN[1]) * 60_000;
  if (minute === '*') return 60_000; // */1 по сути — раз в минуту
  if (/^\d+$/.test(minute)) {
    return hour === '*' ? 3_600_000 : 24 * 3_600_000;
  }
  throw new Error(
    `cron-leader-windows: неподдержанная форма minute-поля «${minute}» (выражение «${expr}»)`,
  );
}

interface Finding {
  file: string;
  method: string;
  cronExpr: string;
  periodMs: number;
  leaseName: string;
  windowKey: string;
  windowMs: number;
}

function findAll(): Finding[] {
  return scanCronClaims().map((f) => ({
    file: f.file,
    method: f.method,
    cronExpr: f.cron,
    periodMs: cronPeriodMs(f.cron),
    leaseName: f.claimName,
    windowKey: f.windowKey,
    windowMs: (LEASE_WINDOW as Record<string, number>)[f.windowKey],
  }));
}

describe('LEASE_WINDOW < период @Cron для каждого leader-крона', () => {
  const found = findAll();

  it('механизм реально что-то нашёл (иначе проверка ниже — пустая и лживо-зелёная)', () => {
    // Не хардкодим список кронов — только нижнюю границу-страховку: если этот
    // спек однажды начнёт находить 0 (регресс парсера), тесты ниже прошли бы
    // тривиально на пустом множестве и никто бы не заметил, что гейт ослеп.
    expect(found.length).toBeGreaterThanOrEqual(9);
  });

  it('окно аренды у каждого найденного крона строго меньше периода тика', () => {
    const bad = found.filter((f) => !(f.windowMs < f.periodMs));
    expect(
      bad.map(
        (f) =>
          `${f.file}::${f.method}: LEASE_WINDOW.${f.windowKey}=${f.windowMs}мс ≥ период(${f.cronExpr})=${f.periodMs}мс`,
      ),
    ).toEqual([]);
  });

  it('имена аренд (claimRun) уникальны — иначе два разных крона делят одну строку CronLease', () => {
    const names = found.map((f) => f.leaseName);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect([...new Set(dupes)]).toEqual([]);
  });

  it('LEASE_WINDOW.<x> из claimRun реально существует в cron-leader.service.ts', () => {
    const unknown = found.filter((f) => typeof f.windowMs !== 'number');
    expect(
      unknown.map((f) => `${f.file}::${f.method}: LEASE_WINDOW.${f.windowKey}`),
    ).toEqual([]);
  });
});

describe('cronPeriodMs — арифметика периода по форме выражения', () => {
  it.each([
    ['*/5 9,10 * * *', 5 * 60_000],
    ['*/15 * * * *', 15 * 60_000],
    ['*/5 * * * *', 5 * 60_000],
    ['* * * * *', 60_000],
    ['0 0 * * *', 24 * 3_600_000],
    ['17 3 * * *', 24 * 3_600_000],
    ['7 * * * *', 3_600_000],
  ])('%s → %dмс', (expr, expected) => {
    expect(cronPeriodMs(expr)).toBe(expected);
  });

  it('неподдержанная форма minute-поля (список минут через запятую) — явно падает, не молчит', () => {
    expect(() => cronPeriodMs('5,35 * * * *')).toThrow();
  });
});
