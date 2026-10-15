import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from '../bot/account.service';
import { EmailService } from '../auth/email.service';
import {
  ApplicantProfile,
  Decision,
  decisionMessage,
  loadApplicantProfile,
} from './therapist-request.applicant';

// Доставка решения по заявке на роль терапевта: Telegram (если у аккаунта он
// есть) → письмо на почту аккаунта → logger.error. В проде AlertLogger шлёт
// error владельцу в DM с троттлингом, поэтому отдельный DM не нужен; адрес и
// id в текст не кладём. userId НЕ chat_id: у веб-аккаунта он лежит в
// веб-диапазоне (класс #456), адрес берётся из привязки.

export interface DecisionRequest {
  requestId: number;
  userId: bigint;
  decision: Decision;
  reason?: string;
}

export interface DeliveryDeps {
  prisma: PrismaService;
  accountService: AccountService;
  email: EmailService;
  logger: Logger;
  sendTg: (chatId: bigint, text: string) => Promise<boolean>;
}

const errMsg = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

export async function deliverDecision(
  d: DeliveryDeps,
  a: DecisionRequest,
): Promise<void> {
  const { requestId, userId, decision, reason } = a;
  // Сбой чтения не роняет доставку: форма «ты», почты нет.
  const profile: ApplicantProfile = await loadApplicantProfile(
    d.prisma,
    userId,
  ).catch((e: unknown) => {
    d.logger.warn(`notifyApplicant: профиль не прочитан: ${errMsg(e)}`);
    return { form: 'ty' as const, email: null };
  });
  const chatId = await d.accountService
    .telegramIdsFor([userId])
    .then((m) => m.get(userId.toString()))
    .catch((e: unknown) => {
      d.logger.warn(`notifyApplicant: адрес не найден: ${errMsg(e)}`);
      return undefined;
    });
  const tg = decisionMessage(profile.form, decision, reason, 'tg');
  if (chatId !== undefined && (await d.sendTg(chatId, tg.text))) return;
  if (profile.email) {
    const m = decisionMessage(profile.form, decision, reason, 'email');
    try {
      // EmailService.send без RESEND_API_KEY в проде не бросает, а сам
      // логирует error о мисконфиге — владелец узнаёт оттуда.
      await d.email.send(profile.email, m.subject, m.text);
      return;
    } catch (e) {
      d.logger.warn(`notifyApplicant: письмо не ушло: ${errMsg(e)}`);
    }
  }
  d.logger.error(
    `Решение по заявке #${requestId} (${decision}) не доставлено: ` +
      `${chatId === undefined ? 'нет Telegram' : 'Telegram отказал'}, ` +
      `${profile.email ? 'письмо не ушло' : 'нет почты'}`,
  );
}
