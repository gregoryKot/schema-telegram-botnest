// CORS приложения — часть общей обвязки configureApp (src/infra/configure-app.ts).
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Разрешённые origin: ALLOWED_ORIGINS (через запятую) или, без неё, в проде
 * только канонический хост, вне прода — dev-сервер Vite. Визитка
 * (kotlarewski.gr) ходит в API с собственного origin (VITE_API_URL пуст,
 * fetch относительный), CORS ей не нужен; credentials-CORS для алиаса —
 * лишняя поверхность (аудит 2026-10, I1; правило №19).
 */
export function corsOrigins(): string[] {
  const fromEnv = process.env.ALLOWED_ORIGINS?.split(',');
  if (fromEnv) return fromEnv;
  return process.env.NODE_ENV === 'production'
    ? ['https://schemehappens.ru']
    : ['http://localhost:5173'];
}

export function corsOptions(): CorsOptions {
  return {
    origin: corsOrigins(),
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'x-telegram-init-data',
      'Authorization',
      'x-requested-with',
      'x-totp-code', // step-up привязки/отвязки входа (src/auth/step-up.ts)
    ],
    credentials: true,
  };
}
