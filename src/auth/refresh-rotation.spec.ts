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

// isTheftReuse остался запасным признаком: он применяется ТОЛЬКО к строкам без
// наследника (выданным до появления replacedByHash). Основной признак — сам
// наследник, см. classifyReuse ниже.
describe('isTheftReuse', () => {
  it('revokedAt отсутствует (истёк по TTL, не отзывали) → НЕ кража', () => {
    // Раньше здесь было true: вернувшийся через месяц человек считался вором,
    // терял все свои сессии и будил админа (разбор 2026-08-28).
    expect(isTheftReuse(null, NOW)).toBe(false);
  });

  it('отозван только что (дребезг: две вкладки/оборванный Set-Cookie) → не кража', () => {
    expect(isTheftReuse(NOW, NOW)).toBe(false);
    expect(
      isTheftReuse(new Date(NOW.getTime() - (REFRESH_REUSE_GRACE_MS - 1)), NOW),
    ).toBe(false);
  });

  it('граница окна (ровно REFRESH_REUSE_GRACE_MS) → уже кража (>=, не >)', () => {
    expect(
      isTheftReuse(new Date(NOW.getTime() - REFRESH_REUSE_GRACE_MS), NOW),
    ).toBe(true);
  });

  it('отозван давно (за пределами окна) → кража', () => {
    expect(
      isTheftReuse(new Date(NOW.getTime() - REFRESH_REUSE_GRACE_MS - 1), NOW),
    ).toBe(true);
  });
});

describe('classifyReuse — вердикт по наследнику, а не по времени', () => {
  const revoked = { revokedAt: NOW, replacedByHash: 'succ-hash' };
  const live = {
    revokedAt: null,
    expiresAt: new Date(NOW.getTime() + 86_400_000),
  };

  it('наследник цел и не тронут → восстановить, даже если прошли СУТКИ', () => {
    // Ровно тот случай, из-за которого выкидывало: мобильная ОС усыпила
    // приложение вместе с недоехавшим ответом, человек вернулся назавтра.
    const later = new Date(NOW.getTime() + 86_400_000 - 1);
    const v = classifyReuse(revoked, live, later, 42n);
    expect(v.outcome).toBe('recover');
    expect(v.logMessage).toMatch(/lost/i);
  });

  it('наследник уже отозван → цепочкой пользуется кто-то ещё → кража', () => {
    const used = {
      revokedAt: NOW,
      expiresAt: new Date(NOW.getTime() + 86_400_000),
    };
    const v = classifyReuse(revoked, used, NOW, 42n);
    expect(v.outcome).toBe('theft');
    expect(v.logMessage).toMatch(/reuse detected/i);
    expect(v.logMessage).toContain('42');
  });

  it('наследник пропал из базы → кража, а не молчаливое восстановление', () => {
    expect(classifyReuse(revoked, null, NOW, 42n).outcome).toBe('theft');
  });

  it('наследник сам истёк → восстанавливать нечего, это кража', () => {
    const stale = { revokedAt: null, expiresAt: new Date(NOW.getTime() - 1) };
    expect(classifyReuse(revoked, stale, NOW, 42n).outcome).toBe('theft');
  });

  it('истёк по TTL, никто не отзывал → отказ БЕЗ отзыва семьи и без алерта', () => {
    const v = classifyReuse(
      { revokedAt: null, replacedByHash: null },
      null,
      NOW,
      42n,
    );
    expect(v.outcome).toBe('reject');
    expect(v.logMessage).toMatch(/expired naturally/i);
  });

  describe('строки, выданные до появления наследника — запасной признак', () => {
    const legacy = (revokedAt: Date) => ({ revokedAt, replacedByHash: null });

    it('дребезг в пределах окна → отказ, семью не трогаем', () => {
      const v = classifyReuse(legacy(NOW), null, NOW, 42n);
      expect(v.outcome).toBe('reject');
      expect(v.logMessage).toMatch(/race, not theft/i);
    });

    it('повтор за пределами окна → кража (прежнее поведение)', () => {
      const old = new Date(NOW.getTime() - REFRESH_REUSE_GRACE_MS - 1);
      expect(classifyReuse(legacy(old), null, NOW, 42n).outcome).toBe('theft');
    });
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
