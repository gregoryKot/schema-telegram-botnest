import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { payableAmount } from './price-rules';
import {
  md5,
  safeEqualHex,
  signPayment,
  type ShopCreds,
} from './robokassa-sign';

/**
 * Robokassa payment integration.
 *
 * Required env vars:
 *   ROBOKASSA_MERCHANT_LOGIN  — login from Robokassa merchant cabinet
 *   ROBOKASSA_PASSWORD1       — password 1 (for payment URL signing)
 *   ROBOKASSA_PASSWORD2       — password 2 (for webhook signature validation)
 *   ROBOKASSA_IS_TEST         — "true" to use test mode (default: false)
 *   ROBOKASSA_FISCAL          — "false" to NOT send a Receipt (default: true).
 *                               Robokassa's "Робочеки СМЗ" auto-registers the
 *                               income in «Мой налог» (ФНС) for self-employed —
 *                               for that it REQUIRES the Receipt, and the Receipt
 *                               is part of the payment signature. Only turn this
 *                               off if the shop has no fiscalization at all.
 */
@Injectable()
export class RobokassaService {
  private readonly logger = new Logger(RobokassaService.name);
  private readonly login: string;
  private readonly pass1: string;
  private readonly pass2: string;
  readonly isTest: boolean;
  private readonly fiscal: boolean;

  constructor(config: ConfigService) {
    this.login = (config.get<string>('ROBOKASSA_MERCHANT_LOGIN') ?? '').trim();
    this.pass1 = (config.get<string>('ROBOKASSA_PASSWORD1') ?? '').trim();
    this.pass2 = (config.get<string>('ROBOKASSA_PASSWORD2') ?? '').trim();
    this.isTest = config.get<string>('ROBOKASSA_IS_TEST') === 'true';
    this.fiscal = config.get<string>('ROBOKASSA_FISCAL') !== 'false'; // default ON
  }

  private get creds(): ShopCreds {
    return { login: this.login, pass1: this.pass1, fiscal: this.fiscal };
  }

  get enabled(): boolean {
    return Boolean(this.login && this.pass1 && this.pass2);
  }

  /**
   * Build a Robokassa payment URL.
   * @param invId   booking.id — used as Robokassa InvId (must be unique per merchant)
   * @param amount  amount in rubles (e.g. 3500); must be > 0, otherwise throws
   * @param desc    payment description shown to the client
   * @param email   client e-mail for the receipt (optional)
   * @param successUrl, failUrl  where to redirect after success / failure
   */
  buildPaymentUrl(params: {
    invId: number;
    amount: number;
    desc: string;
    email?: string;
    successUrl: string;
    failUrl: string;
    /** First payment of a recurring series — tokenises the card for later MIT charges. */
    recurring?: boolean;
  }): string {
    const { invId, amount, desc, email, successUrl, failUrl, recurring } =
      params;
    const outSum = payableAmount(amount).toFixed(2);

    const { sig, receiptParam } = signPayment(this.creds, {
      outSum,
      invId,
      desc,
      amount,
    });

    const base = 'https://auth.robokassa.ru/Merchant/Index.aspx';
    const qs = new URLSearchParams({
      MerchantLogin: this.login,
      OutSum: outSum,
      InvId: String(invId),
      Description: desc,
      SignatureValue: sig,
      ...(receiptParam ? { Receipt: receiptParam } : {}),
      ...(email ? { Email: email } : {}),
      // Recurring is NOT a signature modifier — plain optional param.
      ...(recurring ? { Recurring: 'true' } : {}),
      SuccessURL: successUrl,
      FailURL: failUrl,
      IsTest: this.isTest ? '1' : '0',
    });
    this.logger.debug(
      `Payment URL built for InvId=${invId} (fiscal=${this.fiscal})`,
    );
    return `${base}?${qs}`;
  }

  /**
   * Validate Robokassa webhook (ResultURL) signature.
   * Expected formula: MD5(OutSum:InvId:Password2)
   */
  validateWebhook(outSum: string, invId: string, sigReceived: string): boolean {
    // M3 (аудит 2026-10): без Password2 подпись считалась бы от пустой строки —
    // `md5(OutSum:InvId:)` любой желающий посчитает сам и подделает «оплачено».
    if (!this.pass2) return false;
    const expected = md5(`${outSum}:${invId}:${this.pass2}`);
    return safeEqualHex(expected, sigReceived);
  }

  /**
   * Validate the SuccessURL redirect signature (browser returns from Robokassa).
   * Expected formula: MD5(OutSum:InvId:Password1). Lets us trust the InvId before
   * handing the client their booking link.
   */
  validateSuccess(outSum: string, invId: string, sigReceived: string): boolean {
    if (!outSum || !invId || !sigReceived) return false;
    // M3: пустой Password1 — та же подделка подписи, что и с Password2.
    if (!this.pass1) return false;
    const expected = md5(`${outSum}:${invId}:${this.pass1}`);
    return safeEqualHex(expected, sigReceived);
  }

  /**
   * Charge a recurring (MIT) payment server-to-server, reusing the card the
   * client tokenised on the first payment. The actual confirmation arrives on
   * the usual ResultURL webhook. Requires the recurring service to be enabled
   * for the shop by Robokassa support (otherwise error 34).
   *   SignatureValue = MD5(MerchantLogin:OutSum:InvId[:Receipt]:Password1)
   *   PreviousInvoiceID is sent but NOT part of the signature.
   * Returns { ok, body } — ok=true when Robokassa ACCEPTED the request: это не
   * списание, деньги подтверждает только вебхук (subscription.charge-guards.ts).
   */
  async chargeRecurring(params: {
    invId: number;
    previousInvId: number;
    amount: number;
    desc: string;
  }): Promise<{ ok: boolean; body: string }> {
    const { invId, previousInvId, amount, desc } = params;
    const outSum = amount.toFixed(2);
    const { sig, receiptParam } = signPayment(this.creds, {
      outSum,
      invId,
      desc,
      amount,
    });
    const form = new URLSearchParams({
      MerchantLogin: this.login,
      InvoiceID: String(invId),
      PreviousInvoiceID: String(previousInvId),
      OutSum: outSum,
      Description: desc,
      SignatureValue: sig,
      ...(receiptParam ? { Receipt: receiptParam } : {}),
    });
    try {
      const res = await fetch('https://auth.robokassa.ru/Merchant/Recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.text().catch(() => '')).trim();
      // Robokassa replies "OK<InvId>" on success, otherwise an error code/text.
      const ok = res.ok && /^OK/i.test(body);
      if (!ok)
        this.logger.error(
          `Recurring charge InvId=${invId} failed: ${res.status} ${body.slice(0, 200)}`,
        );
      return { ok, body };
    } catch (e) {
      this.logger.error(
        `Recurring charge InvId=${invId} error: ${(e as Error).message}`,
      );
      return { ok: false, body: (e as Error).message };
    }
  }
}
