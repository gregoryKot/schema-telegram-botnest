import 'express';

// Глобальное расширение express.Request полями, которые ставят наши гварды
// (JwtAuthGuard/OptionalJwtGuard → webUser; TelegramAuthGuard → telegramUserId/
// telegramFirstName/webUser). Без него контроллеры были вынуждены объявлять
// `@Req() req: any`, что тянуло каскад no-unsafe-* по всему auth/api-слою.
// Поля опциональны: на публичных эндпоинтах гвард их не выставляет.
declare global {
  namespace Express {
    interface Request {
      webUser?: { userId: bigint };
      telegramUserId?: number;
      telegramFirstName?: string;
    }
  }
}

export {};
