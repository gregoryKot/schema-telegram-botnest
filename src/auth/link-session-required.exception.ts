import { UnauthorizedException } from '@nestjs/common';

/** Машиночитаемая причина 401 — по ней страница-погашение ведёт на подсказку. */
export const EMAIL_LINK_SESSION_REASON = 'email_link_session';

// Ссылку привязки почты (`link_email_auth`) открыли в браузере, где нет
// сессии того аккаунта, для которого её запросили. Отдельный класс — чтобы
// страница-погашение отличала это от «ссылка истекла» и показывала честное
// сообщение (аудит 2026-10, A3). Токен при этом не сгорает.
export class LinkSessionRequiredException extends UnauthorizedException {
  constructor() {
    super({
      message:
        'Link-email token requires the session of the account it was issued for',
      reason: EMAIL_LINK_SESSION_REASON,
    });
  }
}
