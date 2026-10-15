import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CONTACT_CHANNELS } from '../../booking/contact-channel';
import * as L from '../../utils/text-limits';

// POST /api/booking — публичный (правило №6). Поля @IsOptional НАМЕРЕННО:
// пустое имя/контакт → молчаливый {ok:true}, обязательность проверяет фронт.
// Пределы L.* = `maxLength` полей формы; контроллер их не режет (backend#29).
export class BookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(L.BOOKING_NAME_MAX)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(L.BOOKING_CONTACT_MAX)
  contact?: string;

  @IsOptional()
  @IsIn(CONTACT_CHANNELS)
  channel?: (typeof CONTACT_CHANNELS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(L.BOOKING_MESSAGE_MAX)
  message?: string;

  // Откуда заявка (страница + referrer): в уведомление и в IntroLead.source (открыто, не PII).
  @IsOptional()
  @IsString()
  @MaxLength(L.BOOKING_SOURCE_MAX)
  source?: string;
}
