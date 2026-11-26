import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// L4 (аудит 2026-08, правило №6): было inline-interface — форма тела не
// проверялась в рантайме. Публичный эндпоинт без auth: нестроковые email/comment
// ловили TypeError на .trim() → 500 вместо чистого 400; source не сверялся с
// союзом. Сумма и так защищена (donation.service: Math.round(Number(...)) +
// кламп MIN..MAX), поэтому здесь @IsNumber достаточно.
//
// ВАЖНО: при whitelist:true ValidationPipe срезает поля без декоратора —
// поэтому honeypot `website` ОБЯЗАН иметь декоратор, иначе он всегда undefined
// и ловушка ботов молча перестаёт работать.
export class DonateDto {
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsIn(['app', 'game'])
  source?: 'app' | 'game';

  // R9 (аудит 2026-11): адрес уходит в Robokassa для чека — только e-mail,
  // 254 — предел длины адреса (RFC 5321).
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  // Honeypot — людям не показывается; боты заполняют. Должен быть здесь с
  // декоратором (см. коммент выше про whitelist).
  @IsOptional()
  @IsString()
  website?: string;
}
