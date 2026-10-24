import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

// L4 (аудит 2026-08, правило №6): сырые @Body('email'/'token'/'initData')
// скаляры не валидировались в рантайме — {token:123} роняло createHash(123),
// {email:["a@b.c"]} роняло [].toLowerCase() → необработанный TypeError → 500
// вместо чистого 400. Мелкие class-DTO с @IsString дают контролируемый отказ;
// сама доменная проверка (валидность e-mail, подпись initData/токена) остаётся
// в сервисах — тут только гарантия ТИПА. whitelist:true срезает лишние поля.

export class EmailBodyDto {
  @IsString()
  @MaxLength(320)
  email!: string;

  // Билет входа: письмо часто открывают на ДРУГОМ устройстве, и сессия
  // доставалась бы тому браузеру, а исходный экран остался бы с надписью
  // «письмо отправлено». С билетом сессию заберёт тот, кто вход начал.
  @IsOptional()
  @IsString()
  @Length(8, 8)
  @Matches(/^[A-Za-z0-9]+$/)
  ticket?: string;
}

export class TokenBodyDto {
  @IsString()
  @MaxLength(512)
  token!: string;
}

export class InitDataBodyDto {
  @IsString()
  @MaxLength(4096)
  initData!: string;
}
