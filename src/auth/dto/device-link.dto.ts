import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/**
 * Тело запросов привязки аккаунта (device authorization grant) — правило №6
 * CLAUDE.md: рантайм-валидация декораторами, а не inline-интерфейсом.
 */
export class UserCodeDto {
  // Короткий код человека: буквы и цифры из алфавита без похожих начертаний.
  // Длина фиксирована — всё прочее отсекается до похода в БД.
  @IsString()
  @IsNotEmpty()
  @Length(8, 8)
  @Matches(/^[A-Za-z0-9]+$/)
  code!: string;
}

export class DeviceCodeDto {
  // Длинный секрет мини-аппа: 32 байта в hex.
  @IsString()
  @IsNotEmpty()
  @Length(64, 64)
  @Matches(/^[0-9a-f]+$/)
  deviceCode!: string;
}

export class StartDeviceLinkDto {
  // Какой мессенджер просит привязку — влияет только на текст и на то, какую
  // строку AuthProvider искать у источника.
  @IsString()
  @Matches(/^(max|telegram)$/)
  provider!: string;
}
