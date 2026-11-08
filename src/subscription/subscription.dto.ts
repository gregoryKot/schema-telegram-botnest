import {
  IsEmail,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// L4 (аудит 2026-08, правило №6): было inline-interface. Денежного риска от тела
// нет (цену берёт сервер), но нестроковый email ловил TypeError на .trim() → 500
// вместо 400, а мусорный period молча становился месячной подпиской. Класс-DTO
// делает форму явной: мусор → чистый 400.
//
// ВАЖНО: honeypot `website` при whitelist:true обязан иметь декоратор, иначе
// срезается и ловушка ботов не работает.
export class SubscribeDto {
  @IsOptional()
  @IsIn(['month', 'year'])
  period?: 'month' | 'year';

  // R9 (аудит 2026-11): адрес уходит в Robokassa для чека — только e-mail,
  // 254 — предел длины адреса (RFC 5321).
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsBoolean()
  acceptedOffer?: boolean;

  // Honeypot — must stay empty (see whitelist note above).
  @IsOptional()
  @IsString()
  website?: string;
}
