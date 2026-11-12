import type { PairsData } from '../apiTypes';

// Что показывает блок «Партнёр» на сайте (решения вынесены из разметки, чтобы
// проверяться тестом): несколько партнёров подряд, «Позвать ещё одного
// человека» при подключённом, ссылка «Ждём партнёра» вместо повторного создания.

/** Ссылка ожидающего приглашения; пусто, если приглашения нет или сервер не отдал ссылку. */
export function pendingInviteUrl(
  data: Pick<PairsData, 'pendingCode' | 'pendingUrl'>,
): string {
  return data.pendingCode ? (data.pendingUrl ?? '') : '';
}

/** Кнопка «пригласить» — пока нет ждущего приглашения или сервер не прислал его ссылку (бот не настроен). */
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
  // «Позвать в пару»: «Пригласить друга» уже звалась строка «Поделиться» (QA 2026-11, М7).
  return o.hasPartners ? 'Позвать ещё одного человека' : 'Позвать в пару';
}

/** Свежая ссылка: не дубль ждущей и только пока приглашение ждёт — отменённая или принятая мертва. */
export function freshInviteUrl(
  inviteUrl: string,
  data: Pick<PairsData, 'pendingCode' | 'pendingUrl'>,
): string {
  const live = inviteUrl && data.pendingCode;
  return live && inviteUrl !== pendingInviteUrl(data) ? inviteUrl : '';
}
