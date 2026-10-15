import {
  WEB_USER_ID_MAX,
  WEB_USER_ID_MIN,
  isTelegramUserId,
  isWebUserId,
} from './user-id-range';

describe('диапазон userId', () => {
  // Пин допущения, на котором держится каждый оставшийся Number(userId) в
  // src/** (guard, init-data-paths, therapist-request, req.telegramUserId).
  // Веб-номер ниже 2^53 -> Number() его не округляет. Расширяешь диапазон за
  // 2^53 — сначала вычисти Number() над userId, потом меняй число здесь
  // (аудит 2026-10, X-1).
  it('все веб-номера точно представимы в Number (MAX - 1 <= MAX_SAFE_INTEGER)', () => {
    expect(WEB_USER_ID_MAX - 1n <= BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    const last = WEB_USER_ID_MAX - 1n;
    expect(BigInt(Number(last))).toBe(last);
  });

  it('граница диапазона: ниже MIN — телеграмный номер, с MIN — веб', () => {
    expect(isWebUserId(WEB_USER_ID_MIN)).toBe(true);
    expect(isTelegramUserId(WEB_USER_ID_MIN)).toBe(false);
    expect(isWebUserId(WEB_USER_ID_MIN - 1n)).toBe(false);
    expect(isTelegramUserId(WEB_USER_ID_MIN - 1n)).toBe(true);
  });
});
