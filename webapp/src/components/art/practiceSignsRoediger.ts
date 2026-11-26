// Знаки «Для терапевта» по Рёдигеру: два полюса потребностей — знак потребности в автономии (стебель на опоре: второй полюс рядом с привязанностью); баланс сессии — две оси.
import type { GuideSign } from './guideSignsModel';
export const ROEDIGER_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  attachment_assertiveness_poles: 'need_autonomy',
  session_balance_axes: 'balance_axes',
};
