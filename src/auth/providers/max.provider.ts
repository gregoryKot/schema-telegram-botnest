import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProviderHandler, ProviderIdentity } from './types';
import { verifyMaxInitData } from '../max-init-data';

// MAX mini-app initData verification. Spec: dev.max.ru/docs/webapps/validation.
// Свой токен бота (MAX_BOT_TOKEN) — не связан с Telegram BOT_TOKEN.
@Injectable()
export class MaxProvider implements AuthProviderHandler {
  readonly id = 'max';
  readonly displayName = 'MAX';

  constructor(private readonly config: ConfigService) {}

  verifyInitData(initData: string): ProviderIdentity {
    const botToken = this.config.get<string>('MAX_BOT_TOKEN')?.trim();
    if (!botToken)
      throw new UnauthorizedException('MAX_BOT_TOKEN not configured');
    // Ошибки verifyMaxInitData (включая 'init data expired ...') намеренно
    // не перехватываются здесь — их классифицирует rejectInitData на
    // вызывающей стороне (src/api/initdata-alert.ts).
    const { id, firstName } = verifyMaxInitData(initData, botToken);
    return { providerId: id, displayName: firstName };
  }
}
