// Хвост R7 (аудит 2026-11): досылка не отличала «не доставлено» от «исход
// неизвестен» — после таймаута ответа или обрыва после отправки пост мог
// выйти, а через 15 минут уходил ещё раз. Здесь — классификатор ошибок,
// метка в журнале и троттлинг сообщения владельцу; связка с досылкой — в
// channel-schedule.service.spec.ts, с планом — в retry-plan.spec.ts.
import { Logger } from '@nestjs/common';
import { ChannelPublisherService } from './channel-publisher.service';
import type { ChannelTarget } from './channel-target';
import type { HealthyAdultService } from '../bot/healthy-adult.service';
import type { DeliveryLogService } from './delivery-log.service';
import { formatDeliveryLog } from './delivery-log.format';
import {
  UnknownOutcomeWarnings,
  isAfterSendFailure,
  isUnknownReason,
  markUnknown,
  splitUnknown,
} from './unknown-outcome';

const sys = (code: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(`${code} boom`), { code, ...extra });
const named = (name: string) => Object.assign(new Error(name), { name });
const fetchFailed = (cause: unknown) =>
  Object.assign(new TypeError('fetch failed'), { cause });

describe('isAfterSendFailure — запрос мог дойти, ответа нет', () => {
  it.each([
    ['наша отмена fetch (AbortSignal.timeout)', named('TimeoutError')],
    ['наша отмена telegraf (AbortController)', named('AbortError')],
    [
      'node-fetch: таймаут ответа',
      Object.assign(new Error('x'), { type: 'request-timeout' }),
    ],
    ['обрыв после записи', sys('ECONNRESET')],
    ['undici: сокет закрыт', fetchFailed(sys('UND_ERR_SOCKET'))],
    [
      'undici: заголовки не пришли',
      fetchFailed(sys('UND_ERR_HEADERS_TIMEOUT')),
    ],
    ['socket hang up', new Error('request failed, reason: socket hang up')],
    ['ETIMEDOUT на чтении', sys('ETIMEDOUT', { syscall: 'read' })],
  ])('%s → да', (_label, err) => {
    expect(isAfterSendFailure(err)).toBe(true);
  });

  it.each([
    ['соединение не установилось', fetchFailed(sys('ECONNREFUSED'))],
    [
      'connect ETIMEDOUT',
      sys('ETIMEDOUT', { syscall: 'connect', erroredSysCall: 'connect' }),
    ],
    ['DNS', sys('ENOTFOUND')],
    [
      'ответ площадки с кодом',
      Object.assign(new Error('403'), { code: 403, status: 403 }),
    ],
    ['ошибка до запроса', new Error('бот не инициализирован (нет BOT_TOKEN?)')],
    ['не объект', 'boom'],
    ['null', null],
  ])('%s → нет', (_label, err) => {
    expect(isAfterSendFailure(err)).toBe(false);
  });
});

describe('метка в журнале', () => {
  it('markUnknown ↔ isUnknownReason; обычная причина не помечена', () => {
    expect(isUnknownReason(markUnknown('таймаут'))).toBe(true);
    expect(isUnknownReason('403: нет доступа')).toBe(false);
    expect(isUnknownReason(null)).toBe(false);
  });

  it('/zv log пишет «исход неизвестен», а не «не дошло»', () => {
    const at = new Date(Date.UTC(2026, 10, 8, 7, 5));
    const row = (reason: string) => ({
      source: 'утро',
      platform: 'telegram',
      destination: '@ch',
      ok: false,
      reason,
      createdAt: at,
    });
    const log = formatDeliveryLog([
      row(markUnknown('таймаут')),
      row('403: нет доступа'),
    ]);
    expect(log).toContain('telegram — исход неизвестен: таймаут');
    expect(log).not.toContain('не дошло — исход неизвестен');
    expect(log).toContain('telegram — не дошло — 403: нет доступа');
  });
});

describe('ChannelPublisherService — метка исхода в отчёте и журнале', () => {
  afterEach(() => jest.restoreAllMocks());

  it('таймаут ответа помечен, отказ площадки — нет', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const target = (platform: string, err: unknown): ChannelTarget => ({
      platform,
      title: platform,
      envKey: 'X',
      destination: () => '@ch',
      send: jest.fn().mockRejectedValue(err),
      explain: (e) => (e as Error).message,
    });
    const record = jest.fn().mockResolvedValue(undefined);
    const recordPost = jest.fn().mockResolvedValue(undefined);
    const phrases = {
      recentPostTexts: jest.fn().mockResolvedValue([]),
      pickFromPool: jest.fn().mockResolvedValue('фраза'),
      recordPost,
      poolStatus: jest
        .fn()
        .mockResolvedValue({ enabled: 40, unused: 30, daysLeft: 15 }),
    } as unknown as HealthyAdultService;
    const res = await new ChannelPublisherService(
      [
        target('telegram', named('AbortError')),
        target('vk', new Error('403: нет доступа')),
      ],
      phrases,
      { record } as unknown as DeliveryLogService,
    ).publish('утро');

    const reasons = Object.fromEntries(
      res.failed.map((f) => [f.platform, f.reason]),
    );
    expect(isUnknownReason(reasons.telegram)).toBe(true);
    expect(isUnknownReason(reasons.vk)).toBe(false);
    // В журнал уходит та же причина — по ней досылка решает «не повторять».
    expect(record).toHaveBeenCalledWith('утро', [], res.failed, 'фраза');
    // Пост мог выйти — фраза занята, слот закрыт: тик её не повторит.
    expect(res.posted).toBe(true);
    expect(recordPost).toHaveBeenCalledWith('фраза', 'pool');
  });
});

describe('splitUnknown — отказы и «пост мог выйти» раздельно', () => {
  it('исход неизвестен уходит в площадки для ручной проверки, остальное — в отказы', () => {
    const tg = { platform: 'telegram', reason: markUnknown('таймаут') };
    const vk = { platform: 'vk', reason: '403: нет доступа' };
    expect(splitUnknown([tg, vk])).toEqual({
      failed: [vk],
      unknown: ['telegram'],
    });
    expect(splitUnknown([])).toEqual({ failed: [], unknown: [] });
  });
});

describe('UnknownOutcomeWarnings — владельцу раз на площадку в слоте', () => {
  it('повторный тик молчит, новая площадка и новый слот — говорят', () => {
    const w = new UnknownOutcomeWarnings();
    const key = '2026-11-08:morning:повтор';
    expect(w.fresh(key, ['telegram'])).toEqual(['telegram']);
    expect(w.fresh(key, ['telegram'])).toEqual([]);
    expect(w.fresh(key, ['telegram', 'vk'])).toEqual(['vk']);
    expect(w.fresh('2026-11-08:evening:повтор', ['telegram'])).toEqual([
      'telegram',
    ]);
  });

  it('метки прошлых дней вычищаются', () => {
    const w = new UnknownOutcomeWarnings();
    w.fresh('2026-11-07:evening:повтор', ['telegram']);
    w.fresh('2026-11-08:morning:повтор', ['vk']);
    // Вчерашний ключ забыт: вернись он — сообщение снова уйдёт.
    expect(w.fresh('2026-11-07:evening:повтор', ['telegram'])).toEqual([
      'telegram',
    ]);
  });
});
