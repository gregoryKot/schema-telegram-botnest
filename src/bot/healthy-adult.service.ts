import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HEALTHY_ADULT_PHRASES } from './healthy-adult.data';

export interface HealthyAdultPhraseRow {
  id: number;
  text: string;
  enabled: boolean;
  sortOrder: number;
}

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

  async create(text: string): Promise<HealthyAdultPhraseRow> {
    const max = await this.prisma.healthyAdultPhrase.aggregate({
      _max: { sortOrder: true },
    });
    return this.prisma.healthyAdultPhrase.create({
      data: { text: text.trim(), sortOrder: (max._max.sortOrder ?? -1) + 1 },
      select: { id: true, text: true, enabled: true, sortOrder: true },
    });
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
