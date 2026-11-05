// Unified therapist contact: App.tsx writes to localStorage on init, components read from here.
import type { UserId } from '../userId';

export const AUTHOR_TG = 'https://t.me/kotlarewski';
/** Визитка автора; запись — якорь #booking (с меткой источника — therapy/bridge/therapyBridgeLinks.ts). */
export const AUTHOR_SITE = 'https://kotlarewski.gr/';
const AUTHOR_BOOKING = `${AUTHOR_SITE}#booking`;
const AUTHOR_NAME = 'автору';

// name — НЕ личное имя, а нейтральная подпись в дательном падеже для CTA
// («Написать терапевту»). Личные имена в кнопки не подставляются: «Написать
// Григорий» ломает падеж и светит имя там, где его быть не должно.
const NEUTRAL_NAMES = ['терапевту', 'вам', AUTHOR_NAME];

export interface TherapistContact {
  /** tg:// или https://t.me/; null — терапевт подключён, но написать ему из
   * приложения некуда (веб-аккаунт без Telegram, QA 2026-11 З6). */
  url: string | null;
  bookingUrl: string | null; // same url if no separate booking
  name: string; // нейтральная подпись CTA (дательный падеж), не личное имя
  isTherapist: boolean; // user IS the therapist
}

// Веб-аккаунты (Google, почта, VK, MAX) получают номер из [1e15, 9e15)
// (src/auth/user-id-range.ts; сверка — user-id-range.parity.spec.ts). Чата в
// Telegram по такому номеру нет: tg://user?id=<веб-id> вёл в никуда.
export const WEB_USER_ID_MIN = '1000000000000000';

/** Ссылка на чат в Telegram по номеру; веб-номер и мусор — null. */
export function telegramChatUrl(id: UserId): string | null {
  const s = String(id);
  if (!/^\d+$/.test(s) || BigInt(s) >= BigInt(WEB_USER_ID_MIN)) return null;
  return `tg://user?id=${s}`;
}

export function getTherapistContact(): TherapistContact {
  const url = localStorage.getItem('therapy_contact_url');
  const name = localStorage.getItem('therapy_contact_name');
  const isTh = localStorage.getItem('therapy_is_therapist') === '1';
  if (url !== null && name) {
    // Кэш от старой версии мог содержать личное имя — заменяем нейтральным.
    const safeName = NEUTRAL_NAMES.includes(name)
      ? name
      : isTh
        ? 'вам'
        : 'терапевту';
    // Пустая строка — терапевт есть, канала нет (cacheTherapistContact).
    const link = url || null;
    return { url: link, bookingUrl: link, name: safeName, isTherapist: isTh };
  }
  return {
    url: AUTHOR_TG,
    bookingUrl: AUTHOR_BOOKING,
    name: AUTHOR_NAME,
    isTherapist: false,
  };
}

/** К пользователю подключён личный терапевт (а не «автор» по умолчанию). */
export function hasConnectedTherapist(
  contact: TherapistContact = getTherapistContact(),
): boolean {
  return contact.name !== AUTHOR_NAME;
}

// Готовая CTA-кнопка «написать терапевту». Главное — когда сам пользователь
// является терапевтом (isTherapist), «Написать вам» бессмысленно: возвращаем
// isSelf=true, и вызывающий не показывает кнопку «написать себе».
export interface ContactCta {
  /** Кнопку «написать» не показывать: пользователь сам специалист или
   * написать терапевту из приложения некуда (url нет). */
  isSelf: boolean;
  /** Готовая подпись со стрелкой (пусто при isSelf). */
  label: string;
  url: string;
}

export function contactCta(
  contact: TherapistContact = getTherapistContact(),
): ContactCta {
  if (contact.isTherapist || contact.url === null) {
    return { isSelf: true, label: '', url: contact.url ?? '' };
  }
  const label =
    contact.name === AUTHOR_NAME
      ? 'Записаться на консультацию →'
      : `Написать ${contact.name} →`;
  return { isSelf: false, label, url: contact.url };
}

/**
 * Кэш клиента по его связи: null — терапевта нет, мост ведёт к автору. Одна
 * точка для старта, входа по ссылке, подключения кодом и отключения (QA
 * 2026-11-05: после «Отключиться» в «Ещё» до перезагрузки висело «Написать
 * терапевту» бывшему терапевту — кэш чистил только следующий старт).
 */
export function cacheClientRelation(
  rel: { partnerId: UserId | null; partnerName?: string | null } | null,
): void {
  cacheTherapistContact({
    role: 'CLIENT',
    partnerId: rel?.partnerId ?? null,
    partnerName: rel?.partnerName ?? null,
    myId: null,
    myName: null,
  });
}

/** Call from App.tsx after profile + relation are loaded. */
export function cacheTherapistContact(opts: {
  role: 'CLIENT' | 'THERAPIST';
  partnerId: UserId | null;
  partnerName: string | null;
  myId: number | null;
  myName: string | null;
}) {
  if (opts.role === 'THERAPIST') {
    // Therapist sees themselves. Личные имена не сохраняем (см. NEUTRAL_NAMES).
    const id = opts.myId;
    localStorage.setItem(
      'therapy_contact_url',
      id ? (telegramChatUrl(id) ?? '') : AUTHOR_TG,
    );
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
  } else if (opts.partnerId) {
    // Client with linked therapist. Личные имена не сохраняем. Терапевт с
    // веб-аккаунтом — канала нет: пустая строка, а не tg:// на веб-номер.
    localStorage.setItem(
      'therapy_contact_url',
      telegramChatUrl(opts.partnerId) ?? '',
    );
    localStorage.setItem('therapy_contact_name', 'терапевту');
    localStorage.removeItem('therapy_is_therapist');
  } else {
    // No therapist → author
    localStorage.removeItem('therapy_contact_url');
    localStorage.removeItem('therapy_contact_name');
    localStorage.removeItem('therapy_is_therapist');
  }
}
