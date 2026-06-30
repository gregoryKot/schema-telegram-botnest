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
  private readonly isTest: boolean;
  private readonly fiscal: boolean;

  constructor(config: ConfigService) {
    this.login = config.get<string>('ROBOKASSA_MERCHANT_LOGIN') ?? '';
    this.pass1  = config.get<string>('ROBOKASSA_PASSWORD1') ?? '';
    this.pass2  = config.get<string>('ROBOKASSA_PASSWORD2') ?? '';
    this.isTest = config.get<string>('ROBOKASSA_IS_TEST') === 'true';
    this.fiscal = config.get<string>('ROBOKASSA_FISCAL') !== 'false'; // default ON
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
    /** First payment of a recurring series — tokenises the card for later MIT charges. */
    recurring?: boolean;
  }): string {
    const { invId, amount, desc, email, successUrl, failUrl, recurring } = params;
    const outSum = amount.toFixed(2);

    // Optional ОФД fiscalization. Per Robokassa docs, when a Receipt is sent it
    // MUST be part of the signature between InvId and Password1:
    //   MD5(MerchantLogin:OutSum:InvId:Receipt:Password1)
    // The Receipt here is the URL-encoded minified JSON (NOT base64), and the
    // SAME url-encoded string is used both in the signature and as the Receipt
    // value. URLSearchParams then encodes it once more for the wire; Robokassa
    // decodes once → gets back this url-encoded string → signature matches, then
    // decodes again to parse the JSON. Mismatching these two is exactly error 29.
    let receiptParam: string | null = null;
    let sig: string;
    if (this.fiscal) {
      receiptParam = encodeURIComponent(JSON.stringify(buildReceipt(desc, amount)));
      sig = md5(`${this.login}:${outSum}:${invId}:${receiptParam}:${this.pass1}`);
    } else {
      sig = md5(`${this.login}:${outSum}:${invId}:${this.pass1}`);
    }

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
    this.logger.debug(`Payment URL built for InvId=${invId} (fiscal=${this.fiscal})`);
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

  /**
   * Validate the SuccessURL redirect signature (browser returns from Robokassa).
   * Expected formula: MD5(OutSum:InvId:Password1). Lets us trust the InvId before
   * handing the client their booking link.
   */
  validateSuccess(outSum: string, invId: string, sigReceived: string): boolean {
    if (!outSum || !invId || !sigReceived) return false;
    const expected = md5(`${outSum}:${invId}:${this.pass1}`);
    return expected.toLowerCase() === sigReceived.toLowerCase();
  }

  /**
   * Charge a recurring (MIT) payment server-to-server, reusing the card the
   * client tokenised on the first payment. The actual confirmation arrives on
   * the usual ResultURL webhook. Requires the recurring service to be enabled
   * for the shop by Robokassa support (otherwise error 34).
   *   SignatureValue = MD5(MerchantLogin:OutSum:InvId:Password1)
   *   PreviousInvoiceID is sent but NOT part of the signature.
   * Returns { ok, body } — ok=true when Robokassa accepted the charge request.
   */
  async chargeRecurring(params: { invId: number; previousInvId: number; amount: number; desc: string }): Promise<{ ok: boolean; body: string }> {
    const { invId, previousInvId, amount, desc } = params;
    const outSum = amount.toFixed(2);
    const sig = md5(`${this.login}:${outSum}:${invId}:${this.pass1}`);
    const form = new URLSearchParams({
      MerchantLogin: this.login,
      InvoiceID: String(invId),
      PreviousInvoiceID: String(previousInvId),
      OutSum: outSum,
      Description: desc,
      SignatureValue: sig,
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
      if (!ok) this.logger.error(`Recurring charge InvId=${invId} failed: ${res.status} ${body.slice(0, 200)}`);
      return { ok, body };
    } catch (e) {
      this.logger.error(`Recurring charge InvId=${invId} error: ${(e as Error).message}`);
      return { ok: false, body: (e as Error).message };
    }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function md5(input: string): string {
  return createHash('md5').update(input, 'utf8').digest('hex');
}

/**
 * Receipt for Robokassa fiscalization. For self-employed (НПД / Робочеки СМЗ)
 * the `sno` field is intentionally omitted — it's only needed to distinguish
 * tax systems, and there is no НПД value (the old 'patent' was simply wrong and
 * could make Robokassa reject the cheque). Robokassa registers the income in
 * «Мой налог» automatically from these items.
 */
function buildReceipt(name: string, amount: number) {
  return {
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
