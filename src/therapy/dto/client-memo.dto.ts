import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CLIENT_MEMO_MAX } from '../../utils/text-limits';

/** Заметка «О клиенте»: null или пустая строка очищают её, undefined — не трогает. */
export class ClientMemoDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(CLIENT_MEMO_MAX)
  memo?: string | null;
}
