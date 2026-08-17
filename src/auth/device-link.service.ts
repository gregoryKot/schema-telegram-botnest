// Привязка аккаунта мессенджера к уже существующему — device authorization
// grant (RFC 8628), тот же приём, которым телевизор подключают к Netflix.
//
// Зачем так. У MAX нет входа для сайтов: их подпись существует только внутри
// мини-аппа, и предъявить её в обычной вкладке невозможно. Значит человек не
// может, сидя на сайте, нажать «привязать MAX». Остаётся обратное направление
// — начать из мини-аппа. Но войти через Google прямо в мини-аппе тоже нельзя:
// Google запрещает OAuth во встроенных вебвью и требует системный браузер.
//
// Отсюда разрыв: вход происходит в одном окне, а сессия нужна в другом.
// Мостом служит пара кодов. Мини-апп получает длинный секрет (device_code) и
// коротким (user_code) уводит человека в браузер; браузер подтверждает;
// мини-апп опрашивает сервер и забирает сессию.
//
// Порядок шагов в approve — не косметика, см. комментарий там.
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { MergeService } from './merge.service';
import { SecurityLogService } from './security-log.service';
import type { DeviceLinkStatus, LinkPreview } from './device-link.types';

// Без похожих начертаний (0/O, 1/I/L) — код читают с экрана и набирают руками.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const USER_CODE_LENGTH = 8;
const TTL_S = 300;
export const POLL_INTERVAL_S = 3;

@Injectable()
export class DeviceLinkService {
  private readonly logger = new Logger(DeviceLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly merge: MergeService,
    private readonly securityLog: SecurityLogService,
  ) {}

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private newUserCode(): string {
    let out = '';
    for (let i = 0; i < USER_CODE_LENGTH; i++) {
      out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    return out;
  }

  /** Шаг 1: мини-апп просит привязку. Возвращает оба кода. */
  async start(
    userId: bigint,
    provider: string,
  ): Promise<{
    deviceCode: string;
    userCode: string;
    expiresIn: number;
    interval: number;
  }> {
    // Один активный код на аккаунт: иначе прошлый, забытый на другом экране,
    // остаётся годным для подтверждения.
    await this.prisma.deviceLinkRequest.deleteMany({
      where: { OR: [{ userId }, { expiresAt: { lt: new Date() } }] },
    });

    const deviceCode = randomBytes(32).toString('hex');
    const userCode = this.newUserCode();
    await this.prisma.deviceLinkRequest.create({
      data: {
        deviceCodeHash: this.hash(deviceCode),
        userCodeHash: this.hash(userCode),
        userId,
        provider,
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

  private async liveByUserCode(userCode: string) {
    const row = await this.prisma.deviceLinkRequest.findUnique({
      where: { userCodeHash: this.hash(userCode.trim().toUpperCase()) },
    });
    if (!row || row.consumedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Код не найден или истёк');
    }
    return row;
  }

  /**
   * Шаг 2: браузер показывает, что именно произойдёт, ДО подтверждения.
   * Без этого экрана флоу открыт для фишинга: человека уговаривают ввести
   * код «для проверки безопасности», и он молча отдаёт свой аккаунт.
   */
  async preview(userCode: string, targetUserId: bigint): Promise<LinkPreview> {
    const row = await this.liveByUserCode(userCode);
    const sameAccount = row.userId === targetUserId;
    const source = await this.prisma.authProvider.findFirst({
      where: { userId: row.userId, provider: row.provider },
    });
    return {
      provider: row.provider,
      displayName: source?.displayName ?? null,
      sameAccount,
      summary: sameAccount ? {} : await this.merge.summarize(row.userId),
    };
  }

  /** Шаг 3: человек в браузере подтвердил. Здесь и происходит перенос. */
  async approve(
    userCode: string,
    targetUserId: bigint,
    ip?: string,
  ): Promise<{ merged: boolean }> {
    const row = await this.liveByUserCode(userCode);
    if (row.approvedUserId)
      throw new BadRequestException('Код уже подтверждён');
    // Запоминаем источник до всякой записи: дальше хозяин строки меняется, и
    // читать его оттуда уже нельзя.
    const sourceUserId = row.userId;

    const approved = { approvedUserId: targetUserId, approvedAt: new Date() };
    if (sourceUserId === targetUserId) {
      // Человек вошёл в браузере под тем же аккаунтом — переносить нечего.
      await this.prisma.deviceLinkRequest.update({
        where: { id: row.id },
        data: approved,
      });
      return { merged: false };
    }

    const source = await this.prisma.authProvider.findFirst({
      where: { userId: sourceUserId, provider: row.provider },
    });

    // Хозяина строки меняем ДО merge. Иначе merge снесёт её вместе с
    // исчезающим аккаунтом (SECURITY_SENSITIVE_TABLES), и мини-апп, вернувшись
    // за сессией, увидит «код не найден» — при том, что данные уже переехали.
    await this.prisma.deviceLinkRequest.update({
      where: { id: row.id },
      data: { userId: targetUserId, ...approved },
    });

    try {
      await this.merge.merge(sourceUserId, targetUserId);
    } catch (err) {
      // Строка уже сменила хозяина — оставлять её годной нельзя.
      await this.prisma.deviceLinkRequest.delete({ where: { id: row.id } });
      this.logger.error(
        `device-link merge ${sourceUserId} → ${targetUserId} failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw new BadRequestException(
        'Не удалось объединить аккаунты. Админ уведомлён — попробовать позже.',
      );
    }

    if (source) {
      await this.auth.linkProviderToUser(
        targetUserId,
        row.provider,
        source.providerId,
      );
    }
    this.securityLog.log('merge_confirmed', {
      target: targetUserId,
      source: sourceUserId,
      provider: row.provider,
      ip,
    });
    return { merged: true };
  }

  /** Шаг 4: мини-апп опрашивает по длинному коду и забирает сессию. */
  async poll(
    deviceCode: string,
    ip?: string,
    userAgent?: string,
  ): Promise<DeviceLinkStatus> {
    const row = await this.prisma.deviceLinkRequest.findUnique({
      where: { deviceCodeHash: this.hash(deviceCode) },
    });
    if (!row || row.consumedAt || row.expiresAt < new Date()) {
      return { status: 'expired' };
    }
    if (!row.approvedUserId) return { status: 'pending' };

    // Одноразовость: помечаем ДО выдачи токенов, чтобы повторный опрос (или
    // второй экземпляр мини-аппа) не получил вторую сессию по тому же коду.
    const claimed = await this.prisma.deviceLinkRequest.updateMany({
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
