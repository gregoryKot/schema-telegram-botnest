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
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import type {
  TicketForConfirm,
  TicketIntent,
  TicketStatus,
} from './login-ticket.types';

// Без похожих начертаний (0/O, 1/I/L) — код читают с экрана и сверяют глазами.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const USER_CODE_LENGTH = 8;
const TTL_S = 300;
export const POLL_INTERVAL_S = 3;

export interface StartTicketInput {
  intent: TicketIntent;
  provider: string;
  /** Кто просит. У `intent: 'login'` хозяина нет — там null. */
  requesterUserId: bigint | null;
  hostId: string;
  deviceLabel: string;
}

@Injectable()
export class LoginTicketService {
  private readonly logger = new Logger(LoginTicketService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private newUserCode(): string {
    let out = '';
    for (let i = 0; i < USER_CODE_LENGTH; i++) {
      out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    return out;
  }

  /** Шаг 1: контейнер просит билет. Длинный секрет наружу больше не выходит. */
  async start(input: StartTicketInput): Promise<{
    deviceCode: string;
    userCode: string;
    expiresIn: number;
    interval: number;
  }> {
    // Протухшие подчищаем всегда, а прежний билет ЭТОГО аккаунта гасим: иначе
    // код, забытый на другом экране, остаётся годным для подтверждения.
    // У входа (requesterUserId === null) гасить по хозяину нечего — иначе
    // условие `{ userId: null }` снесло бы чужие билеты всех анонимов разом.
    await this.prisma.loginTicket.deleteMany({
      where: input.requesterUserId
        ? {
            OR: [
              { userId: input.requesterUserId },
              { expiresAt: { lt: new Date() } },
            ],
          }
        : { expiresAt: { lt: new Date() } },
    });

    const deviceCode = randomBytes(32).toString('hex');
    const userCode = this.newUserCode();
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
    return {
      deviceCode,
      userCode,
      expiresIn: TTL_S,
      interval: POLL_INTERVAL_S,
    };
  }

  /** Живой билет по короткому коду. Бросает, если его нет, он погашен или протух. */
  async liveByUserCode(userCode: string) {
    const row = await this.prisma.loginTicket.findUnique({
      where: { userCodeHash: this.hash(userCode.trim().toUpperCase()) },
    });
    if (!row || row.consumedAt || row.deniedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Код не найден или истёк');
    }
    return row;
  }

  /**
   * Что показать при сверке. Отдельный метод, а не `liveByUserCode` наружу:
   * бот получает только то, что покажет человеку, и не может случайно
   * отправить в чат хеши или чужой userId.
   */
  async forConfirm(userCode: string): Promise<TicketForConfirm | null> {
    const row = await this.prisma.loginTicket
      .findUnique({
        where: { userCodeHash: this.hash(userCode.trim().toUpperCase()) },
      })
      .catch((err: Error) => {
        this.logger.error(`ticket lookup failed: ${err.message}`, err.stack);
        return null;
      });
    if (!row || row.consumedAt || row.deniedAt || row.expiresAt < new Date()) {
      return null;
    }
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
  async approveLogin(userCode: string, approvedUserId: bigint): Promise<void> {
    const row = await this.liveByUserCode(userCode);
    if (row.intent !== 'login') {
      throw new BadRequestException('Этот код не для входа');
    }
    if (row.approvedUserId)
      throw new BadRequestException('Код уже подтверждён');
    await this.prisma.loginTicket.update({
      where: { id: row.id },
      data: { approvedUserId, approvedAt: new Date() },
    });
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
  async deny(userCode: string): Promise<void> {
    const row = await this.liveByUserCode(userCode);
    await this.prisma.loginTicket.update({
      where: { id: row.id },
      data: { deniedAt: new Date() },
    });
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
    return { status: 'linked', tokens };
  }
}
