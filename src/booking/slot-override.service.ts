import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SlotOverrideKind } from '@prisma/client';

export interface SlotOverrideSetItem {
  startsAt: Date;
  durationMin: number;
  kind: SlotOverrideKind;
}

export interface ApplyOverridesInput {
  set: SlotOverrideSetItem[];
  clear: Date[];
}

/**
 * CRUD ручного слоя SlotOverride (BLOCK/OPEN) — контракт «Календарь слотов
 * в админке». Читают и SlotService (публичные /slots), и AdminCalendarService.
 */
@Injectable()
export class SlotOverrideService {
  constructor(private readonly prisma: PrismaService) {}

  /** Overrides в окне [from, toExclusive) — используется календарём админки. */
  async listBetween(from: Date, toExclusive: Date) {
    return this.prisma.slotOverride.findMany({
      where: { startsAt: { gte: from, lt: toExclusive } },
    });
  }

  /**
   * Применяет патч в ОДНОЙ транзакции: сначала снимает все clear
   * (deleteMany по startsAt in), потом ставит каждый set — upsert по
   * startsAt (@unique), чтобы повторный клик по той же ячейке обновлял
   * строку, а не плодил дубль/конфликт уникальности.
   */
  async apply({ set, clear }: ApplyOverridesInput): Promise<{ ok: true }> {
    await this.prisma.$transaction(async (tx) => {
      await tx.slotOverride.deleteMany({
        where: { startsAt: { in: clear } },
      });
      for (const item of set) {
        await tx.slotOverride.upsert({
          where: { startsAt: item.startsAt },
          create: {
            startsAt: item.startsAt,
            durationMin: item.durationMin,
            kind: item.kind,
          },
          update: { kind: item.kind, durationMin: item.durationMin },
        });
      }
    });
    return { ok: true };
  }
}
