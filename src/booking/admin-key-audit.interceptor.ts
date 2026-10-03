import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, catchError, throwError } from 'rxjs';
import { SecurityLogService } from '../auth/security-log.service';
import { AdminKeyRejectedException } from './admin-key.util';

/**
 * Аудит 2026-10 (I2): отказ по ключу админки (403 от `assertAdminKey`) не
 * оставлял следа — перебор ключа с одного IP выглядел как обычный шум.
 * Интерцептор глобальный (APP_INTERCEPTOR), а не правка пяти контроллеров:
 * `assertAdminKey` — чистая функция без доступа к SecurityLogService, а
 * интерцептор видит исключение до фильтров и не меняет его (клиент получает
 * тот же 403). Пишем только IP, путь и причину — сам присланный ключ в лог не
 * попадает. Событие не в ALERT_EVENTS: структурная строка в логах
 * достаточна, а DM на каждую опечатку админа — путь к замьюченному чату.
 */
@Injectable()
export class AdminKeyAuditInterceptor implements NestInterceptor {
  constructor(private readonly securityLog: SecurityLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((err: unknown) => {
        if (err instanceof AdminKeyRejectedException) {
          const req = context.switchToHttp().getRequest<Request>();
          this.securityLog.log('admin_key_rejected', {
            ip: req?.ip,
            path: req?.path,
            reason: err.reason,
          });
        }
        return throwError(() => err);
      }),
    );
  }
}
