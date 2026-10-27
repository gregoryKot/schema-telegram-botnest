import type { TherapyNudgePlace } from '../../analytics/therapyNudge';
import { AUTHOR_SITE, AUTHOR_TG } from '../../utils/therapistContact';

// Адреса «моста к терапевту». Литералы живут в utils/therapistContact.ts.

/** Запись на сайте автора; `from=app_<место>` доезжает до заявки (leadSource). */
export function bookingUrl(place: TherapyNudgePlace): string {
  return `${AUTHOR_SITE}?from=app_${place}#booking`;
}

/** Личный Telegram автора. */
export function telegramUrl(): string {
  return AUTHOR_TG;
}
