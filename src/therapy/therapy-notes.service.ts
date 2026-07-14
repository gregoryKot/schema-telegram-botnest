import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { encrypt, decrypt, encryptJson, decryptJson } from '../utils/crypto';

const CONCEPT_TEXT_FIELDS = [
  'earlyExperience',
  'unmetNeeds',
  'triggers',
  'copingStyles',
  'goals',
  'currentProblems',
  'modeTransitions',
] as const;

function encryptConceptFields(body: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const f of CONCEPT_TEXT_FIELDS) {
    if (f in body) result[f] = body[f] != null ? encrypt(body[f]) : null;
  }
  // Clinical labels — encrypted JSON string (plaintext-tolerant on read).
  if ('schemaIds' in body && Array.isArray(body.schemaIds)) {
    result.schemaIds =
      encryptJson(body.schemaIds) ?? JSON.stringify(body.schemaIds);
  }
  if ('modeIds' in body && Array.isArray(body.modeIds)) {
    result.modeIds = encryptJson(body.modeIds) ?? JSON.stringify(body.modeIds);
  }
  // Mode map — nodes and edges contain sensitive clinical data, must be encrypted.
  if ('modeMapNodes' in body && Array.isArray(body.modeMapNodes)) {
    result.modeMapNodes =
      encryptJson(body.modeMapNodes) ?? JSON.stringify(body.modeMapNodes);
  }
  if ('modeMapEdges' in body && Array.isArray(body.modeMapEdges)) {
    result.modeMapEdges =
      encryptJson(body.modeMapEdges) ?? JSON.stringify(body.modeMapEdges);
  }
  return result;
}

function decryptConceptFields(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const f of CONCEPT_TEXT_FIELDS) {
    result[f] = row[f] != null ? decrypt(row[f]) : null;
  }
  // schemaIds / modeIds / modeMapNodes / modeMapEdges: legacy rows have JSON arrays;
  // new rows have encrypted strings.
  for (const f of ['schemaIds', 'modeIds']) {
    const v = row[f];
    if (v == null) {
      result[f] = [];
      continue;
    }
    if (typeof v === 'string') result[f] = decryptJson<string[]>(v) ?? [];
    else result[f] = v;
  }
  for (const f of ['modeMapNodes', 'modeMapEdges']) {
    const v = row[f];
    if (v == null) {
      result[f] = [];
      continue;
    }
    if (typeof v === 'string') result[f] = decryptJson<unknown[]>(v) ?? [];
    else result[f] = v;
  }
  return result;
}

function decryptConceptSnapshot(
  snap: Record<string, any>,
): Record<string, any> {
  return { ...snap, ...decryptConceptFields(snap) };
}

// Заметки терапевта о сессиях + кейс-концептуализация клиента (включая
// историю версий). Доступ к чужому клиенту закрыт через
// TherapyRelationsService.assertHasClient — текст проверки не дублируется.
@Injectable()
export class TherapyNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relationsService: TherapyRelationsService,
  ) {}

  // ─── Session Notes ───────────────────────────────────────────────────────────

  async getNotes(therapistId: bigint, clientId: number) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const tid = therapistId;
    const cid = BigInt(clientId);
    const rows = await this.prisma.therapistNote.findMany({
      where: { therapistId: tid, clientId: cid },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({ ...r, text: decrypt(r.text) ?? r.text }));
  }

  async createNote(
    therapistId: bigint,
    clientId: number,
    body: { date: string; text: string },
  ) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const note = await this.prisma.therapistNote.create({
      data: {
        therapistId,
        clientId: BigInt(clientId),
        date: body.date,
        text: encrypt(body.text) ?? body.text,
      },
    });
    return { ...note, text: body.text }; // return plaintext to caller
  }

  async deleteNote(therapistId: bigint, noteId: number): Promise<void> {
    await this.prisma.therapistNote.deleteMany({
      where: { id: noteId, therapistId },
    });
  }

  // ─── Case Conceptualization ──────────────────────────────────────────────────

  async getConceptualization(therapistId: bigint, clientId: number) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const tid = therapistId;
    const cid = BigInt(clientId);
    const row = await this.prisma.clientConceptualization.findUnique({
      where: { therapistId_clientId: { therapistId: tid, clientId: cid } },
    });
    if (!row) return null;
    const history = Array.isArray(row.history)
      ? (row.history as any[]).map(decryptConceptSnapshot)
      : [];
    return { ...row, ...decryptConceptFields(row), history };
  }

  async saveConceptualization(
    therapistId: bigint,
    clientId: number,
    body: {
      schemaIds?: string[];
      modeIds?: string[];
      earlyExperience?: string;
      unmetNeeds?: string;
      triggers?: string;
      copingStyles?: string;
      goals?: string;
      currentProblems?: string;
      modeTransitions?: string;
      modeMapNodes?: unknown[];
      modeMapEdges?: unknown[];
    },
  ) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const tid = therapistId;
    const cid = BigInt(clientId);
    const enc = encryptConceptFields(body);
    const now = new Date().toISOString();

    // Read-modify-write по history-массиву — в транзакции (аудит 2026-07,
    // 2.3): две вкладки/двойной клик гонялись за одним прочитанным history →
    // потерянный или задвоенный snapshot.
    const { saved, history } = await this.prisma.$transaction(async (tx) => {
      // Fetch current state to push to history before overwriting
      const existing = await tx.clientConceptualization.findUnique({
        where: { therapistId_clientId: { therapistId: tid, clientId: cid } },
      });

      let hist: any[] = Array.isArray(existing?.history)
        ? (existing.history as any[])
        : [];

      if (existing) {
        // Snapshot current state into history (max 20 snapshots)
        const snapshot = {
          savedAt: now,
          schemaIds: existing.schemaIds,
          modeIds: existing.modeIds,
          earlyExperience: existing.earlyExperience,
          unmetNeeds: existing.unmetNeeds,
          triggers: existing.triggers,
          copingStyles: existing.copingStyles,
          goals: existing.goals,
          currentProblems: existing.currentProblems,
          modeTransitions: (existing as any).modeTransitions ?? null,
        };
        hist = [snapshot, ...hist].slice(0, 20);
      }

      const row = await (tx.clientConceptualization.upsert as any)({
        where: { therapistId_clientId: { therapistId: tid, clientId: cid } },
        create: {
          therapistId: tid,
          clientId: cid,
          // schemaIds / modeIds taken from `enc` — encrypted blob.
          schemaIds: enc.schemaIds ?? [],
          modeIds: enc.modeIds ?? [],
          earlyExperience: enc.earlyExperience ?? null,
          unmetNeeds: enc.unmetNeeds ?? null,
          triggers: enc.triggers ?? null,
          copingStyles: enc.copingStyles ?? null,
          goals: enc.goals ?? null,
          currentProblems: enc.currentProblems ?? null,
          modeTransitions: enc.modeTransitions ?? null,
          modeMapNodes: enc.modeMapNodes ?? [],
          modeMapEdges: enc.modeMapEdges ?? [],
          history: [],
        },
        update: {
          ...Object.fromEntries(
            Object.entries(enc).filter(([k]) => body[k] !== undefined),
          ),
          history: hist,
        },
      });
      return { saved: row, history: hist };
    });

    return {
      ...saved,
      ...decryptConceptFields(saved),
      history: history.map(decryptConceptSnapshot),
    };
  }
}
