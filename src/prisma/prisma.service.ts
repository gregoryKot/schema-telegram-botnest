import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildUrl(): string {
  const base = process.env.DATABASE_URL ?? '';
  const sep = base.includes('?') ? '&' : '?';
  // connection_limit: max concurrent DB connections (default 5 is too low for prod)
  // pool_timeout: seconds to wait for a free connection before throwing
  return base + `${sep}connection_limit=15&pool_timeout=30`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ datasources: { db: { url: buildUrl() } } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
