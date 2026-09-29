import { CONFIRM_NOTICE_HINT } from './IntroConfirmNotice';

export type InvalidField = 'name' | 'contact' | 'confirmNotice' | 'consent';
export const FIELD_HINTS: Record<InvalidField, string> = {
  name: 'Как к вам обращаться?',
  contact: 'Оставьте Telegram или телефон — пришлю подтверждение',
  confirmNotice: CONFIRM_NOTICE_HINT,
  consent: 'Нужно согласие на обработку данных',
};
