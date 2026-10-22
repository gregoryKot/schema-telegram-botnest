// Шов окна свежести initData (аудит 2026-10, «подпись проверяют две
// реализации»). Окно жило в трёх копиях: INIT_DATA_MAX_AGE_S у гарда и
// троттлера, литерал 3600 у POST /api/auth/telegram/webapp. Два совпадающих
// числа — не общее окно: правка константы расходила третий вход, а спеки
// каждого входа по отдельности оставались зелёными.
//
// Тест подменяет САМУ константу и прогоняет одну и ту же честно подписанную
// initData через все три настоящих входа: на границе (60 с) принимают все,
// секундой позже (61 с) отвергают все. Если кто-то вернёт свой литерал в
// любой из входов, тест краснеет.
jest.mock('./init-data-window', () => ({ INIT_DATA_MAX_AGE_S: 60 }));

import { createHmac } from 'crypto';
import type { Request } from 'express';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { applyTelegramInitData } from './init-data-paths';
import { verifiedInitDataSubject } from './throttler-init-data';
import { AuthService } from '../auth/auth.service';

const BOT_TOKEN = '12345:SEAM_TOKEN';
const NOW_MS = 1_800_000_000_000;
const WINDOW_S = 60;

function signedAt(ageS: number): string {
  const params = new URLSearchParams({
    auth_date: String(NOW_MS / 1000 - ageS),
    query_id: 'AAE_seam',
    user: JSON.stringify({ id: 777, first_name: 'Шов' }),
  });
  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  params.set(
    'hash',
    createHmac('sha256', secret).update(checkString).digest('hex'),
  );
  return params.toString();
}

/** Три настоящих входа: true — приняли, false — отвергли. */
async function acceptedBy(initData: string) {
  const config = { get: (k: string) => ({ BOT_TOKEN })[k as 'BOT_TOKEN'] };
  const authService = new AuthService(
    {} as never,
    { getOrThrow: () => BOT_TOKEN } as never,
    {} as never,
    {} as never,
  );

  const guardReq = { headers: { 'x-telegram-init-data': initData } } as never;
  const findOrCreate = jest.fn().mockResolvedValue(777n);
  let guard = true;
  try {
    await applyTelegramInitData(
      guardReq as Request,
      config as never,
      { findOrCreateUserByProvider: findOrCreate } as never,
      { log: jest.fn() } as never,
      { warn: jest.fn() } as unknown as Logger,
      { track: jest.fn().mockResolvedValue(undefined) } as never,
    );
  } catch (e) {
    expect(e).toBeInstanceOf(UnauthorizedException);
    guard = false;
  }

  const throttler = verifiedInitDataSubject(initData, BOT_TOKEN, NOW_MS);

  let service = true;
  try {
    authService.verifyTelegramWebAppData(initData);
  } catch (e) {
    expect(e).toBeInstanceOf(UnauthorizedException);
    service = false;
  }
  return { guard, throttler: throttler !== null, service };
}

describe('окно свежести initData — один источник на три входа', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW_MS);
  });
  afterEach(() => jest.useRealTimers());

  it(`${WINDOW_S} с (граница) — принимают гард, бакет лимита и POST /telegram/webapp`, async () => {
    await expect(acceptedBy(signedAt(WINDOW_S))).resolves.toEqual({
      guard: true,
      throttler: true,
      service: true,
    });
  });

  it(`${WINDOW_S + 1} с — отвергают все три (литерал 3600 в любом из входов это ловит)`, async () => {
    await expect(acceptedBy(signedAt(WINDOW_S + 1))).resolves.toEqual({
      guard: false,
      throttler: false,
      service: false,
    });
  });
});
