import { UnauthorizedException } from '@nestjs/common';

// Ссылку привязки почты открыли в браузере без сессии нужного аккаунта (A3).
// reason — чтобы страница-погашение отличала это от «ссылка истекла».
export class LinkSessionRequiredException extends UnauthorizedException {
  constructor() {
    super({
      message: 'Link-email token requires the session of its account',
      reason: 'email_link_session',
    });
  }
}
