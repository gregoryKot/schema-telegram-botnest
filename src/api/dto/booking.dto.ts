import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO для POST /api/booking — публичный, без аутентификации (правило №6).
 * Все поля @IsOptional НАМЕРЕННО: контроллер сохраняет поведение «пустое
 * имя/контакт → молчаливый {ok:true}», реальная проверка обязательности —
 * на фронте. DTO закрывает другое: не-строка (число/объект/массив) раньше
 * роняла обработчик необработанным TypeError на `.trim()` — теперь чистый
 * 400 от ValidationPipe. Лимиты длины щедрые, контроллер сам режет строки
 * до 100/500/200 символов при формировании уведомлений.
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
  @IsString()
  @MaxLength(5000)
  message?: string;

  // Откуда пришла заявка: страница + referrer, собирает фронт. Только для
  // уведомления админу (атрибуция лидов), в БД не пишется.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  source?: string;
}
