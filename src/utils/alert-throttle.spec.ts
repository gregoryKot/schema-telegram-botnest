// AlertThrottle — регресс инцидента 2026-07-29 (шквал одинаковых DM
// «suspicious_initdata» замьютил админский чат — свернутый на час мини-апп
// шлёт ту же просроченную initData в каждом запросе). Тесты переехали сюда
// вместе с извлечением класса из src/api/initdata-alert.ts.
//
// AlertBudget — та же защита, но не единственным слотом: до появления этого
// примитива `csrf_blocked`/`refresh_token_reuse` вообще не были троттлены —
// регрессия домена cookie/SameSite после деплоя ломает CSRF для КАЖДОЙ
// авторизованной записи КАЖДОГО пользователя разом → DM на каждый запрос →
// админ мьютит чат → ноль алертов ровно во время аварии (тот же урок,
// 2026-07-29, только для другого события). Одного слота на весь троттлинг
// мало и для другой стороны: `merge_confirmed`/`role_changed` редки и КАЖДЫЙ
// из них важен по отдельности — двое разных пользователей, слившие аккаунты
// в один и тот же час, обязаны получить два разных DM.
import { AlertBudget, AlertThrottle } from './alert-throttle';

describe('AlertThrottle', () => {
  const WINDOW = 10 * 60_000;

  it('первый случай проходит, остальные в окне копятся счётчиком', () => {
    const t = new AlertThrottle(WINDOW);
    expect(t.take('ip', 0)).toEqual({ allow: true, suppressed: 0 });
    expect(t.take('ip', 1_000)).toEqual({ allow: false, suppressed: 1 });
    expect(t.take('ip', 2_000)).toEqual({ allow: false, suppressed: 2 });
  });

  it('после окна снова пропускает и сообщает, сколько проглотил', () => {
    const t = new AlertThrottle(WINDOW);
    t.take('ip', 0);
    t.take('ip', 1_000);
    t.take('ip', 2_000);
    expect(t.take('ip', WINDOW + 1)).toEqual({ allow: true, suppressed: 2 });
    // счётчик обнулился вместе с новым окном
    expect(t.take('ip', WINDOW + 2)).toEqual({ allow: false, suppressed: 1 });
  });

  it('разные ключи не глушат друг друга', () => {
    const t = new AlertThrottle(WINDOW);
    expect(t.take('a', 0).allow).toBe(true);
    expect(t.take('b', 0).allow).toBe(true);
  });

  it('старые ключи вычищаются — карта не растёт бесконечно', () => {
    const t = new AlertThrottle(WINDOW, 3);
    for (let i = 0; i < 5; i++) t.take(`ip-${i}`, i * WINDOW * 3);
    expect(t.take('ip-0', 5 * WINDOW * 3)).toEqual({
      allow: true,
      suppressed: 0,
    });
  });
});

describe('AlertBudget', () => {
  const WINDOW = 15 * 60_000;
  const K = 3;

  it('редкие события (меньше K в окне) доставляются ВСЕ', () => {
    const b = new AlertBudget(WINDOW, K);
    expect(b.take('merge_confirmed', 0)).toEqual({
      allow: true,
      suppressed: 0,
    });
    expect(b.take('merge_confirmed', 1_000)).toEqual({
      allow: true,
      suppressed: 0,
    });
  });

  it('шквал доставляет ровно K, дальше глушит счётчиком', () => {
    const b = new AlertBudget(WINDOW, K);
    for (let i = 0; i < K; i++) {
      expect(b.take('csrf_blocked', i * 10).allow).toBe(true);
    }
    // (K+1)-й и далее в том же окне — подавлены, счётчик растёт
    expect(b.take('csrf_blocked', 1_000)).toEqual({
      allow: false,
      suppressed: 1,
    });
    expect(b.take('csrf_blocked', 2_000)).toEqual({
      allow: false,
      suppressed: 2,
    });
  });

  it('счётчик подавленных всплывает на следующем допущенном алерте', () => {
    const b = new AlertBudget(WINDOW, K);
    for (let i = 0; i < K; i++) b.take('csrf_blocked', i * 10);
    for (let i = 0; i < 50; i++) b.take('csrf_blocked', 1_000 + i);
    // Новое окно — первый вызов снова допущен и сообщает, сколько проглотили
    const next = b.take('csrf_blocked', WINDOW + 1);
    expect(next).toEqual({ allow: true, suppressed: 50 });
  });

  it('разные имена событий бюджет не делят', () => {
    const b = new AlertBudget(WINDOW, K);
    for (let i = 0; i < K; i++) b.take('csrf_blocked', i * 10);
    // csrf_blocked уже упёрся в потолок — refresh_token_reuse получает свой
    expect(b.take('refresh_token_reuse', 100)).toEqual({
      allow: true,
      suppressed: 0,
    });
  });

  it('после закрытия окна бюджет открывается заново', () => {
    const b = new AlertBudget(WINDOW, K);
    for (let i = 0; i < K; i++) b.take('csrf_blocked', i * 10);
    expect(b.take('csrf_blocked', 500).allow).toBe(false); // окно ещё то же
    for (let i = 0; i < K; i++) {
      expect(b.take('csrf_blocked', WINDOW + i * 10).allow).toBe(true);
    }
  });

  it('старые ключи вычищаются — карта не растёт бесконечно', () => {
    const b = new AlertBudget(WINDOW, K, 3);
    for (let i = 0; i < 5; i++) b.take(`event-${i}`, i * WINDOW * 3);
    expect(b.take('event-0', 5 * WINDOW * 3)).toEqual({
      allow: true,
      suppressed: 0,
    });
  });
});
