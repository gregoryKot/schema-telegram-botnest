// Клавиатуры онбординга бота. Вынесены из telegram.service.ts: тот файл вдвое
// перерос лимит (правило №10 CLAUDE.md — раздутый файл дробится, а не пухнет
// дальше), а разметка кнопок ни от чего в сервисе не зависит.
import { Markup } from 'telegraf';
import { MINIAPP_URL, DONATE_URL } from './telegram.constants';

export function buildWelcomeKeyboard(): ReturnType<
  typeof Markup.inlineKeyboard
> {
  return Markup.inlineKeyboard([
    [Markup.button.webApp('🧠 Открыть «Всё по схеме»', MINIAPP_URL)],
    [Markup.button.callback('🎲 Мини-тесты на 2 минуты', 'qz:list')],
    [Markup.button.url('💛 Поддержать проект', DONATE_URL)],
  ]);
}

// Онбординг −1 шаг (аудит 2026-07, этап 4.3): согласие и выбор ты/вы — один
// экран с двумя кнопками вместо двух последовательных сообщений.
export function buildConsentKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Принять — общаемся на «ты»', 'accept:ty')],
    [Markup.button.callback('✅ Принять — на «вы»', 'accept:vy')],
  ]);
}

export function buildAddressKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('На «ты»', 'addr:ty'),
      Markup.button.callback('На «вы»', 'addr:vy'),
    ],
  ]);
}
