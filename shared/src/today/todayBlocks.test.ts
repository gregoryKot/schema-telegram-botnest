// Реестр блоков «Сегодня»: сверка с контрактом бэка и мини-аппа (правило №4)
// и чистые хелперы листа настройки.
import { describe, it, expect } from 'vitest';
import {
  TODAY_BLOCK_IDS,
  TODAY_BLOCK_META,
  TODAY_BLOCK_ORDER,
  TODAY_ORDER_KEY,
  highlightedBlock,
  visibleTodayBlocks,
} from './todayBlocks';

describe('реестр', () => {
  it('id уникальны, порядок по умолчанию содержит все блоки', () => {
    expect(new Set(TODAY_BLOCK_IDS).size).toBe(TODAY_BLOCK_IDS.length);
    expect([...TODAY_BLOCK_ORDER].sort()).toEqual([...TODAY_BLOCK_IDS].sort());
  });

  it('у каждого блока есть подпись, тумблера нет только у «Фокуса дня»', () => {
    for (const id of TODAY_BLOCK_IDS) {
      expect(TODAY_BLOCK_META[id].title.length).toBeGreaterThan(0);
      expect(TODAY_BLOCK_META[id].sub.length).toBeGreaterThan(0);
    }
    const fixed = TODAY_BLOCK_IDS.filter((id) => !TODAY_BLOCK_META[id].toggleable);
    expect(fixed).toEqual(['focus']);
  });

  it('ключ хранения — тот, что читает бэкенд-синхронизация', () => {
    expect(TODAY_ORDER_KEY).toBe('screen_order_today');
  });
});

describe('highlightedBlock', () => {
  it('«practice» — это строка «Фокус дня», остальные как есть', () => {
    expect(highlightedBlock('practice')).toBe('focus');
    expect(highlightedBlock('streak')).toBe('streak');
    expect(highlightedBlock(undefined)).toBeUndefined();
  });
});

describe('visibleTodayBlocks', () => {
  it('не-терапевт не видит строку баннера кабинета, терапевт видит', () => {
    expect(visibleTodayBlocks([...TODAY_BLOCK_ORDER], false)).not.toContain(
      'therapist_banner',
    );
    expect(visibleTodayBlocks([...TODAY_BLOCK_ORDER], true)).toEqual(
      TODAY_BLOCK_ORDER,
    );
  });
});
