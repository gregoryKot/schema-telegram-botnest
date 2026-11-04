import type { PairsData } from '../apiTypes';

// Что показывает блок «Партнёр» на сайте (решения вынесены из разметки, чтобы
// проверяться тестом). Мини-апп (PairPanel) принимает те же решения: несколько
// партнёров подряд, «Позвать ещё одного человека» при уже подключённом, ссылка
// «⏳ Ждём партнёра» вместо повторного создания.

/** Ссылка ожидающего приглашения; пусто, если приглашения нет или сервер не отдал ссылку. */
export function pendingInviteUrl(
  data: Pick<PairsData, 'pendingCode' | 'pendingUrl'>,
): string {
  return data.pendingCode ? (data.pendingUrl ?? '') : '';
}

/**
 * Кнопка «пригласить» нужна, пока нет ждущего приглашения. Если приглашение
 * есть, а ссылку сервер не прислал (старый ответ, бот не настроен), кнопка
 * остаётся: иначе человек не смог бы получить ссылку заново.
 */
export function canCreateInvite(
  data: Pick<PairsData, 'pendingCode' | 'pendingUrl'>,
): boolean {
  return !data.pendingCode || !data.pendingUrl;
}

export function inviteButtonLabel(o: {
  loading: boolean;
  createError: boolean;
  hasPartners: boolean;
  hasPending: boolean;
}): string {
  if (o.loading) return '...';
  if (o.createError) return 'Не получилось — ещё раз';
  if (o.hasPending) return 'Новая ссылка';
  // «Позвать в пару», а не «Пригласить друга»: так же звалась строка
  // «Поделиться» с карточкой бота — две одинаковые кнопки с разным действием
  // (QA 2026-11, М7).
  return o.hasPartners ? 'Позвать ещё одного человека' : 'Позвать в пару';
}

/** Свежесозданную ссылку не дублируем, если она та же, что у ждущего приглашения. */
export function freshInviteUrl(inviteUrl: string, pendingUrl: string): string {
  return inviteUrl && inviteUrl !== pendingUrl ? inviteUrl : '';
}
