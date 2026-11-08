import { Logger } from '@nestjs/common';
import { RobokassaService } from './robokassa.service';
import { BookingNotifyService } from './booking-notify.service';

// Разбор ResultURL Robokassa до подтверждения денег: формат InvId, подпись,
// тестовый платёж на боевом магазине. Вынесено из payment.controller.ts
// (правило №10). Ответ ручки — text/plain (@Header в контроллере), и ввод в
// него всё равно не отражается: InvId эхом — только число (аудит 2026-11,
// автосабмит чужой формы с InvId=<meta http-equiv=refresh …> показывал свою
// разметку с адреса schemehappens.ru).

/** InvId — целое до 10 цифр: брони, донаты (от 1e9) и подписки (от 2e9). */
const INVID_RE = /^\d{1,10}$/;

export interface ResultWebhookInput {
  outSum: string;
  invId: string;
  sig: string;
  /** `IsTest` уведомления: Robokassa шлёт '1' за тестовый платёж. */
  isTest?: string;
}

/** Либо готовый ответ Robokassa, либо проверенный InvId — подтверждать. */
export type ResultScreen = { reply: string } | { id: number };

export async function screenResultWebhook(
  deps: {
    robokassa: RobokassaService;
    notify: BookingNotifyService;
    logger: Logger;
  },
  input: ResultWebhookInput,
): Promise<ResultScreen> {
  const { robokassa, notify, logger } = deps;
  const { outSum, invId, sig, isTest } = input;
  // Не строка (InvId[]=…) или не число — дальше не разбираем и не эхаем.
  if (typeof invId !== 'string' || !INVID_RE.test(invId)) {
    logger.warn('Robokassa webhook: malformed InvId');
    return { reply: 'FAIL' };
  }
  logger.log(`Payment webhook InvId=${invId} OutSum=${outSum}`);
  if (!robokassa.validateWebhook(outSum, invId, sig)) {
    // Ручка публичная: неверная подпись — это сканеры и чужие формы. warn, не
    // error: error уходил владельцу DM через AlertLogger на каждый такой POST.
    // Текст стабильный — по нему ищется серия в логах.
    logger.warn('Robokassa webhook: invalid signature');
    return { reply: `FAIL${invId}` };
  }
  // IsTest не входит в подпись. Если тестовые пароли в кабинете совпадают с
  // боевыми, клиент правит IsTest=0→1 в ссылке оплаты и платит тестовой
  // картой — подпись сходится, денег нет. На боевом магазине такой платёж не
  // подтверждаем; OK — повтор уведомления ничего не изменит.
  if (isTest === '1' && !robokassa.isTest) {
    logger.warn(`Robokassa webhook: test payment on live shop, InvId ${invId}`);
    await notify.alertAdmin(
      `🚨 <b>Тестовый платёж Robokassa на боевом магазине (InvId ${invId}) — не подтверждён.</b>\nПроверьте, что тестовые пароли отличаются от боевых.`,
    );
    return { reply: `OK${invId}` };
  }
  return { id: Number(invId) };
}
