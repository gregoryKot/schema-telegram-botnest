// Unified therapist contact helper.
// App.tsx writes to localStorage on init; all components read from here.

const AUTHOR_TG = 'https://t.me/kotlarewski';
const AUTHOR_BOOKING = 'https://cal.com/kotlarewski';
const AUTHOR_NAME = 'автору';

export interface TherapistContact {
  url: string;         // tg:// or https://t.me/
  bookingUrl: string;  // same url if no separate booking
  name: string;        // display name
  isTherapist: boolean; // user IS the therapist
}

export function getTherapistContact(): TherapistContact {
  const url  = localStorage.getItem('therapy_contact_url');
  const name = localStorage.getItem('therapy_contact_name');
  const isTh = localStorage.getItem('therapy_is_therapist') === '1';
  if (url && name) {
    return { url, bookingUrl: url, name, isTherapist: isTh };
  }
  return { url: AUTHOR_TG, bookingUrl: AUTHOR_BOOKING, name: AUTHOR_NAME, isTherapist: false };
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
    // Therapist sees themselves
    const id = opts.myId;
    localStorage.setItem('therapy_contact_url',  id ? `tg://user?id=${id}` : AUTHOR_TG);
    localStorage.setItem('therapy_contact_name', opts.myName ?? 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
  } else if (opts.partnerId) {
    // Client with linked therapist
    localStorage.setItem('therapy_contact_url',  `tg://user?id=${opts.partnerId}`);
    localStorage.setItem('therapy_contact_name', opts.partnerName ?? 'терапевту');
    localStorage.removeItem('therapy_is_therapist');
  } else {
    // No therapist → author
    localStorage.removeItem('therapy_contact_url');
    localStorage.removeItem('therapy_contact_name');
    localStorage.removeItem('therapy_is_therapist');
  }
}
