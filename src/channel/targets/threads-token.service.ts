import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { encrypt, decrypt } from '../../utils/crypto';
import { getJson } from '../channel-http';
import { threadsApi } from './threads-api';

/**
 * Долгоживущий токен Threads живёт 60 дней и обновляется только запросом с
 * самим собой. Env для этого не годится: обновлённый токен некуда записать, и
 * канал молча умер бы через два месяца. Поэтому актуальный токен лежит в БД
 * (общий key-value BookingSetting — отдельная таблица ради одной строки не
 * нужна), зашифрованным: это секрет площадки, а не настройка.
 *
 * Env `HEALTHY_ADULT_THREADS_TOKEN` — стартовое значение: его вставляют руками
 * один раз, дальше сервис живёт своей копией.
 */
const KEY = 'channel:threads_token';
const TOKEN_ENV = 'HEALTHY_ADULT_THREADS_TOKEN';
const REFRESH_PATH = '/refresh_access_token?grant_type=th_refresh_token';
/** Обновляем сильно заранее: 60 дней — потолок, после него токен не воскресить. */
const REFRESH_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ThreadsTokenService {
  private readonly logger = new Logger(ThreadsTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Токен для отправки: сохранённый, иначе стартовый из env. */
  async current(): Promise<string | null> {
    // Падение чтения из БД молча деградирует до стартового env-токена — но
    // тишина превращает понятную причину (БД недоступна) в непонятный
    // симптом (площадка отправляет устаревшим токеном после ротации).
    const stored = await this.stored().catch((err) => {
      this.logger.warn(
        `threads token: чтение из БД упало, деградируем до env: ${(err as Error)?.message}`,
      );
      return null;
    });
    return stored?.token ?? process.env[TOKEN_ENV]?.trim() ?? null;
  }

  private async stored(): Promise<{ token: string; at: Date } | null> {
    const row = await this.prisma.bookingSetting.findUnique({
      where: { key: KEY },
      select: { value: true, updatedAt: true },
    });
    const token = decrypt(row?.value);
    return token ? { token, at: row!.updatedAt } : null;
  }

  private async save(token: string): Promise<void> {
    // Секрет площадки хранится шифрованным (в проде ключ обязателен, иначе
    // процесс не стартует). Пустой шифртекст — нечего сохранять.
    const value = encrypt(token);
    if (!value) return;
    await this.prisma.bookingSetting.upsert({
      where: { key: KEY },
      update: { value },
      create: { key: KEY, value },
    });
  }

  /**
   * Раз в сутки: если токену больше REFRESH_AFTER_DAYS — меняем на свежий.
   * Ночью, чтобы не пересекаться с окнами публикации.
   */
  @Cron('17 3 * * *', { name: 'threadsTokenRefresh' })
  async refreshIfStale(now = new Date()): Promise<void> {
    try {
      const token = await this.current();
      if (!token) return;
      const stored = await this.stored();
      // Токена в БД ещё нет — сохраняем стартовый, дальше считаем возраст от него.
      if (!stored) return void (await this.save(token));
      if (now.getTime() - stored.at.getTime() < REFRESH_AFTER_DAYS * DAY_MS)
        return;

      // Тем же путём, что и публикация: с российского хостинга Meta недоступна
      // напрямую, а токен, который не обновился, через 60 дней умрёт молча.
      const refresh = threadsApi(`${REFRESH_PATH}&access_token=${token}`);
      const res = await getJson(refresh.url, refresh.transport);
      const fresh =
        typeof res.access_token === 'string' ? res.access_token : '';
      if (!fresh) throw new Error('в ответе нет access_token');
      await this.save(fresh);
      this.logger.log('threads token refreshed');
    } catch (err) {
      // Токен ещё жив, времени на починку — месяц, поэтому warn, а не error.
      this.logger.warn(
        `threads token refresh failed: ${(err as Error)?.message}`,
      );
    }
  }
}
