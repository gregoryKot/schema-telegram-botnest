// Юнит-тесты чистой логики refresh-rotation.ts (вынесена из auth.service.ts —
// правило №10 CLAUDE.md). Интеграционные сценарии (реальный Prisma-фейк,
// securityLog) — в auth.service.spec.ts, «AuthService — refresh-token rotation».
import {
  REFRESH_REUSE_GRACE_MS,
  REFRESH_ROTATE_MIN_INTERVAL_MS,
  isTheftReuse,
  classifyReuse,
  shouldSkipRotation,
} from './refresh-rotation';

const NOW = new Date('2026-08-21T12:00:00.000Z');

describe('isTheftReuse', () => {
  it('revokedAt отсутствует (истёк, не отозван ротацией) → всегда кража (старое поведение)', () => {
    expect(isTheftReuse(null, NOW)).toBe(true);
  });

  it('отозван только что (дребезг: две вкладки/оборванный Set-Cookie) → не кража', () => {
    expect(isTheftReuse(NOW, NOW)).toBe(false);
    expect(
      isTheftReuse(
        new Date(NOW.getTime() - (REFRESH_REUSE_GRACE_MS - 1)),
        NOW,
      ),
    ).toBe(false);
  });

  it('граница окна (ровно REFRESH_REUSE_GRACE_MS) → уже кража (>=, не >)', () => {
    expect(
      isTheftReuse(new Date(NOW.getTime() - REFRESH_REUSE_GRACE_MS), NOW),
    ).toBe(true);
  });

  it('отозван давно (за пределами окна) → кража', () => {
    expect(
      isTheftReuse(
        new Date(NOW.getTime() - REFRESH_REUSE_GRACE_MS - 1),
        NOW,
      ),
    ).toBe(true);
  });
});

describe('classifyReuse', () => {
  it('кража → theft:true, сообщение упоминает family/userId', () => {
    const v = classifyReuse(
      new Date(NOW.getTime() - 60_000),
      NOW,
      42n,
    );
    expect(v.theft).toBe(true);
    expect(v.logMessage).toMatch(/reuse detected/i);
    expect(v.logMessage).toContain('42');
  });

  it('дребезг → theft:false, сообщение отличает race от theft', () => {
    const v = classifyReuse(NOW, NOW, 42n);
    expect(v.theft).toBe(false);
    expect(v.logMessage).toMatch(/race, not theft/i);
  });
});

describe('shouldSkipRotation', () => {
  it('ротировали только что → true (пропустить повторную ротацию)', () => {
    expect(shouldSkipRotation(NOW, NOW)).toBe(true);
    expect(
      shouldSkipRotation(
        new Date(NOW.getTime() - (REFRESH_ROTATE_MIN_INTERVAL_MS - 1)),
        NOW,
      ),
    ).toBe(true);
  });

  it('граница интервала (ровно REFRESH_ROTATE_MIN_INTERVAL_MS) → уже можно ротировать', () => {
    expect(
      shouldSkipRotation(
        new Date(NOW.getTime() - REFRESH_ROTATE_MIN_INTERVAL_MS),
        NOW,
      ),
    ).toBe(false);
  });

  it('ротировали давно → false (можно ротировать снова)', () => {
    expect(
      shouldSkipRotation(
        new Date(NOW.getTime() - REFRESH_ROTATE_MIN_INTERVAL_MS - 1),
        NOW,
      ),
    ).toBe(false);
  });

  it('createdAt отсутствует (только тестовые fake-Prisma без @default(now())) → не тормозит ротацию', () => {
    expect(shouldSkipRotation(null, NOW)).toBe(false);
    expect(shouldSkipRotation(undefined, NOW)).toBe(false);
  });
});
