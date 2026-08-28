import { IsIn, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * Тела запросов билета входа — правило №6 CLAUDE.md: рантайм-валидация
 * декораторами, а не inline-интерфейсом.
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
  // Длинный секрет контейнера: 32 байта в hex.
  @IsString()
  @IsNotEmpty()
  @Length(64, 64)
  @Matches(/^[0-9a-f]+$/)
  deviceCode!: string;
}

export class StartTicketDto {
  // 'login' — вход в контейнер без сессии; 'link' — привязка к существующему
  // аккаунту (требует сессии, контроллер проверяет).
  @IsIn(['login', 'link'])
  intent!: 'login' | 'link';

  // Каким способом человек будет подтверждать. Влияет на текст и на то, какую
  // строку AuthProvider искать у источника при привязке.
  @IsIn(['telegram', 'max', 'google', 'vk', 'email'])
  provider!: string;

  // Где открыт контейнер. Только для подписи устройства и метрик — правами не
  // распоряжается, поэтому доверять значению клиента здесь безопасно.
  @IsOptional()
  @IsIn(['web', 'telegram', 'max'])
  hostId?: string;
}
