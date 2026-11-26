import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CURRENCIES, type Currency } from './price-region';

/**
 * Тело POST /api/client-booking/book (запись клиента из приложения, #546;
 * правило №6). Имени, контакта и оферты здесь нет намеренно: имя и контакт
 * сервер берёт из аккаунта, оферта принимается действием на экране. Лишние
 * поля (clientTelegramId, userId) режет ValidationPipe({ whitelist: true }).
 */
export class ClientBookDto {
  @IsISO8601()
  startsAt!: string;

  // Длина слота из GET /api/booking/slots — те же пределы, что у BookDto.
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(180)
  durationMin?: number;

  // Часовой пояс посетителя (IANA) — по нему валюта цены, как у /book.
  // Невалидное значение сервис игнорирует, а не отклоняет (booking-data.ts).
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientTimeZone?: string;

  // Явный выбор валюты (Р5), как у BookDto: действует только при поясе без места.
  @IsOptional()
  @IsIn(CURRENCIES)
  currency?: Currency;
}
