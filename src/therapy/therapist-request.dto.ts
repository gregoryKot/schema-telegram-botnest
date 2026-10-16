import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import * as L from '../utils/text-limits';

/**
 * Заявка на роль терапевта (аудит 2026-07, 2г): текст уходит в DM админу, валидация обязательна (правило №6). Пределы длины — только в `utils/text-limits.ts`: сервис длину не проверяет.
 */
export class SubmitTherapistRequestDto {
  @IsString()
  @Length(2, L.THERAPIST_REQUEST_NAME_MAX)
  fullName!: string;

  @IsString()
  @Length(2, L.THERAPIST_REQUEST_QUAL_MAX)
  qualification!: string;

  @IsString()
  @Length(2, L.THERAPIST_REQUEST_CONTACTS_MAX)
  contacts!: string;

  @IsOptional()
  @IsString()
  @MaxLength(L.THERAPIST_REQUEST_MESSAGE_MAX)
  message?: string;
}
