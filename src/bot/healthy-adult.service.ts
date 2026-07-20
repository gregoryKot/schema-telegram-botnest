import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HEALTHY_ADULT_PHRASES } from './healthy-adult.data';
import { prepareImport, type ImportPreparation } from './healthy-adult.import';

/** Остаток пула: сколько включённых фраз ещё не звучало и на сколько хватит. */
export interface HealthyAdultPoolStatus {
  enabled: number;
  unused: number;
  daysLeft: number;
}

export interface HealthyAdultPhraseRow {
  id: number;
  text: string;
  enabled: boolean;
  sortOrder: number;
}

/** Канал публикует дважды в день — из этого считаем, на сколько хватит пула. */
const POSTS_PER_DAY = 2;

/** Что отдаём админке (одним объектом, чтобы поля не разъезжались по методам). */
const PHRASE_FIELDS = {
  id: true,
  text: true,
  enabled: true,
  sortOrder: true,
} as const;

/**
 * Управление пулом фраз «Здорового Взрослого» (админка + чтение каналом).
 * Фразы — глобальный контент, не пользовательские данные: вне USER_DATA_TABLES
 * и шифрования (они и так публикуются в канал открыто).
 */
@Injectable()
export class HealthyAdultService {
  constructor(private readonly prisma: PrismaService) {}

  /** Полный список для админки (в порядке отображения). */
  async list(): Promise<HealthyAdultPhraseRow[]> {
    return this.prisma.healthyAdultPhrase.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, text: true, enabled: true, sortOrder: true },
    });
  }

  /**
   * Тексты включённых фраз для публикации. Если таблица пуста (миграция ещё
   * не накатила сид) — фолбэк на встроенный пул, чтобы канал не замолкал.
   */
  async enabledTexts(): Promise<string[]> {
    const rows = await this.prisma.healthyAdultPhrase.findMany({
      where: { enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { text: true },
    });
    const texts = rows.map((r) => r.text);
    return texts.length > 0 ? texts : [...HEALTHY_ADULT_PHRASES];
  }

  /**
   * Выбрать фразу из пула для публикации по принципу «давно не звучала»
   * (LRU): берём включённые с самым старым lastPostedAt (ни разу — первыми),
   * случайно среди равных, и помечаем выбранную. Так ни ручной тест, ни
   * рестарт, ни расписание не дают повтор подряд (фикс дубля).
   * Если в БД нет включённых фраз — фолбэк на встроенный пул (без дубля с
   * недавними постами).
   */
  async pickFromPool(recentPosts: string[] = []): Promise<string | null> {
    const rows = await this.prisma.healthyAdultPhrase.findMany({
      where: { enabled: true },
      select: { id: true, text: true, lastPostedAt: true },
    });
    if (rows.length === 0) return this.pickFromBuiltin(recentPosts);

    const key = (d: Date | null) => (d ? d.getTime() : 0);
    const oldest = Math.min(...rows.map((r) => key(r.lastPostedAt)));
    const candidates = rows.filter((r) => key(r.lastPostedAt) === oldest);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    await this.prisma.healthyAdultPhrase.update({
      where: { id: chosen.id },
      data: { lastPostedAt: new Date() },
    });
    return chosen.text;
  }

  private pickFromBuiltin(recentPosts: string[]): string {
    const fresh = HEALTHY_ADULT_PHRASES.filter((t) => !recentPosts.includes(t));
    const pool = fresh.length > 0 ? fresh : HEALTHY_ADULT_PHRASES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Записать факт публикации (для дедупа и контекста генератора). */
  async recordPost(text: string, source: 'ai' | 'pool'): Promise<void> {
    await this.prisma.healthyAdultPost.create({ data: { text, source } });
  }

  /**
   * Остаток пула: сколько включённых фраз ещё ни разу не выходило в канал.
   * Пул конечен (пополняется вручную), поэтому этот остаток — то, за чем
   * владельцу надо следить, чтобы канал не начал повторяться.
   */
  async poolStatus(): Promise<HealthyAdultPoolStatus> {
    const [enabled, unused] = await Promise.all([
      this.prisma.healthyAdultPhrase.count({ where: { enabled: true } }),
      this.prisma.healthyAdultPhrase.count({
        where: { enabled: true, lastPostedAt: null },
      }),
    ]);
    // Два поста в день — столько дней продержится запас неповторённого.
    return { enabled, unused, daysLeft: Math.floor(unused / POSTS_PER_DAY) };
  }

  /** Время последней публикации (null — ещё ни одной). Для jitter-расписания. */
  async lastPostAt(): Promise<Date | null> {
    const row = await this.prisma.healthyAdultPost.findFirst({
      orderBy: { id: 'desc' },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  }

  /** Последние N опубликованных текстов (новые первыми). */
  async recentPostTexts(n = 10): Promise<string[]> {
    const rows = await this.prisma.healthyAdultPost.findMany({
      orderBy: { id: 'desc' },
      take: n,
      select: { text: true },
    });
    return rows.map((r) => r.text);
  }

  async create(text: string): Promise<HealthyAdultPhraseRow> {
    const max = await this.prisma.healthyAdultPhrase.aggregate({
      _max: { sortOrder: true },
    });
    return this.prisma.healthyAdultPhrase.create({
      data: { text: text.trim(), sortOrder: (max._max.sortOrder ?? -1) + 1 },
      select: { id: true, text: true, enabled: true, sortOrder: true },
    });
  }

  /**
   * Добавить пачку фраз из админки. Дубли и повторы зачинов отсекаются
   * (prepareImport), поэтому возвращаем отчёт — сколько доехало и что
   * пропущено: «вставил 20, появилось 14» без объяснения выглядит как баг.
   */
  async importMany(raw: string): Promise<{
    created: HealthyAdultPhraseRow[];
    report: ImportPreparation;
  }> {
    const existing = await this.prisma.healthyAdultPhrase.findMany({
      select: { text: true },
    });
    const report = prepareImport(
      raw,
      existing.map((r) => r.text),
    );
    if (report.accepted.length === 0) return { created: [], report };

    const max = await this.prisma.healthyAdultPhrase.aggregate({
      _max: { sortOrder: true },
    });
    let sortOrder = (max._max.sortOrder ?? -1) + 1;
    const created = await this.prisma.healthyAdultPhrase.createManyAndReturn({
      data: report.accepted.map((text) => ({ text, sortOrder: sortOrder++ })),
      select: PHRASE_FIELDS,
    });
    return { created, report };
  }

  async update(
    id: number,
    patch: { text?: string; enabled?: boolean },
  ): Promise<HealthyAdultPhraseRow> {
    await this.ensureExists(id);
    return this.prisma.healthyAdultPhrase.update({
      where: { id },
      data: {
        ...(patch.text !== undefined ? { text: patch.text.trim() } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      },
      select: { id: true, text: true, enabled: true, sortOrder: true },
    });
  }

  async remove(id: number): Promise<{ ok: true }> {
    await this.ensureExists(id);
    await this.prisma.healthyAdultPhrase.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureExists(id: number): Promise<void> {
    const row = await this.prisma.healthyAdultPhrase.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Фраза не найдена');
  }
}
