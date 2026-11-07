import { IsIn, IsOptional } from 'class-validator';

export class HandoffTicketDto {
  // Откуда просят передать сессию. Только для подписи и метрик — правами не
  // распоряжается (их даёт подпись сессии), поэтому значению клиента можно
  // доверять. По умолчанию 'telegram'.
  @IsOptional()
  @IsIn(['telegram', 'max'])
  hostId?: 'telegram' | 'max';
}
