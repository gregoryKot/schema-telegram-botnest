import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { encryptRecord, decryptRecord, EncryptSchema } from '../utils/crypto';

// Declarative encryption schemas — single source of truth, so a newly added
// free-text field can't silently end up in plaintext (just add it here).
const MODE_MAP_SCHEMA: EncryptSchema = {
  strings: ['title'],
  jsonArrays: ['nodes', 'edges'],
};
const CUSTOM_MODE_SCHEMA: EncryptSchema = { strings: ['name'] };
const MODE_MAP_KINDS = ['personality', 'problem', 'couple'] as const;

// Карты режимов (mode maps) терапевта для клиента + кастомные режимы
// терапевта. Доступ к чужому клиенту закрыт через
// TherapyRelationsService.assertHasClient.
@Injectable()
export class ModeMapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relationsService: TherapyRelationsService,
  ) {}

  // ─── Mode Maps ───────────────────────────────────────────────────────────────

  async listModeMaps(therapistId: bigint, clientId: number) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const rows = await this.prisma.modeMap.findMany({
      where: { therapistId, clientId: BigInt(clientId) },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        kind: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map((r) => decryptRecord(r, MODE_MAP_SCHEMA));
  }

  async getModeMap(therapistId: bigint, mapId: number) {
    const row = await this.prisma.modeMap.findUnique({
      where: { id: mapId },
    });
    if (!row || row.therapistId.toString() !== therapistId.toString())
      throw new Error('Not found');
    return decryptRecord(row, MODE_MAP_SCHEMA);
  }

  async createModeMap(
    therapistId: bigint,
    clientId: number,
    title: string,
    kind?: string,
  ) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const k = MODE_MAP_KINDS.includes(kind as (typeof MODE_MAP_KINDS)[number])
      ? kind
      : 'problem';
    const row = await this.prisma.modeMap.create({
      data: {
        therapistId,
        clientId: BigInt(clientId),
        kind: k,
        ...encryptRecord({ title }, MODE_MAP_SCHEMA),
      },
    });
    return decryptRecord({ ...row, nodes: [], edges: [] }, MODE_MAP_SCHEMA);
  }

  async updateModeMap(
    therapistId: bigint,
    mapId: number,
    body: {
      title?: string;
      nodes?: unknown[];
      edges?: unknown[];
    },
  ) {
    const existing = await this.prisma.modeMap.findUnique({
      where: { id: mapId },
    });
    if (!existing || existing.therapistId.toString() !== therapistId.toString())
      throw new Error('Not found');
    const fields: Record<string, unknown> = {};
    if (body.title !== undefined) fields.title = body.title;
    if (body.nodes !== undefined) fields.nodes = body.nodes;
    if (body.edges !== undefined) fields.edges = body.edges;
    const row = await this.prisma.modeMap.update({
      where: { id: mapId },
      data: encryptRecord(fields, MODE_MAP_SCHEMA),
    });
    return decryptRecord(row, MODE_MAP_SCHEMA);
  }

  async deleteModeMap(therapistId: bigint, mapId: number) {
    const existing = await this.prisma.modeMap.findUnique({
      where: { id: mapId },
    });
    if (!existing || existing.therapistId.toString() !== therapistId.toString())
      throw new Error('Not found');
    await this.prisma.modeMap.delete({ where: { id: mapId } });
  }

  // ─── Client's read-only view of their own maps ───────────────────────────────

  async listMyModeMaps(userId: bigint) {
    const rows = await this.prisma.modeMap.findMany({
      where: { clientId: userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, kind: true, updatedAt: true },
    });
    return rows.map((r) => decryptRecord(r, MODE_MAP_SCHEMA));
  }

  async getMyModeMap(userId: bigint, mapId: number) {
    const row = await this.prisma.modeMap.findUnique({
      where: { id: mapId },
    });
    if (!row || row.clientId.toString() !== userId.toString())
      throw new Error('Not found');
    return decryptRecord(row, MODE_MAP_SCHEMA);
  }

  // ─── Therapist Custom Modes ──────────────────────────────────────────────────

  async listCustomModes(therapistId: bigint) {
    const rows = await this.prisma.therapistCustomMode.findMany({
      where: { therapistId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => decryptRecord(r, CUSTOM_MODE_SCHEMA));
  }

  async createCustomMode(
    therapistId: bigint,
    body: { name: string; emoji?: string; nodeType?: string },
  ) {
    const allowed = [
      'trigger',
      'child',
      'critic',
      'coping',
      'healthy',
      'custom',
    ];
    const nodeType = allowed.includes(body.nodeType ?? '')
      ? body.nodeType
      : 'custom';
    const row = await this.prisma.therapistCustomMode.create({
      data: {
        therapistId,
        nodeType,
        emoji: (body.emoji ?? '⬡').slice(0, 8),
        ...encryptRecord({ name: body.name.slice(0, 80) }, CUSTOM_MODE_SCHEMA),
      },
    });
    return decryptRecord(row, CUSTOM_MODE_SCHEMA);
  }

  async deleteCustomMode(therapistId: bigint, modeId: number) {
    await this.prisma.therapistCustomMode.deleteMany({
      where: { id: modeId, therapistId },
    });
  }
}
