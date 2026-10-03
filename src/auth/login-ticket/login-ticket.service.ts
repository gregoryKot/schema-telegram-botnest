// Жизненный цикл билета входа: выписать, подтвердить, забрать сессию.
//
// Зачем механизм. Установленное приложение (ярлык на телефоне) живёт в
// ОТДЕЛЬНОЙ банке кук, не связанной с браузером. Пока вход был обычным
// редиректом, он уходил на `accounts.google.com` или `oauth.telegram.org` —
// адреса вне scope приложения, — и система отдавала их внешнему браузеру.
// Сессия выдавалась ТАМ, а приложение, из которого человек вышел, оставалось
// на экране входа навсегда (разбор 2026-08-28).
//
// Билет разрывает эту связь: контейнер держит длинный секрет у себя, человек
// подтверждает вход где угодно — в боте, во внешнем браузере, — и контейнер
// ЗАБИРАЕТ сессию опросом. Куда бы ни ушёл человек, сессия возвращается ровно
// туда, где вход начался.
//
// Выросло из device-link (RFC 8628). Второго механизма рядом не заводим —
// привязка аккаунта это тот же билет с `intent: 'link'` (CLAUDE.md, «одна
// механика — один компонент»); тяжёлая часть привязки — в ticket-link.service.
import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import { SecurityLogService } from '../security-log.service';
import { newUserCode, staleTicketsWhere } from './ticket-user-code';
import { assertTicketViewer, claimTicketView } from './ticket-viewer';
import { LoginTicketReport } from './login-ticket.report';
import type { StartTicketInput } from './ticket-start.types';
import type {
  TicketForConfirm,
  TicketIntent,
  TicketStatus,
} from './login-ticket.types';

const TTL_S = 300;
export const POLL_INTERVAL_S = 3;

@Injectable()
export class LoginTicketService {
  private readonly logger = new Logger(LoginTicketService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly report: LoginTicketReport,
    @Optional() private readonly securityLog?: SecurityLogService,
  ) {}

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /** Шаг 1: контейнер просит билет. Длинный секрет наружу больше не выходит. */
  async start(input: StartTicketInput): Promise<{
    deviceCode: string;
    userCode: string;
    expiresIn: number;
    interval: number;
  }> {
    // Что подчистить перед выпиской — см. staleTicketsWhere.
    await this.prisma.loginTicket.deleteMany({
      where: staleTicketsWhere(input.requesterUserId),
    });

    const deviceCode = randomBytes(32).toString('hex');
    const userCode = newUserCode();
    await this.prisma.loginTicket.create({
      data: {
        deviceCodeHash: this.hash(deviceCode),
        userCodeHash: this.hash(userCode),
        userId: input.requesterUserId,
        intent: input.intent,
        provider: input.provider,
        hostId: input.hostId,
        deviceLabel: input.deviceLabel,
        expiresAt: new Date(Date.now() + TTL_S * 1000),
      },
    });
    // Только вход: привязка аккаунтов считается своими событиями
    // (account_link_*), и мешать их в одну воронку значило бы считать разное.
    if (input.intent === 'login') this.report.step('issued', input.hostId);
    return {
      deviceCode,
      userCode,
      expiresIn: TTL_S,
      interval: POLL_INTERVAL_S,
    };
  }

  /**
   * Живой билет по короткому коду. Бросает, если его нет, он погашен или
   * протух — или (viaTelegramId задан) карточку показали не этому человеку.
   */
  async liveByUserCode(userCode: string, viaTelegramId?: bigint) {
    const row = await this.prisma.loginTicket.findUnique({
      where: { userCodeHash: this.hash(userCode.trim().toUpperCase()) },
    });
    if (!row || row.consumedAt || row.deniedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Код не найден или истёк');
    }
    assertTicketViewer(this.securityLog, row, viaTelegramId);
    return row;
  }

  /**
   * Что показать при сверке. Отдельный метод, а не `liveByUserCode` наружу:
   * бот получает только то, что покажет человеку, и не может случайно
   * отправить в чат хеши или чужой userId.
   */
  async forConfirm(
    userCode: string,
    viewerTelegramId?: bigint,
  ): Promise<TicketForConfirm | null> {
    const row = await this.prisma.loginTicket
      .findUnique({
        where: { userCodeHash: this.hash(userCode.trim().toUpperCase()) },
      })
      .catch((err: Error) => {
        this.logger.error(`ticket lookup failed: ${err.message}`, err.stack);
        return null;
      });
    if (!row || row.consumedAt || row.deniedAt || row.expiresAt < new Date()) {
      // Строку нашли, но она мертва — человек открыл ссылку поздно. Это самый
      // частый «не успел», и считать его надо здесь: до liveByUserCode такой
      // код не доходит. Несуществующий код не считаем вовсе — иначе перебор
      // сам себе рисовал бы статистику.
      //
      // НО consumedAt — это УСПЕХ (приложение уже забрало сессию опросом), а
      // не «не успел»: повторный тап диплинка после удачного входа не должен
      // капать в too_late и портить воронку (разбор 2026-08-31).
      if (row && row.intent === 'login' && !row.consumedAt)
        this.report.step('too_late', row.hostId);
      return null;
    }
    // Карточку закрепляем за первым увидевшим; остальным код «не найден».
    const mine = await claimTicketView(
      this.prisma,
      this.securityLog,
      row,
      viewerTelegramId,
    );
    if (!mine) return null;
    if (row.intent === 'login') this.report.step('bot_opened', row.hostId);
    return {
      userCode: userCode.trim().toUpperCase(),
      intent: row.intent as TicketIntent,
      deviceLabel: row.deviceLabel,
      hostId: row.hostId,
    };
  }

  /**
   * Подтверждение входа (`intent: 'login'`): билет получает хозяина, и опрос
   * выдаст сессию именно этого аккаунта. Привязка идёт другим путём —
   * TicketLinkService, там нужен перенос данных.
   */
  async approveLogin(
    userCode: string,
    approvedUserId: bigint,
    viaTelegramId?: bigint,
  ): Promise<void> {
    const row = await this.liveByUserCode(userCode, viaTelegramId);
    if (row.intent !== 'login') {
      throw new BadRequestException('Этот код не для входа');
    }
    if (row.approvedUserId) {
      // Идемпотентность (разбор 2026-08-31): повторный тап «это я» тем же
      // человеком до того, как опрос заберёт сессию, — это НЕ ошибка. Раньше
      // второй тап падал в «Код уже подтверждён» и бот показывал ложную
      // карточку провала после успеха. Тот же хозяин — тихо подтверждаем ещё
      // раз; ЧУЖОЙ уже занятый код — по-прежнему отказ.
      if (row.approvedUserId === approvedUserId) return;
      throw new BadRequestException('Код уже подтверждён');
    }
    await this.prisma.loginTicket.update({
      where: { id: row.id },
      data: { approvedUserId, approvedAt: new Date() },
    });
    this.report.step('confirmed', row.hostId);
  }

  /**
   * Подтвердить вход, не роняя поток, который УЖЕ состоялся: OAuth-callback,
   * переход по ссылке из письма и второй фактор вызывают это после того, как
   * человек вошёл в браузере. Провал билета не повод отдавать ему ошибку — но
   * и молчать нельзя, иначе «приложение не впустило» останется без следа.
   */
  async approveLoginIfPossible(
    userCode: string,
    approvedUserId: bigint,
  ): Promise<boolean> {
    try {
      await this.approveLogin(userCode, approvedUserId);
      return true;
    } catch (err) {
      this.logger.warn(`ticket approve skipped: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * «Это не я». Отказ обязан быть отдельным исходом, а не молчаливым
   * протуханием: экран, который просто ждёт пять минут, не скажет человеку,
   * что вход отклонили — а тому, кого пытались обмануть, важно это увидеть.
   */
  async deny(userCode: string, viaTelegramId?: bigint): Promise<void> {
    const row = await this.liveByUserCode(userCode, viaTelegramId);
    await this.prisma.loginTicket.update({
      where: { id: row.id },
      data: { deniedAt: new Date() },
    });
    if (row.intent === 'login') this.report.step('denied', row.hostId);
  }

  /** Шаг 4: контейнер опрашивает по длинному коду и забирает сессию. */
  async poll(
    deviceCode: string,
    ip?: string,
    userAgent?: string,
  ): Promise<TicketStatus> {
    const row = await this.prisma.loginTicket.findUnique({
      where: { deviceCodeHash: this.hash(deviceCode) },
    });
    if (!row || row.consumedAt || row.expiresAt < new Date()) {
      return { status: 'expired' };
    }
    if (row.deniedAt) return { status: 'denied' };
    if (!row.approvedUserId) return { status: 'pending' };

    // Одноразовость: помечаем ДО выдачи токенов, чтобы повторный опрос (или
    // второй экземпляр приложения) не получил вторую сессию по тому же коду.
    const claimed = await this.prisma.loginTicket.updateMany({
      where: { id: row.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count === 0) return { status: 'expired' };

    const tokens = await this.auth.issueTokens(
      row.approvedUserId,
      ip,
      userAgent,
    );
    // Единственный шаг, означающий «человек внутри». Пишется после claim,
    // поэтому повторный опрос его не задваивает.
    if (row.intent === 'login') this.report.step('taken', row.hostId);
    return { status: 'linked', tokens };
  }
}
