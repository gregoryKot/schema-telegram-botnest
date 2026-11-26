// Вторая строка записи в админке: имя · канал контакт · «запрос».
//
// Вынесено из BookingSection.tsx, потому что у строки появилось состояние, где
// половины частей нет. Ретенция (booking-retention.service.ts, решение
// владельца 2026-10-08) затирает у броней старше 12 месяцев контакт и текст
// запроса, а имя сервер отдаёт как «обезличено». Прежняя разметка клеила
// разделители безусловно, и такая запись печаталась как «обезличено · » —
// висящая точка читается как баг вёрстки, а не как «данные стёрты по сроку».
//
// Разделитель ставится только между частями, которые есть. Чистая функция —
// это логика, а значит обязана приезжать с тестом (правило №2).
import {
  contactChannelLabel,
  isContactChannel,
} from '../../../../shared/src/booking/contactChannel';

export interface BookingContactLineInput {
  clientName: string;
  clientChannel?: string | null;
  clientContact: string;
  message?: string | null;
}

export function bookingContactLine(b: BookingContactLineInput): string {
  const parts: string[] = [];
  if (b.clientName.trim()) parts.push(b.clientName.trim());
  const contact = b.clientContact.trim();
  if (contact) {
    const label = isContactChannel(b.clientChannel)
      ? `${contactChannelLabel(b.clientChannel)} `
      : '';
    parts.push(`${label}${contact}`);
  }
  const message = b.message?.trim();
  if (message) parts.push(`«${message}»`);
  return parts.join(' · ');
}
