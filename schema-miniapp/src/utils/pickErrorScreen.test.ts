// Инцидент 31.08.2026: авария БД (каждый запрос, включая refresh, отвечал
// 500) показала владельцу ярлычного приложения «Не удалось войти... Telegram
// выдаст свежий пропуск», хотя вход был ни при чём — сломан сервер.
import { describe, it, expect } from 'vitest';
import { pickErrorScreen } from './pickErrorScreen';

describe('pickErrorScreen', () => {
  // Ровно инцидентный случай: 401 без Bearer (веб-хост без токена), но
  // последний refresh кончился transient (500/сеть), не подтверждённым отказом.
  it('инцидент 31.08.2026: 401, isDead=false, lastFailure=transient → connection', () => {
    expect(
      pickErrorScreen('Error: API error: 401', false, 'transient', true),
    ).toBe('connection');
  });

  it('isDead=true и хост показывает LoginScreen (веб) → login', () => {
    expect(
      pickErrorScreen('Не удалось получить доступ (401)', true, 'dead', true),
    ).toBe('login');
  });

  it('isDead=true, но хост НЕ показывает LoginScreen (Telegram/MAX) → auth-help', () => {
    expect(
      pickErrorScreen('Не удалось получить доступ (401)', true, 'dead', false),
    ).toBe('auth-help');
  });

  // Токен реально невалиден (не наш refresh их портил, а сервер отказал
  // сразу) — ни isDead, ни зафиксированный lastFailure ещё не появились.
  it('401, isDead=false, lastFailure=null → auth-help', () => {
    expect(pickErrorScreen('API error: 401', false, null, true)).toBe(
      'auth-help',
    );
  });

  it('403 ведёт себя как 401 — тоже auth-серия', () => {
    expect(pickErrorScreen('API error: 403', false, null, true)).toBe(
      'auth-help',
    );
  });

  it('403 + lastFailure=transient → тоже connection, не только 401', () => {
    expect(pickErrorScreen('API error: 403', false, 'transient', true)).toBe(
      'connection',
    );
  });

  it('не auth-ошибка (сеть/парсинг) → generic, независимо от lastFailure', () => {
    expect(
      pickErrorScreen('TypeError: Failed to fetch', false, 'transient', true),
    ).toBe('generic');
    expect(
      pickErrorScreen('TypeError: Failed to fetch', false, null, true),
    ).toBe('generic');
  });

  it('isDead приоритетнее lastFailure — подтверждённый отказ решает сразу', () => {
    // Разночтение не должно быть возможно на практике (isDead=true подразумевает
    // lastFailure==='dead'), но функция обязана быть однозначной на любом вводе.
    expect(pickErrorScreen('API error: 401', true, 'transient', true)).toBe(
      'login',
    );
  });
});
