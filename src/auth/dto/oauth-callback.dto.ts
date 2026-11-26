import { IsOptional, IsString, MaxLength } from 'class-validator';

// Адрес возврата с OAuth-площадки (GET /api/auth/yandex/callback), правило №6.
// Все параметры необязательные: чего не хватает, решает общий хвост колбэка
// (oauth-callback.service.ts) — он ведёт на экран ошибки входа, а не отвечает
// 400. Незнакомые параметры срезает whitelist глобального ValidationPipe
// (forbidNonWhitelisted не включён): новый параметр площадки вход не ломает.
// Повтор параметра (`?code=a&code=b`) или строка длиннее границы — 400 от
// ValidationPipe, без экрана ошибки: площадка так не отвечает, это ручной запрос.
// Границы — с запасом к записанному 2026-11-12 (yandex-id-oauth.json): code —
// 16 символов, cid — 26, state Яндекс принимает до 1024.
export class OAuthCallbackQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  code?: string;

  /** Подписанный state (JWT) — тот же, что в куке oauth_state. */
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  state?: string;

  /** Код отказа площадки; в лог идёт только через oauthErrorCode. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  error?: string;

  /** Текст отказа: принимаем, но не читаем и не логируем — его шлёт браузер. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  error_description?: string;

  /** Служебный параметр Яндекса: принимаем, не читаем. */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  cid?: string;
}
