import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

/**
 * Robokassa payment integration.
 *
 * Required env vars:
 *   ROBOKASSA_MERCHANT_LOGIN  — login from Robokassa merchant cabinet
 *   ROBOKASSA_PASSWORD1       — password 1 (for payment URL signing)
 *   ROBOKASSA_PASSWORD2       — password 2 (for webhook signature validation)
 *   ROBOKASSA_IS_TEST         — "true" to use test mode (default: false)
 */
@Injectable()
export class RobokassaService {
  private readonly logger = new Logger(RobokassaService.name);
  private readonly login: string;
  private readonly pass1: string;
  private readonly pass2: string;
  private readonly isTest: boolean;

  constructor(config: ConfigService) {
    this.login = config.get<string>('ROBOKASSA_MERCHANT_LOGIN') ?? '';
    this.pass1  = config.get<string>('ROBOKASSA_PASSWORD1') ?? '';
    this.pass2  = config.get<string>('ROBOKASSA_PASSWORD2') ?? '';
    this.isTest = config.get<string>('ROBOKASSA_IS_TEST') === 'true';
  }

  get enabled(): boolean {
    return Boolean(this.login && this.pass1 && this.pass2);
  }

  /**
   * Build a Robokassa payment URL.
   * @param invId   booking.id — used as Robokassa InvId (must be unique per merchant)
   * @param amount  amount in rubles (e.g. 3500)
   * @param desc    payment description shown to the client
   * @param email   client e-mail for the receipt (optional)
   * @param successUrl  where to redirect after success
   * @param failUrl     where to redirect after failure/cancel
   */
  buildPaymentUrl(params: {
    invId: number;
    amount: number;
    desc: string;
    email?: string;
    successUrl: string;
    failUrl: string;
  }): string {
    const { invId, amount, desc, email, successUrl, failUrl } = params;
    const outSum = amount.toFixed(2);
    const sig = md5(`${this.login}:${outSum}:${invId}:${this.pass1}`);

    const receipt = buildReceipt(desc, amount);
    const receiptEncoded = encodeURIComponent(Buffer.from(JSON.stringify(receipt)).toString('base64'));

    const base = 'https://auth.robokassa.ru/Merchant/Index.aspx';
    const qs = new URLSearchParams({
      MerchantLogin: this.login,
      OutSum: outSum,
      InvId: String(invId),
      Description: desc,
      SignatureValue: sig,
      Receipt: receiptEncoded,
      ...(email ? { Email: email } : {}),
      SuccessURL: successUrl,
      FailURL: failUrl,
      IsTest: this.isTest ? '1' : '0',
    });
    this.logger.debug(`Payment URL built for InvId=${invId}`);
    return `${base}?${qs}`;
  }

  /**
   * Validate Robokassa webhook (ResultURL) signature.
   * Expected formula: MD5(OutSum:InvId:Password2)
   */
  validateWebhook(outSum: string, invId: string, sigReceived: string): boolean {
    const expected = md5(`${outSum}:${invId}:${this.pass2}`);
    return expected.toLowerCase() === sigReceived.toLowerCase();
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function md5(input: string): string {
  return createHash('md5').update(input, 'utf8').digest('hex');
}

/** Receipt object per Robokassa fiscalization spec. SNO 'patent' covers НПД/самозанятый. */
function buildReceipt(name: string, amount: number) {
  return {
    sno: 'patent',
    items: [{
      name: name.slice(0, 128),
      quantity: 1,
      sum: parseFloat(amount.toFixed(2)),
      tax: 'none',
      payment_method: 'full_payment',
      payment_object: 'service',
    }],
  };
}
