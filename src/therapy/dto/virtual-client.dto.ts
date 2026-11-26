import { IsString, MaxLength } from 'class-validator';
import { CLIENT_NAME_MAX } from '../../utils/text-limits';

/**
 * Имя офлайн-клиента (POST /api/therapy/clients/virtual): предел тот же, что у
 * переименования (`RenameClientDto.alias`) — это одна сущность. Раньше было
 * только `@IsString()`, и строка до 256 КБ ложилась в `virtualClientName` и
 * приезжала в каждый ответ `GET /clients`. Вынесено из connection.dto.ts
 * (правило №10 — файл-храповик).
 */
export class VirtualClientDto {
  @IsString()
  @MaxLength(CLIENT_NAME_MAX)
  name!: string;
}
