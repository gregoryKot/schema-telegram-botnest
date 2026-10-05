import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CONTACT_CHANNELS } from '../../booking/contact-channel';

/**
 * POST /api/booking — публичный (правило №6). Поля @IsOptional НАМЕРЕННО:
 * пустое имя/контакт → молчаливый {ok:true}, обязательность проверяет фронт.
 */
export class BookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  contact?: string;

  @IsOptional()
  @IsIn(CONTACT_CHANNELS)
  channel?: (typeof CONTACT_CHANNELS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;

  // Откуда заявка (страница + referrer): только в уведомление, в БД не пишется.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  source?: string;
}
