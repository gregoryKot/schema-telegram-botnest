import { mskStamp } from '../utils/owner-card';

// Заявка на роль терапевта у владельца. Telegram — номер, дата подачи и кнопки
// решения; ФИО, квалификация, контакты и сообщение — только в письме.

/** Заявка целиком — для письма владельцу. */
export interface TherapistRequestFull {
  id: number;
  userId: bigint;
  fullName: string;
  qualification: string;
  contacts: string;
  message: string | null;
}

/** Строка Telegram-карточки: где данные заявителя. */
export const REQUEST_DATA_LINE =
  '📧 Имя, квалификация и контакты — в письме на почте.';

/** Кнопки решения: callback несёт только id заявки. */
export function decisionKeyboard(id: number) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `treq:approve:${id}` },
        { text: '❌ Reject', callback_data: `treq:reject:${id}` },
      ],
    ],
  };
}

/** Telegram-карточка заявки (DM при подаче и строка /zayavki): без данных заявителя. */
export function therapistRequestCard(req: {
  id: number;
  createdAt?: Date | null;
}): string {
  return [
    `🩺 <b>Заявка на роль терапевта #${req.id}</b>`,
    req.createdAt ? `Подана: ${mskStamp(req.createdAt)}` : null,
    REQUEST_DATA_LINE,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Письмо владельцу: полные данные заявки, решение — кнопками в Telegram. */
export function therapistRequestEmail(req: TherapistRequestFull): string {
  return (
    `Новая заявка на роль терапевта #${req.id}\n\n` +
    `Имя: ${req.fullName}\n` +
    `Квалификация: ${req.qualification}\n` +
    `Контакты: ${req.contacts}\n` +
    (req.message ? `Сообщение: ${req.message}\n` : '') +
    `Telegram ID: ${req.userId}\n\n` +
    `Решение — кнопками в Telegram-карточке заявки или командой /zayavki в боте.`
  );
}
