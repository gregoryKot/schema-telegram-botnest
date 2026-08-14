import { IsString, MaxLength } from 'class-validator';

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
