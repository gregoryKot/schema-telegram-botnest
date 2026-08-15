import { AddressForm, t } from '../notification/address-form';

// Тексты уведомлений по заявке терапевта — отдельно от сервиса, чтобы
// контент правился без роста therapist-request.service.ts (правило №10).

export function applicantDecisionText(
  form: AddressForm,
  decision: 'approved' | 'rejected',
  reason?: string,
): string {
  return decision === 'approved'
    ? t(
        form,
        '✅ Твоя заявка на роль терапевта одобрена. Перезапусти приложение, чтобы увидеть кабинет терапевта.',
        '✅ Ваша заявка на роль терапевта одобрена. Перезапустите приложение, чтобы увидеть кабинет терапевта.',
      )
    : t(
        form,
        `❌ Твоя заявка на роль терапевта отклонена.${reason ? `\n\nПричина: ${reason}` : ''}`,
        `❌ Ваша заявка на роль терапевта отклонена.${reason ? `\n\nПричина: ${reason}` : ''}`,
      );
}

export function adminRequestText(req: {
  id: number;
  userId: bigint;
  fullName: string;
  qualification: string;
  contacts: string;
  message: string | null;
}): string {
  return (
    `Новая заявка на роль терапевта #${req.id}\n\n` +
    `Имя: ${req.fullName}\n` +
    `Квалификация: ${req.qualification}\n` +
    `Контакты: ${req.contacts}\n` +
    (req.message ? `Сообщение: ${req.message}\n` : '') +
    `Telegram ID: ${req.userId}\n\n` +
    `Одобрить/отклонить: открой бот и напиши /zayavki`
  );
}
