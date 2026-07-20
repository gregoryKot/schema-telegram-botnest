import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { encrypt, encryptJson, decrypt } from '../utils/crypto';

// Одноразовая дошифровка исторических строк (аудит 2026-07-20, волна 2).
// Коммит a187ef8 включил шифрование DiaryDraft.data, YSQ-ответов,
// TherapistRequest, алиасов TherapyRelation и EmailToken.email для новых
// записей; строки, записанные ДО того деплоя, остались в БД plaintext.
// Прямого доступа к прод-БД снаружи нет (Amvera), поэтому миграция едет
// внутри приложения: выполняется на старте, один раз, под флагом-гардом.
// BookingSetting — единственный kv в схеме; отдельная таблица ради одного
// флага означала бы лишнюю SQL-миграцию.
const FLAG_KEY = 'encryption_wave2_done';

const isEncrypted = (v: string): boolean => decrypt(v) !== v;

// String-поле: null/пусто/уже шифровано → как есть, иначе шифровать.
const encIf = (val: string | null): string | null =>
  !val || isEncrypted(val) ? val : encrypt(val);

// Json-поле: уже-шифрованная строка → как есть; иначе шифроблоб от значения.
const encJsonIf = (val: unknown): string | null => {
  if (val == null) return null;
  if (typeof val === 'string' && isEncrypted(val)) return val;
  return encryptJson(val);
};

@Injectable()
export class EncryptionWave2Service implements OnApplicationBootstrap {
  private readonly logger = new Logger(EncryptionWave2Service.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    // Ошибка миграции не должна ронять прод: данные читаются и в plaintext
    // (decrypt tolerant), флаг не ставится — повтор на следующем старте.
    await this.run().catch((e: unknown) =>
      this.logger.error(
        `encryption wave2 failed: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );
  }

  /** @returns сколько строк дошифровано (для лога и тестов) */
  async run(): Promise<number> {
    if (!process.env.ENCRYPTION_KEY) return 0; // dev/CI без ключа — не трогаем
    const done = await this.prisma.bookingSetting.findUnique({
      where: { key: FLAG_KEY },
    });
    if (done) return 0;

    let total = 0;

    for (const d of await this.prisma.diaryDraft.findMany()) {
      const enc = encJsonIf(d.data);
      if (enc !== null && enc !== d.data) {
        await this.prisma.diaryDraft.update({
          where: { userId_type: { userId: d.userId, type: d.type } },
          data: { data: enc },
        });
        total++;
      }
    }

    for (const r of await this.prisma.ysqProgress.findMany()) {
      const enc = encJsonIf(r.answers);
      if (enc !== null && enc !== r.answers) {
        await this.prisma.ysqProgress.update({
          where: { userId: r.userId },
          data: { answers: enc },
        });
        total++;
      }
    }
    for (const r of await this.prisma.ysqResult.findMany()) {
      const enc = encJsonIf(r.answers);
      if (enc !== null && enc !== r.answers) {
        await this.prisma.ysqResult.update({
          where: { userId: r.userId },
          data: { answers: enc },
        });
        total++;
      }
    }
    for (const r of await this.prisma.ysqResultHistory.findMany()) {
      const enc = encJsonIf(r.answers);
      if (enc !== null && enc !== r.answers) {
        await this.prisma.ysqResultHistory.update({
          where: { id: r.id },
          data: { answers: enc },
        });
        total++;
      }
    }

    for (const r of await this.prisma.therapistRequest.findMany()) {
      const update: Record<string, string | null> = {};
      const fields = [
        'fullName',
        'qualification',
        'contacts',
        'message',
      ] as const;
      for (const f of fields) {
        const enc = encIf(r[f]);
        if (enc !== r[f]) update[f] = enc;
      }
      if (Object.keys(update).length > 0) {
        await this.prisma.therapistRequest.update({
          where: { id: r.id },
          data: update,
        });
        total++;
      }
    }

    for (const r of await this.prisma.therapyRelation.findMany()) {
      const update: Record<string, string | null> = {};
      for (const f of ['clientAlias', 'virtualClientName'] as const) {
        const enc = encIf(r[f]);
        if (enc !== r[f]) update[f] = enc;
      }
      if (Object.keys(update).length > 0) {
        await this.prisma.therapyRelation.update({
          where: { id: r.id },
          data: update,
        });
        total++;
      }
    }

    for (const t of await this.prisma.emailToken.findMany()) {
      const enc = encIf(t.email);
      if (enc !== t.email && enc !== null) {
        await this.prisma.emailToken.update({
          where: { id: t.id },
          data: { email: enc },
        });
        total++;
      }
    }

    const now = new Date().toISOString();
    await this.prisma.bookingSetting.upsert({
      where: { key: FLAG_KEY },
      update: { value: now },
      create: { key: FLAG_KEY, value: now },
    });
    this.logger.log(`encryption wave2: done, ${total} rows encrypted`);
    return total;
  }
}
