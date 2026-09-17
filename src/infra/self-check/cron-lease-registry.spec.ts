// Сверка правила №4 CLAUDE.md: денормализованный реестр CRON_LEASE_REGISTRY
// (окно + cron-строка на каждое leader-имя) обязан совпадать И с исходниками
// (через общий сканер src/test-support/cron-source-scan.ts — тот же, что
// использует cron-leader-windows.spec.ts, чтобы не заводить вторую копию
// парсера), И с scripts/cron-leader-baseline.json (какие claimRun-имена
// вообще leader-кроны). Разъезд в любую сторону — тест краснеет, а не молчит.
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import {
  CRON_LEASE_REGISTRY,
  NOMINAL_PERIOD_MS,
  maxLeaseAgeMs,
} from './cron-lease-registry';
import { LEASE_WINDOW } from '../cron-leader.service';
import { scanCronClaims } from '../../test-support/cron-source-scan';

const ROOT = resolve(__dirname, '..', '..', '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'cron-leader-baseline.json');

// selfCheckHourly тоже вызывает claimRun (см. self-check.service.ts), но
// сознательно не входит в CRON_LEASE_REGISTRY — самопроверка не мониторит
// свежесть собственной аренды (см. комментарий в probe-cron-leases.ts).
const SELF_CHECK_FILE = 'src/infra/self-check/self-check.service.ts';

describe('CRON_LEASE_REGISTRY — сверка с исходниками', () => {
  const found = scanCronClaims().filter((f) => f.file !== SELF_CHECK_FILE);

  it('механизм реально что-то нашёл (иначе проверки ниже пустые и лживо-зелёные)', () => {
    expect(found.length).toBeGreaterThanOrEqual(9);
  });

  it('каждый claimRun в src/** зарегистрирован в реестре с тем же окном', () => {
    const bad = found
      .filter((f) => CRON_LEASE_REGISTRY[f.claimName]?.window !== f.windowKey)
      .map(
        (f) =>
          `${f.claimName}: в коде LEASE_WINDOW.${f.windowKey}, в реестре ${CRON_LEASE_REGISTRY[f.claimName]?.window ?? '<нет>'}`,
      );
    expect(bad).toEqual([]);
  });

  it('cron-строка в реестре совпадает с @Cron(...) в исходнике', () => {
    const bad = found
      .filter((f) => CRON_LEASE_REGISTRY[f.claimName]?.cron !== f.cron)
      .map(
        (f) =>
          `${f.claimName}: в коде «${f.cron}» (${f.file}), в реестре «${CRON_LEASE_REGISTRY[f.claimName]?.cron ?? '<нет>'}»`,
      );
    expect(bad).toEqual([]);
  });

  it('в реестре нет протухших имён — каждое встречается в claimRun в коде', () => {
    const names = new Set(found.map((f) => f.claimName));
    const orphans = Object.keys(CRON_LEASE_REGISTRY).filter(
      (n) => !names.has(n),
    );
    expect(orphans).toEqual([]);
  });
});

describe('CRON_LEASE_REGISTRY — сверка с cron-leader-baseline.json', () => {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<
    string,
    { status: string }
  >;
  const leaderMethodCount = Object.values(baseline).filter(
    (v) => v.status === 'leader',
  ).length;

  it('число leader-кронов в бейслайне не меньше числа записей реестра (реестр — их подмножество, минус сам selfCheckHourly)', () => {
    expect(leaderMethodCount).toBeGreaterThanOrEqual(
      Object.keys(CRON_LEASE_REGISTRY).length,
    );
  });
});

describe('NOMINAL_PERIOD_MS / maxLeaseAgeMs', () => {
  it('покрывает каждую категорию LEASE_WINDOW', () => {
    expect(Object.keys(NOMINAL_PERIOD_MS).sort()).toEqual(
      Object.keys(LEASE_WINDOW).sort(),
    );
  });

  it('окно аренды всегда меньше номинального периода той же категории', () => {
    for (const key of Object.keys(LEASE_WINDOW) as Array<
      keyof typeof LEASE_WINDOW
    >) {
      expect(LEASE_WINDOW[key]).toBeLessThan(NOMINAL_PERIOD_MS[key]);
    }
  });

  it('maxLeaseAgeMs — из расписания; для равномерных кронов по-прежнему ровно 2 номинальных периода', () => {
    expect(maxLeaseAgeMs('bookingExpireHolds')).toBe(
      2 * NOMINAL_PERIOD_MS.everyMinute,
    );
    expect(maxLeaseAgeMs('midnightPlanner')).toBe(2 * NOMINAL_PERIOD_MS.daily);
    expect(maxLeaseAgeMs('неизвестное-имя')).toBeNull();
  });

  it('maxLeaseAgeMs — оконный healthyAdultMorning: разрыв окна (22ч05м) + шаг (5м), а не 2×5м', () => {
    // Регрессия 2026-09-16 (issue #501): по старой логике порог был бы
    // 2×NOMINAL_PERIOD_MS.fiveMinutes = 10 мин, и крон, законно молчащий
    // 22 часа между окнами публикации, считался бы сбойным почти всегда.
    expect(maxLeaseAgeMs('healthyAdultMorning')).toBe(
      22 * 3_600_000 + 5 * 60_000 + 5 * 60_000,
    );
  });
});
