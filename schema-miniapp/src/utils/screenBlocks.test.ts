// Сверка реестра generic-блоков экранов (правило №4 CLAUDE.md — денормализация
// проверяется тестом): id уникальны, порядок/описания «Профиля» — подмножество
// SCREEN_BLOCK_IDS, оба ключа хранения существуют и различаются.
import { describe, it, expect } from 'vitest';
import {
  SCREEN_BLOCK_IDS,
  SCREEN_HIDDEN_KEYS,
  SCREEN_BLOCK_ORDER,
  BLOCK_META,
} from './screenBlocks';

describe('SCREEN_BLOCK_IDS', () => {
  it('id уникальны', () => {
    expect(new Set(SCREEN_BLOCK_IDS).size).toBe(SCREEN_BLOCK_IDS.length);
  });
});

describe('SCREEN_HIDDEN_KEYS', () => {
  it('ключ на каждый экран, ключи разные', () => {
    expect(SCREEN_HIDDEN_KEYS.profile).toBeTruthy();
    expect(SCREEN_HIDDEN_KEYS.patterns).toBeTruthy();
    expect(SCREEN_HIDDEN_KEYS.profile).not.toBe(SCREEN_HIDDEN_KEYS.patterns);
  });
});

describe('SCREEN_BLOCK_ORDER.profile', () => {
  it('каждый id профиля есть в SCREEN_BLOCK_IDS', () => {
    for (const id of SCREEN_BLOCK_ORDER.profile) {
      expect(SCREEN_BLOCK_IDS).toContain(id);
    }
  });

  it('без дублей', () => {
    const ids = SCREEN_BLOCK_ORDER.profile;
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('heroes/ysq_status (блоки «Паттернов») в профиль не входят', () => {
    expect(SCREEN_BLOCK_ORDER.profile).not.toContain('heroes');
    expect(SCREEN_BLOCK_ORDER.profile).not.toContain('ysq_status');
  });
});

describe('BLOCK_META', () => {
  it('у каждого блока профиля есть описание (emoji/label/sub)', () => {
    for (const id of SCREEN_BLOCK_ORDER.profile) {
      const meta = BLOCK_META[id];
      expect(meta).toBeTruthy();
      expect(meta?.emoji).toBeTruthy();
      expect(meta?.label).toBeTruthy();
      expect(meta?.sub).toBeTruthy();
    }
  });
});
