import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { encrypt, decrypt, encryptJson, decryptJson } from '../utils/crypto';
import { findSessionNotesPage } from './session-notes-page';
import { nextConceptHistory } from './concept-history';

const CONCEPT_TEXT_FIELDS = [
  'earlyExperience',
  'unmetNeeds',
  'triggers',
  'copingStyles',
  'goals',
  'currentProblems',
  'modeTransitions',
] as const;

// JSON-массивы: метки схем/режимов, карта режимов (узлы и рёбра), связи
// режимов (alias, истоки, проявления, работа в терапии) и схем (убеждение,
// детский опыт) — клинические данные, шифруются целиком. Новое поле такого рода = строка здесь (и в
// encryption-policy / rotate-encryption/targets).
const CONCEPT_JSON_ARRAY_FIELDS = [
  'schemaIds',
  'modeIds',
  'modeMapNodes',
  'modeMapEdges',
  'modeLinks',
  'schemaLinks',
] as const;

function encryptConceptFields(
  body: Record<string, unknown>,
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const f of CONCEPT_TEXT_FIELDS) {
    if (f in body) result[f] = encrypt(body[f] as string | null | undefined);
  }
  // Encrypted JSON string (plaintext-tolerant on read).
  for (const f of CONCEPT_JSON_ARRAY_FIELDS) {
    const v = body[f];
    if (f in body && Array.isArray(v)) {
      result[f] = encryptJson(v) ?? JSON.stringify(v);
    }
  }
  return result;
}

function decryptConceptFields(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const f of CONCEPT_TEXT_FIELDS) {
    result[f] = row[f] != null ? decrypt(row[f] as string) : null;
  }
  // Legacy rows have plain JSON arrays; new rows have encrypted strings. Нет
  // значения (старый снапшот истории, строка до колонки modeLinks) — [].
  for (const f of CONCEPT_JSON_ARRAY_FIELDS) {
    const v = row[f];
    if (v == null) result[f] = [];
    else if (typeof v === 'string') result[f] = decryptJson<unknown[]>(v) ?? [];
    else result[f] = v;
  }
  return result;
}

function decryptConceptSnapshot(
  snap: Record<string, unknown>,
): Record<string, unknown> {
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

  async getNotes(therapistId: bigint, clientId: bigint) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    return findSessionNotesPage(this.prisma, therapistId, clientId);
  }

  async createNote(
    therapistId: bigint,
    clientId: bigint,
    body: { date: string; text: string },
  ) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const note = await this.prisma.therapistNote.create({
      data: {
        therapistId,
        clientId,
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

  async getConceptualization(therapistId: bigint, clientId: bigint) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const tid = therapistId;
    const cid = clientId;
    const row = await this.prisma.clientConceptualization.findUnique({
      where: { therapistId_clientId: { therapistId: tid, clientId: cid } },
    });
    if (!row) return null;
    const history = Array.isArray(row.history)
      ? (row.history as Record<string, unknown>[]).map(decryptConceptSnapshot)
      : [];
    return { ...row, ...decryptConceptFields(row), history };
  }

  async saveConceptualization(
    therapistId: bigint,
    clientId: bigint,
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
      modeLinks?: unknown[];
      schemaLinks?: unknown[];
    },
  ) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const tid = therapistId;
    const cid = clientId;
    const enc = encryptConceptFields(body);
    const nowMs = Date.now();

    // Read-modify-write по history-массиву — в транзакции (аудит 2026-07,
    // 2.3): две вкладки/двойной клик гонялись за одним прочитанным history →
    // потерянный или задвоенный snapshot.
    const { saved, history } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.clientConceptualization.findUnique({
        where: { therapistId_clientId: { therapistId: tid, clientId: cid } },
      });

      // Снимок прежнего состояния — один на сессию правки (окно склейки,
      // concept-history.ts), иначе автосохранение сайта выжигает историю.
      const hist = nextConceptHistory(
        existing && Array.isArray(existing.history) ? existing.history : [],
        existing,
        nowMs,
      );

      // Частичный апдейт: пишем только те поля, что реально пришли в body.
      const bodyMap = body as Record<string, unknown>;
      const update: Prisma.ClientConceptualizationUpdateInput = {
        history: hist as Prisma.InputJsonValue,
      };
      for (const [k, v] of Object.entries(enc)) {
        if (bodyMap[k] !== undefined) {
          (update as Record<string, string | null>)[k] = v;
        }
      }

      const row = await tx.clientConceptualization.upsert({
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
          modeLinks: enc.modeLinks ?? [],
          schemaLinks: enc.schemaLinks ?? [],
          history: [],
        },
        update,
      });
      return { saved: row, history: hist };
    });

    return {
      ...saved,
      ...decryptConceptFields(saved),
      history: history.map((h) =>
        decryptConceptSnapshot(h as Record<string, unknown>),
      ),
    };
  }
}
