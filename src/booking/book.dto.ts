import { SessionType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import * as L from '../utils/text-limits';
import { CONTACT_CHANNELS, type ContactChannel } from './contact-channel';

/** Тело POST /api/booking/book — публичный эндпоинт с деньгами, рантайм-валидация (аудит 2026-07, правило №6). */
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
  @IsIn(CONTACT_CHANNELS)
  clientChannel?: ContactChannel;

  @IsOptional()
  @IsString()
  @MaxLength(L.BOOKING_SLOT_MESSAGE_MAX)
  message?: string;

  // Атрибуция лида: страница + referrer (собирает фронт, leadSource()).
  @IsOptional()
  @IsString()
  @MaxLength(L.BOOKING_SOURCE_MAX)
  source?: string;

  @IsOptional()
  @IsBoolean()
  returning?: boolean;

  // Часовой пояс посетителя (IANA, напр. "Asia/Bangkok") — из Intl на фронте.
  // Невалидное значение сервис игнорирует, а не отклоняет запрос (правило №14).
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
