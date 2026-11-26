// screenResultWebhook — разбор ResultURL Robokassa до подтверждения денег.
// Аудит 2026-11, S21: ручка принимает form-urlencoded, и `SignatureValue[]=x`
// приходит массивом. Сверка подписи звала `.toLowerCase()` у массива и роняла
// ручку с 500 вместо ответа «FAIL». Не строка — та же неверная подпись.
import { createHash } from 'crypto';
import type { Logger } from '@nestjs/common';
import { RobokassaService } from './robokassa.service';
import type { BookingNotifyService } from './booking-notify.service';
import { screenResultWebhook } from './payment.result-guard';

const PASS2 = 'pass2_secret';
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');

function setup() {
  const env: Record<string, string> = {
    ROBOKASSA_MERCHANT_LOGIN: 'shop',
    ROBOKASSA_PASSWORD1: 'pass1_secret',
    ROBOKASSA_PASSWORD2: PASS2,
    ROBOKASSA_IS_TEST: 'true',
  };
  const robokassa = new RobokassaService({
    get: (k: string) => env[k],
  } as unknown as ConstructorParameters<typeof RobokassaService>[0]);
  const notify = { alertAdmin: jest.fn() };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const deps = {
    robokassa,
    notify: notify as unknown as BookingNotifyService,
    logger: logger as unknown as Logger,
  };
  return { deps, logger };
}

describe('screenResultWebhook — подпись и сумма не строкой', () => {
  const outSum = '4000.00';
  const good = md5(`${outSum}:7:${PASS2}`);

  it('контроль: верная подпись строкой проходит дальше (id)', async () => {
    const { deps } = setup();
    await expect(
      screenResultWebhook(deps, { outSum, invId: '7', sig: good }),
    ).resolves.toEqual({ id: 7 });
  });

  it('SignatureValue[]=<верная подпись> → FAIL7 и warn, не 500', async () => {
    const { deps, logger } = setup();
    const sig = [good] as unknown as string;
    await expect(
      screenResultWebhook(deps, { outSum, invId: '7', sig }),
    ).resolves.toEqual({ reply: 'FAIL7' });
    expect(logger.warn).toHaveBeenCalledWith(
      'Robokassa webhook: invalid signature',
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('OutSum[]=4000.00 → FAIL7: массив не склеивается в «правильную» сумму', async () => {
    const { deps, logger } = setup();
    const arr = [outSum] as unknown as string;
    await expect(
      screenResultWebhook(deps, { outSum: arr, invId: '7', sig: good }),
    ).resolves.toEqual({ reply: 'FAIL7' });
    expect(logger.warn).toHaveBeenCalledWith(
      'Robokassa webhook: invalid signature',
    );
  });

  it('подпись отсутствует (undefined) → FAIL7, не 500', async () => {
    const { deps } = setup();
    const sig = undefined as unknown as string;
    await expect(
      screenResultWebhook(deps, { outSum, invId: '7', sig }),
    ).resolves.toEqual({ reply: 'FAIL7' });
  });
});
