// Единственное место, которое знает имя события пути входа и форму его meta.
//
// userId всегда null — тот же приём, что у auth_success/auth_rejected
// (src/api/auth-success.report.ts). Причин две. На шаге «выписали код»
// пользователя ещё нет вовсе, а отчёт считает строки с `userId IS NULL` —
// значит подделать его через открытый /api/event нельзя.
//
// Троттлинга здесь нет намеренно: билет одноразовый (claim в poll), а роут
// выписки уже под лимитом. Поток событий ограничен сверху числом билетов.
import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../../analytics/analytics.service';
import type { LoginTicketStep } from '../../analytics/login-ticket-steps.constants';

const EVENT = 'login_ticket_step';

@Injectable()
export class LoginTicketReport {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * `void`, а не `.catch(() => null)`: AnalyticsService.track глотает свои
   * ошибки сам, глушитель здесь был бы лишним и попал бы в гейт тихих catch.
   * Отчёт о пути входа не имеет права задерживать сам вход.
   */
  step(step: LoginTicketStep, hostId: string): void {
    void this.analytics.track(null, EVENT, { step, host: hostId });
  }
}
