import { UnauthorizedException } from '@nestjs/common';

// Ссылку привязки почты (`link_email_auth`) открыли в браузере, где нет
// сессии того аккаунта, для которого её запросили. Отдельный класс — чтобы
// колбэк отличал это от «ссылка истекла» и мог (а) один раз перезайти на
// свой же адрес, если куку не отдали из-за перехода с чужого сайта, и
// (б) показать честное сообщение (аудит 2026-10, A3).
export class LinkSessionRequiredException extends UnauthorizedException {
  constructor() {
    super(
      'Link-email token requires the session of the account it was issued for',
    );
  }
}
