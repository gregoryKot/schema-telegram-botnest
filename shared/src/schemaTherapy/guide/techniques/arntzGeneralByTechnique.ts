import {
  confrontationArntz4,
  limitSettingArntz4,
  reparentingArntz4,
} from './arntzGeneralMore';

/** Дополнения гл. 4 Арнтц и Якоб к «Подробнее» техник по id. */
export const ARNTZ_GENERAL_BY_TECHNIQUE: Record<string, string[]> = {
  empathic_confrontation: confrontationArntz4,
  limited_reparenting: reparentingArntz4,
  limit_setting: limitSettingArntz4,
};
