import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { encrypt } from '../utils/crypto';
import { requireAffected } from '../utils/require-affected';
import { findSessionNotesPage } from './session-notes-page';
import { conceptView } from './concept-store';
import { saveConceptVersioned, type ConceptSaveInput } from './concept-save';

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

  /** Полное тело или патч с версией строки — concept-save.ts. */
  async saveConceptualization(
    therapistId: bigint,
    clientId: bigint,
    body: ConceptSaveInput,
  ) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    // Read-modify-write по history и связям — в транзакции (аудит 2026-07,
    // 2.3; правило №4), версия строки — там же.
    return saveConceptVersioned(this.prisma, { therapistId, clientId }, body);
  }
}
