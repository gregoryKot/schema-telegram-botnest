import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  statementTimeoutLogLine,
  statementTimeoutMs,
} from './statement-timeout';

export function buildPrismaAdapter(
  statementTimeout: number = statementTimeoutMs(),
): PrismaPg {
  return new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? '',
    max: 15,
    connectionTimeoutMillis: 30_000,
    // Keep connections alive so NAT/firewall doesn't drop idle sockets.
    // Without this, cloud firewalls close idle TCP connections after ~4-5 min,
    // and the next query gets "Server has closed the connection" (P1017).
    keepAlive: true,
    keepAliveInitialDelayMillis: 30_000,
    // Evict connections idle longer than 5 min from the pool so they're
    // never handed out stale.
    idleTimeoutMillis: 300_000,
    // Предел одного запроса — стартовый параметр каждой сессии пула
    // (statement-timeout.ts). 0 — без лимита: pg тогда параметр не шлёт.
    statement_timeout: statementTimeout,
  });
}

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'error'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const limitMs = statementTimeoutMs();
    super({
      adapter: buildPrismaAdapter(limitMs),
      log: [{ emit: 'event', level: 'error' }],
    });
    // Таймаут ловится здесь, а не в каждом вызывающем: крон, бот и HTTP
    // получают одну строку с местом вызова. Прочие ошибки Prisma — забота
    // вызывающего, как и раньше.
    this.$on('error', (e) => {
      const line = statementTimeoutLogLine(e.message, limitMs);
      if (line) this.logger.error(line);
    });
  }

  async onModuleInit() {
    // Retry connect with backoff so a transient DB blip during deploy doesn't
    // crash the container and trigger an infinite Amvera restart loop.
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (err) {
        if (attempt === 5) throw err;
        const delay = attempt * 2_000;
        this.logger.warn(
          `DB connect attempt ${attempt} failed, retrying in ${delay}ms: ${(err as Error).message}`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
