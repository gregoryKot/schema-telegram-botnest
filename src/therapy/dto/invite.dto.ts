import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CLIENT_NAME_MAX } from '../../utils/text-limits';

/**
 * Тело POST /api/therapy/invite. `alias` — имя клиента из «Новый клиент» в
 * кабинете: ложится в приглашение, и после подключения карточка называется
 * так (инцидент 2026-10-26: раньше рядом создавалась вторая, офлайн-карточка).
 * Предел — тот же, что у имени офлайн-клиента и переименования: одна сущность.
 */
export class CreateInviteDto {
  @IsOptional()
  @IsString()
  @MaxLength(CLIENT_NAME_MAX)
  alias?: string;
}
