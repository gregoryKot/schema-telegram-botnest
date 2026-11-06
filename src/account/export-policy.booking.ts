// Колонки брони в выгрузке данных (EXPORT_POLICY.Booking, export-policy.ts):
// только записи из приложения (Booking.userId, #546). Явный список, как у
// USER_EXPORT_SELECT: новая колонка не уедет в файл молча и не пропадёт
// молча — export-policy.spec.ts требует, чтобы каждая колонка модели была
// либо в `select`, либо в `omit` с причиной. Отдельный файл — правило №10.
export const BOOKING_EXPORT_COLUMNS = {
  select: {
    id: true,
    startsAt: true,
    durationMin: true,
    type: true,
    status: true,
    heldUntil: true,
    clientName: true,
    clientContact: true,
    clientChannel: true,
    message: true,
    meetingUrl: true,
    source: true,
    clientTimeZone: true,
    acceptedOfferAt: true,
    anonymizedAt: true,
    paidAt: true,
    amount: true,
    currency: true,
    createdAt: true,
    updatedAt: true,
  },
  omit: {
    userId: 'это сам человек — ключ выборки, не данные',
    clientTelegramId:
      'адрес человека в Telegram — он уже есть в выгрузке среди способов входа',
    cancelToken:
      'ключ ссылки управления записью: попав с файлом к другому, дал бы отменить запись',
    calDavUid:
      'служебный id события в календаре владельца практики, не данные человека',
    confirmEffectsDoneAt:
      'служебная отметка, что владельцу ушли уведомления о подтверждении',
    reminder24SentAt:
      'служебная отметка напоминания владельцу практики за сутки',
    reminder2SentAt:
      'служебная отметка напоминания владельцу практики за два часа',
  },
} satisfies {
  select: Record<string, true>;
  omit: Record<string, string>;
};
