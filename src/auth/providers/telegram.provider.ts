import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AuthProviderHandler, ProviderIdentity } from './types';

@Injectable()
export class TelegramProvider implements AuthProviderHandler {
  readonly id = 'telegram';
  readonly displayName = 'Telegram';

  constructor(private readonly config: ConfigService) {}

  // Telegram Login Widget — signed form-data from Telegram (no redirect step).
  // Spec: https://core.telegram.org/widgets/login#checking-authorization
  verifyClientData(data: Record<string, unknown>): ProviderIdentity {
    const botToken = this.config.getOrThrow<string>('BOT_TOKEN').trim();
    // Telegram Login Widget sends `id` and `auth_date` as NUMBERS in the
    // JSON payload. Coerce everything non-null to string for the check-string
    // — Telegram's HMAC is computed over string values.
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(data) as [
      string,
      string | number | boolean,
    ][]) {
      if (v == null) continue;
      fields[k] = String(v);
    }

    const hash = fields['hash'];
    if (!hash) throw new UnauthorizedException('Missing hash');
    // Must be 64 hex chars — otherwise Buffer.from(hash,'hex') yields a
    // wrong-length buffer and timingSafeEqual throws RangeError → 500.
    if (!/^[0-9a-f]{64}$/i.test(hash))
      throw new UnauthorizedException('Malformed hash');
    delete fields['hash'];

    const authDate = parseInt(fields['auth_date'] ?? '0', 10);
    if (Date.now() / 1000 - authDate > 86400)
      throw new UnauthorizedException('Telegram auth data expired');

    // Login Widget: secret_key = SHA256(bot_token).
    const checkString = Object.keys(fields)
      .sort()
      .map((k) => `${k}=${fields[k]}`)
      .join('\n');
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    if (
      !crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(expectedHash, 'hex'),
      )
    ) {
      throw new UnauthorizedException('Invalid Telegram signature');
    }

    const id = parseInt(fields['id'] ?? '', 10);
    if (!id) throw new UnauthorizedException('Missing Telegram user id');
    return { providerId: String(id), displayName: fields['first_name'] };
  }
}
