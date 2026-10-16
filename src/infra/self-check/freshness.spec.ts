// Свежесть снимка самопроверки (находка аудита 2026-10: смок сверял failed: [],
// но не возраст снимка, и остановившийся selfCheckHourly оставлял зелёное
// сутками). Здесь — границы порога, сверка с реальным @Cron (правило №4) и пин
// шага смока (поле контроллера и чтение смоком обязаны совпадать).
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import {
  SELF_CHECK_CRON,
  STARTUP_GRACE_MS,
  isSnapshotStale,
  maxSnapshotAgeMs,
} from './freshness';
import { scanCronClaims } from '../../test-support/cron-source-scan';

const ROOT = resolve(__dirname, '..', '..', '..');
const HOUR = 3_600_000;

describe('maxSnapshotAgeMs', () => {
  it('часовой крон → два часа: один пропущенный тик допустим, два — нет', () => {
    expect(maxSnapshotAgeMs()).toBe(2 * HOUR);
  });
});

describe('isSnapshotStale', () => {
  const NOW = 1_800_000_000_000;

  it('ровно два часа назад → ещё не протух, на миллисекунду больше → протух', () => {
    expect(isSnapshotStale({ ranAt: NOW - 2 * HOUR }, NOW, 0)).toBe(false);
    expect(isSnapshotStale({ ranAt: NOW - 2 * HOUR - 1 }, NOW, 0)).toBe(true);
  });

  it('свежий снимок не протух, даже если процесс живёт сутки', () => {
    expect(isSnapshotStale({ ranAt: NOW - 1000 }, NOW, 24 * HOUR)).toBe(false);
  });

  it('снимка нет: в грейсе старта не протух, после грейса — протух', () => {
    expect(isSnapshotStale({ ranAt: null }, NOW, STARTUP_GRACE_MS)).toBe(false);
    expect(isSnapshotStale({ ranAt: null }, NOW, STARTUP_GRACE_MS + 1)).toBe(
      true,
    );
  });
});

describe('сверка с реальными источниками', () => {
  it('SELF_CHECK_CRON совпадает с @Cron в self-check.service.ts', () => {
    const claim = scanCronClaims().find(
      (c) => c.claimName === 'selfCheckHourly',
    );
    expect(claim?.cron).toBe(SELF_CHECK_CRON);
  });

  const smoke = readFileSync(
    join(ROOT, '.github', 'workflows', 'prod-smoke.yml'),
    'utf8',
  );

  it('prod-smoke.yml читает selfCheck.stale', () => {
    expect(smoke).toContain('.selfCheck.stale == false');
  });

  it('контроль: пин краснеет на смоке, где проверки stale нет', () => {
    const without = smoke.replace(/^.*\.selfCheck\.stale.*$/gm, '');
    expect(without).not.toContain('.selfCheck.stale == false');
  });
});
