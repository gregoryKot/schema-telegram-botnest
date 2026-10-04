import { SessionType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Тело POST /api/booking/book — первый DTO с рантайм-валидацией
 * (аудит 2026-07, 2г / правило №6 CLAUDE.md). Публичный анонимный
 * эндпоинт с деньгами — приоритетный кандидат: до этого тело
 * проверялось только compile-time интерфейсом.
 */
export class BookDto {
  @IsISO8601()
  startsAt!: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(180)
  durationMin?: number;

  @IsOptional()
  @IsEnum(SessionType)
  type?: SessionType;

  @IsString()
  @Length(2, 100)
  clientName!: string;

  @IsString()
  @Length(3, 200)
  clientContact!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  // Атрибуция лида: страница + referrer (собирает фронт, leadSource()).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  @IsOptional()
  @IsBoolean()
  returning?: boolean;

  // Часовой пояс посетителя (IANA, напр. "Asia/Bangkok") — из Intl на фронте.
  // Валидность проверяется сервисом через Intl; невалидное значение
  // игнорируется, а не отклоняет запрос (правило №14: чужой ввод не должен
  // ронять заявку с деньгами из-за странного значения пояса).
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientTimeZone?: string;

  @IsBoolean()
  acceptedOffer!: boolean;

  // Honeypot: людям поле не показывается; боты его заполняют.
  @IsOptional()
  @IsString()
  website?: string;
}
