// Unified therapist contact helper.
// App.tsx writes to localStorage on init; all components read from here.

const AUTHOR_TG = 'https://t.me/kotlarewski';
const AUTHOR_BOOKING = 'https://kotlarewski.gr/#booking';
const AUTHOR_NAME = 'автору';

// name — НЕ личное имя, а нейтральная подпись в дательном падеже для CTA
// («Написать терапевту»). Личные имена в кнопки не подставляются: «Написать
// Григорий» ломает падеж и светит имя там, где его быть не должно.
const NEUTRAL_NAMES = ['терапевту', 'вам', AUTHOR_NAME];

export interface TherapistContact {
  url: string; // tg:// or https://t.me/
  bookingUrl: string; // same url if no separate booking
  name: string; // нейтральная подпись CTA (дательный падеж), не личное имя
  isTherapist: boolean; // user IS the therapist
}

export function getTherapistContact(): TherapistContact {
  const url = localStorage.getItem('therapy_contact_url');
  const name = localStorage.getItem('therapy_contact_name');
  const isTh = localStorage.getItem('therapy_is_therapist') === '1';
  if (url && name) {
    // Кэш от старой версии мог содержать личное имя — заменяем нейтральным.
    const safeName = NEUTRAL_NAMES.includes(name)
      ? name
      : isTh
        ? 'вам'
        : 'терапевту';
    return { url, bookingUrl: url, name: safeName, isTherapist: isTh };
  }
  return {
    url: AUTHOR_TG,
    bookingUrl: AUTHOR_BOOKING,
    name: AUTHOR_NAME,
    isTherapist: false,
  };
}

/** Call from App.tsx after profile + relation are loaded. */
export function cacheTherapistContact(opts: {
  role: 'CLIENT' | 'THERAPIST';
  partnerId: number | null;
  partnerName: string | null;
  myId: number | null;
  myName: string | null;
}) {
  if (opts.role === 'THERAPIST') {
    // Therapist sees themselves. Личные имена не сохраняем (см. NEUTRAL_NAMES).
    const id = opts.myId;
    localStorage.setItem(
      'therapy_contact_url',
      id ? `tg://user?id=${id}` : AUTHOR_TG,
    );
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
  } else if (opts.partnerId) {
    // Client with linked therapist. Личные имена не сохраняем.
    localStorage.setItem(
      'therapy_contact_url',
      `tg://user?id=${opts.partnerId}`,
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
