import { Injectable } from '@nestjs/common';
import { AuthProviderHandler } from './types';

// Telegram в реестре — только имя способа входа: строку AuthProvider создаёт
// вход по подписи initData внутри Telegram (src/auth/telegram-init-data.ts),
// отвязка идёт через реестр. Входа через Telegram на сайте нет с 2026-11
// (запрос Роскомнадзора, п. 4 ч. 10 ст. 8 149-ФЗ): Login Widget, редирект на
// oauth.telegram.org и проверка их подписи удалены — возвращать нельзя.
@Injectable()
export class TelegramProvider implements AuthProviderHandler {
  readonly id = 'telegram';
  readonly displayName = 'Telegram';
}
