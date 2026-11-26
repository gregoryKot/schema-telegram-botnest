import { createHash, timingSafeEqual } from 'crypto';

// Подписи и чек Robokassa — чистые функции, вынесены из robokassa.service.ts
// (правило №10), когда продление подписки получило чек (аудит 2026-11, R8).

export function md5(input: string): string {
  return createHash('md5').update(input, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of two hex signatures (case-insensitive). Подпись
 * из запроса — не обязательно строка: `SignatureValue=a&SignatureValue=b` в
 * query даёт массив, `.toLowerCase` ронял ручку 500 (аудит 2026-11, R9).
 */
export function safeEqualHex(a: string, b: unknown): boolean {
  if (typeof b !== 'string') return false;
  const x = Buffer.from((a ?? '').toLowerCase(), 'utf8');
  const y = Buffer.from(b.toLowerCase(), 'utf8');
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/**
 * Receipt for Robokassa fiscalization. For self-employed (НПД / Робочеки СМЗ)
 * the `sno` field is intentionally omitted — it's only needed to distinguish
 * tax systems, and there is no НПД value (the old 'patent' was simply wrong and
 * could make Robokassa reject the cheque). Robokassa registers the income in
 * «Мой налог» automatically from these items.
 */
export function buildReceipt(name: string, amount: number) {
  return {
    items: [
      {
        name: name.slice(0, 128),
        quantity: 1,
        sum: parseFloat(amount.toFixed(2)),
        tax: 'none',
        payment_method: 'full_payment',
        payment_object: 'service',
      },
    ],
  };
}

export interface ShopCreds {
  login: string;
  pass1: string;
  /** Слать чек (ROBOKASSA_FISCAL, по умолчанию да). */
  fiscal: boolean;
}

/**
 * Подпись платежа Паролем 1 и чек. Optional ОФД fiscalization: per Robokassa
 * docs, when a Receipt is sent it MUST be part of the signature between InvId
 * and Password1:
 *   MD5(MerchantLogin:OutSum:InvId:Receipt:Password1)
 * The Receipt here is the URL-encoded minified JSON (NOT base64), and the
 * SAME url-encoded string is used both in the signature and as the Receipt
 * value. URLSearchParams then encodes it once more for the wire (URL первого
 * платежа и форма продления — одинаково); Robokassa decodes once → gets back
 * this url-encoded string → signature matches, then decodes again to parse the
 * JSON. Mismatching these two is exactly error 29. Одна сборка на первый
 * платёж и на продление: продление уходило без чека (аудит 2026-11, R8).
 */
export function signPayment(
  creds: ShopCreds,
  p: { outSum: string; invId: number; desc: string; amount: number },
): { sig: string; receiptParam: string | null } {
  const head = `${creds.login}:${p.outSum}:${p.invId}`;
  if (!creds.fiscal) {
    return { sig: md5(`${head}:${creds.pass1}`), receiptParam: null };
  }
  const receiptParam = encodeURIComponent(
    JSON.stringify(buildReceipt(p.desc, p.amount)),
  );
  return { sig: md5(`${head}:${receiptParam}:${creds.pass1}`), receiptParam };
}
