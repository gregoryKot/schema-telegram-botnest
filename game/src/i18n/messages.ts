// AUTO-DERIVED message catalog. Co-located ru/en — editing one language can't
// silently break the other, and `satisfies` makes a missing translation a compile
// error. Add a line here, reference by key via t('m_...'). Interpolation: use
// {name} placeholders and pass vars to t(key, { name: value }).
import { WEEK } from './week';
export interface Msg { ru: string; en: string; }
export const M = {
  m_rotate_line: { ru: "поверни телефон — игра идёт в альбомной", en: "rotate your phone to play in landscape" },
  m_surrender: { ru: "УСТУПИ", en: "SURRENDER" },
  m_avoid: { ru: "ИЗБЕГАЙ", en: "AVOID" },
  m_fight: { ru: "БЕЙ", en: "FIGHT" },
  m_menu: { ru: "Меню", en: "Menu" },
  m_on: { ru: "ВКЛ", en: "ON" },
  m_off: { ru: "ВЫКЛ", en: "OFF" },
  m_m_e_n_u: { ru: "М Е Н Ю", en: "M E N U" },
  m_language: { ru: "Язык", en: "Language" },
  m_music: { ru: "Музыка", en: "Music" },
  m_sound: { ru: "Звуки", en: "Sound" },
  m_c_h_a_p_t_e: { ru: "Г Л А В Ы", en: "C H A P T E R S" },
  m_s_u_p_p_o_r: { ru: "П О Д Д Е Р Ж А Т Ь", en: "S U P P O R T" },
  m_support_the_project: { ru: "Поддержать проект 💛", en: "Support the project 💛" },
  m_close: { ru: "ЗАКРЫТЬ", en: "CLOSE" },
  m_game_title: { ru: "Сквозь голову", en: "Run Through Your Mind" },
  ...WEEK,
} satisfies Record<string, Msg>;

export type MsgKey = keyof typeof M;
