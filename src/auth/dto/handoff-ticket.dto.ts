import { IsIn, IsOptional } from 'class-validator';

export class HandoffTicketDto {
  // Откуда просят передать сессию. Только MAX: из Telegram сессию в браузер
  // не передаём (вход на сайт через Telegram убран, site-login.ts). Значение
  // прислал клиент — сервер сверяет его со способами входа аккаунта.
  @IsOptional()
  @IsIn(['max'])
  hostId?: 'max';
}
