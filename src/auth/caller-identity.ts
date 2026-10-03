import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { REFRESH_COOKIE, getCookie } from './auth-http.util';
import { hashToken } from './email.util';

// Кто на самом деле стоит за запросом (аудит 2026-10, A2/A3).
//
// Подписанный токен в теле — это «согласие на действие», а не «я — владелец
// аккаунта»: merge-токен выдаётся на OAuth-колбэке, ссылка из письма уходит
// на адрес, который вводил кто угодно. Поэтому деструктивные подтверждения
// (объединение аккаунтов, привязка почты) требуют ДОКАЗАТЕЛЬСТВА, что
// вызывающий — именно тот пользователь, чьим аккаунтом действие распоряжается.
//
// Доказательство — одно из двух: проверенный access-JWT (его уже разобрал
// OptionalJwtGuard и положил в req.webUser) либо живая refresh-кука. Вторая
// нужна потому, что после OAuth-редиректа access-токен лежал в памяти страницы,
// которой больше нет, а httpOnly-кука (path=/api/auth) браузер шлёт сам.
@Injectable()
export class CallerIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(req: Request): Promise<bigint | null> {
    if (req.webUser) return req.webUser.userId;
    const raw = getCookie(req, REFRESH_COOKIE);
    return raw ? this.sessionUserIdForRefresh(raw) : null;
  }

  // userId владельца живой (не отозванной, не истёкшей) сессии по сырому
  // refresh-токену. Ничего не ротирует и не пишет — только читает.
  async sessionUserIdForRefresh(raw: string): Promise<bigint | null> {
    const session = await this.prisma.webSession.findUnique({
      where: { tokenHash: hashToken(raw) },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date())
      return null;
    return session.userId;
  }
}
