// Дверь из мини-тестов в приложение (U7, аудит 2026-11): шапка, футер и
// результат звали в бота («Продолжить в Telegram»), хотя трекер и дневники
// есть на сайте, а лендинг говорит «Telegram не нужен». Теперь главная
// кнопка ведёт в приложение так же, как на лендинге (entryCta): гость — на
// вход, вошедший — в «Сегодня»; бот — вторым путём.
import { useContext } from 'react';
import { entryCta } from '../landing/entryCta';
import { AuthContext } from '../../auth/authContext';

export function appEntry(signedIn: boolean) {
  const { href, nav } = entryCta(signedIn);
  return { href, nav, main: signedIn ? 'Перейти в приложение →' : 'Начать в приложении →' };
}

/** Страница публичная: вне AuthProvider (тесты, пререндер) — гость. */
export function useAppEntry() {
  return appEntry(useContext(AuthContext)?.isAuthenticated ?? false);
}
