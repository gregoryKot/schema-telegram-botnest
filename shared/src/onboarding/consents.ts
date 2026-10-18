import type { OnboardingStep } from '../share/analytics';

// Экран согласий при первом входе (сайт внутри Telegram/MAX). Тексты — те же,
// что в визарде мини-аппа (`Disclaimer*Step`), но живут здесь: новый общий
// контент сразу в shared (правило №3). Шаги welcome/home_screen не нужны —
// приветствие в онбординге «Сегодня», значок на экран — отдельная карточка.

/** Шаги аналитики `onboarding_step`, которые показывает экран согласий. */
export const CONSENT_ANALYTICS_STEPS: readonly OnboardingStep[] = [
  'privacy',
  'not_therapy',
];

/** Принять согласие можно только когда стоят ОБЕ галочки. */
export function consentsReady(privacy: boolean, notTherapy: boolean): boolean {
  return privacy && notTherapy;
}

export const CONSENT_PRIVACY_TITLE = 'Данные и конфиденциальность';
export const CONSENT_PRIVACY_CHECK =
  'Мне есть 18 лет, и я принимаю обработку персональных данных — включая сведения о моём психоэмоциональном состоянии, которые я добровольно вношу, — согласно Политике конфиденциальности';
export const CONSENT_NOT_THERAPY_TITLE = 'Важно знать';
export const CONSENT_NOT_THERAPY_CHECK =
  'Я понимаю, что это инструмент самоисследования, а не клиническая диагностика';

/** Абзацы шага «Приватность»; вместо «Telegram-аккаунту» мини-аппа — «учётной записи»: вход бывает и не из Telegram. */
export const CONSENT_PRIVACY_PARAGRAPHS: readonly string[] = [
  'Все данные хранятся на защищённом сервере, зашифрованы и привязаны к учётной записи. Не передаются третьим лицам — кроме терапевта, если позже подключить его по коду по собственному решению.',
  'Записи и ответы на опросники могут касаться психоэмоционального состояния — на обработку таких сведений даётся отдельное согласие ниже.',
  'Удалить все данные можно прямо в приложении — Настройки → «Удалить все данные». Сервис предназначен для пользователей старше 18 лет.',
];

export const CONSENT_NOT_THERAPY_TEXT =
  '«Всё по схеме» — инструмент самоисследования. Оценки, тесты и упражнения внутри не ставят клинический диагноз и не заменяют работу с психологом.';

/** Подсказка, чего не хватает для кнопки «Начать». */
export function consentHint(
  privacy: boolean,
  notTherapy: boolean,
  tr: (ty: string, vy: string) => string,
): string | null {
  if (privacy && notTherapy) return null;
  if (!privacy && !notTherapy) {
    return tr('Отметь оба согласия', 'Отметьте оба согласия');
  }
  return tr('Отметь оставшееся согласие', 'Отметьте оставшееся согласие');
}
