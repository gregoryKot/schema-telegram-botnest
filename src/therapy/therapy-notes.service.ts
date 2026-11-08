import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { encrypt } from '../utils/crypto';
import { requireAffected } from '../utils/require-affected';
import { findSessionNotesPage } from './session-notes-page';
import {
  conceptView,
  encryptConceptFields,
  writeConceptWithHistory,
} from './concept-store';

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
    const where = { id: noteId, therapistId };
    await requireAffected(this.prisma.therapistNote.deleteMany({ where }));
  }

  // ─── Case Conceptualization ──────────────────────────────────────────────────

  async getConceptualization(therapistId: bigint, clientId: bigint) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const row = await this.prisma.clientConceptualization.findUnique({
      where: { therapistId_clientId: { therapistId, clientId } },
    });
    return row ? conceptView(row, row.history) : null;
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
    const key = { therapistId, clientId };
    const enc = encryptConceptFields(body);
    const nowMs = Date.now();
    // Read-modify-write по history-массиву — в транзакции (аудит 2026-07,
    // 2.3): две вкладки/двойной клик гонялись за одним прочитанным history →
    // потерянный или задвоенный snapshot.
    const { row, history } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.clientConceptualization.findUnique({
        where: { therapistId_clientId: key },
      });
      return writeConceptWithHistory(tx, key, existing, enc, nowMs);
    });
    return conceptView(row, history);
  }
}
