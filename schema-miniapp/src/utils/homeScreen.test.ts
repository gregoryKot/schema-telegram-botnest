// Ссылка «добавить на экран» остаётся в мини-аппе (зависит от имени бота);
// остальная логика и её матрица — shared/src/host/homeScreen.test.ts.
import { describe, it, expect, vi } from 'vitest';

// Имя бота без дефолта (botConfig.ts): задаём до загрузки модулей, как это делает
// .env.production на сборке.
vi.hoisted(() => vi.stubEnv('VITE_BOT_USERNAME', 'SchemeHappensBot'));
import { addToHomeScreenUrl, shouldOfferHomeScreen } from './homeScreen';

describe('utils/homeScreen', () => {
  it('ссылка — ровно как у нативного клиента (startapp&addToHomeScreen)', () => {
    expect(addToHomeScreenUrl()).toBe(
      'https://t.me/SchemeHappensBot/diary?startapp&addToHomeScreen',
    );
  });

  it('логика переехала в shared и доступна ре-экспортом', () => {
    expect(typeof shouldOfferHomeScreen).toBe('function');
  });
});
