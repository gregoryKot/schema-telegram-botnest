import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { GuideMark } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { TherapyRelationsService } from './therapy-relations.service';
import {
  decryptRecord,
  encryptRecord,
  type EncryptSchema,
} from '../utils/crypto-record';
import {
  isGuideMarkAddress,
  normalizeGuideAddress,
  parseGuideAddress,
  type GuideMarkArticleKind,
  type GuideMarkKind,
} from './guide-mark-address';

const GUIDE_MARK_SCHEMA: EncryptSchema = {
  strings: ['note', 'snapshot'],
  model: 'GuideMark',
};

export interface GuideMarkView {
  id: number;
  clientId: string;
  /** Адрес после реестра переименований; не находит текста на сайте — «раздел изменился». */
  address: string;
  note: string | null;
  /** Текст раздела на момент отметки. */
  snapshot: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuideMarkInput {
  address: string;
  snapshot: string;
  note?: string;
}

function toView(row: GuideMark): GuideMarkView {
  const r = decryptRecord(row, GUIDE_MARK_SCHEMA);
  return {
    id: r.id,
    clientId: String(r.clientId),
    address: normalizeGuideAddress(r.address),
    note: r.note,
    snapshot: r.snapshot,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Адрес раздела, чья отметка живёт в GuideMark; иначе 400 (копинг схемы — в schemaLinks). */
export function guideMarkAddress(raw: string): {
  address: string;
  kind: GuideMarkArticleKind;
} {
  const address = normalizeGuideAddress(raw);
  const parts = parseGuideAddress(address);
  if (!parts) throw new BadRequestException('Unknown guide address');
  if (!isGuideMarkAddress(parts))
    throw new BadRequestException('Address is marked via schemaLinks');
  return { address, kind: parts.kind };
}

// Отметки «Про клиента» из «Справочника» (#1484): видит и правит только
// терапевт клиента. Доступ — assertHasClient ('No active relation' → 403 в
// контроллере); снятие по id перепроверяет связь с клиентом отметки.
@Injectable()
export class GuideMarksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relations: TherapyRelationsService,
    private readonly analytics: AnalyticsService,
  ) {}

  async list(therapistId: bigint, clientId: bigint): Promise<GuideMarkView[]> {
    await this.relations.assertHasClient(therapistId, clientId);
    const rows = await this.prisma.guideMark.findMany({
      where: { therapistId, clientId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toView);
  }

  /** Кому из клиентов терапевта раздел уже отмечен («уже отмечено» в списке выбора). */
  async clientsWithAddress(
    therapistId: bigint,
    rawAddress: string,
  ): Promise<string[]> {
    const { address } = guideMarkAddress(rawAddress);
    const rows = await this.prisma.guideMark.findMany({
      where: { therapistId, address },
      select: { clientId: true },
    });
    return rows.map((r) => String(r.clientId));
  }

  /** Создать или поправить: повтор того же адреса тому же клиенту — правка. */
  async save(
    therapistId: bigint,
    clientId: bigint,
    input: GuideMarkInput,
  ): Promise<{ mark: GuideMarkView; created: boolean }> {
    const { address, kind } = guideMarkAddress(input.address);
    await this.relations.assertHasClient(therapistId, clientId);
    const key = { therapistId, clientId, address };
    const before = await this.prisma.guideMark.findUnique({
      where: { therapistId_clientId_address: key },
      select: { id: true },
    });
    const fields = encryptRecord(
      { note: input.note?.trim() || null, snapshot: input.snapshot },
      GUIDE_MARK_SCHEMA,
    );
    const row = await this.prisma.guideMark.upsert({
      where: { therapistId_clientId_address: key },
      create: { ...key, ...fields },
      update: fields,
    });
    const created = !before;
    if (created) await this.trackAdded(therapistId, kind);
    return { mark: toView(row), created };
  }

  async remove(therapistId: bigint, id: number): Promise<void> {
    const row = await this.prisma.guideMark.findFirst({
      where: { id, therapistId },
      select: { clientId: true },
    });
    if (!row) throw new NotFoundException('Guide mark not found');
    await this.relations.assertHasClient(therapistId, row.clientId);
    await this.prisma.guideMark.deleteMany({ where: { id, therapistId } });
  }

  /** Событие новой отметки; копинг (schemaLinks) зовёт его с kind 'coping'. */
  trackAdded(therapistId: bigint, kind: GuideMarkKind): Promise<void> {
    return this.analytics.track(therapistId, 'guide_mark_added', { kind });
  }
}
