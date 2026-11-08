import 'express';

// Глобальное расширение express.Request полями, которые ставят наши гварды
// (JwtAuthGuard/OptionalJwtGuard → webUser; TelegramAuthGuard →
// telegramFirstName/webUser). Без него контроллеры были вынуждены объявлять
// `@Req() req: any`, что тянуло каскад no-unsafe-* по всему auth/api-слою.
// Поля опциональны: на публичных эндпоинтах гвард их не выставляет.
declare global {
  namespace Express {
    interface Request {
      /** viaLinkToken — из куки link_token (OptionalJwtGuard), не из Bearer. */
      webUser?: { userId: bigint; viaLinkToken?: true };
      telegramFirstName?: string;
    }
  }
}

export {};
