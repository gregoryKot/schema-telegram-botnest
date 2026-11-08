// Тела ручек уведомлений в приложении (правило №6: рантайм-валидация,
// строка — с верхней границей). Формат адреса и ключей дальше проверяет
// сервис: список push-сервисов (push-endpoint.ts) и длины ключей (push-keys.ts).
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  PUSH_UNSUBSCRIBE_REASONS,
  type PushUnsubscribeReason,
} from '../analytics/push-events.constants';

export const PUSH_ENDPOINT_MAX = 2048;

export class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  auth!: string;
}

/** POST /api/push/subscription — PushSubscription.toJSON() браузера. */
export class PushSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PUSH_ENDPOINT_MAX)
  endpoint!: string;

  // Без IsDefined отсутствующий keys проходил ValidateNested молча и ронял
  // ручку 500 (поймано push-ownership.e2e-spec.ts).
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

/** POST /api/push/unsubscribe. */
export class PushUnsubscribeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PUSH_ENDPOINT_MAX)
  endpoint!: string;

  @IsOptional()
  @IsIn(PUSH_UNSUBSCRIBE_REASONS)
  reason?: PushUnsubscribeReason;
}
