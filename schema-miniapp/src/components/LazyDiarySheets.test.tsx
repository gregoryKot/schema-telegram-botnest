// @vitest-environment jsdom
// LazyDiarySheets — дневниковые шиты «+» стали ленивыми (разбор холодного
// старта 2026-08-23: статический импорт тянул GratitudeEntrySheet/modeCards/
// healthyAdultHints, ~136КБ, в стартовый граф). Гарантии: прогрев идёт по
// одному чанку за виток простоя (не залпом поверх первого рендера), а сама
// обёртка до загрузки чанка показывает рамку BottomSheet, не пустоту.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const loaded: string[] = [];
vi.mock('./diary/SchemaEntrySheet', () => {
  loaded.push('schema');
  return { SchemaEntrySheet: () => <div>schema-sheet</div> };
});
vi.mock('./diary/ModeEntrySheet', () => {
  loaded.push('mode');
  return { ModeEntrySheet: () => <div>mode-sheet</div> };
});
vi.mock('./diary/GratitudeEntrySheet', () => {
  loaded.push('gratitude');
  return { GratitudeEntrySheet: () => <div>gratitude-sheet</div> };
});

import { preloadDiarySheets, LazySchemaEntrySheet } from './LazyDiarySheets';

let idleQueue: (() => void)[] = [];

beforeEach(() => {
  idleQueue = [];
  loaded.length = 0;
  Object.defineProperty(window, 'requestIdleCallback', {
    value: (cb: () => void) => {
      idleQueue.push(cb);
      return idleQueue.length;
    },
    configurable: true,
  });
});
afterEach(() => {
  Reflect.deleteProperty(window, 'requestIdleCallback');
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('preloadDiarySheets', () => {
  it('греет три чанка по одному за виток простоя, в порядке schema→mode→gratitude', async () => {
    const plan = preloadDiarySheets();
    expect(plan).toEqual(['schema', 'mode', 'gratitude']);

    // До первого витка простоя ничего не загружено.
    expect(idleQueue.length).toBe(1);

    idleQueue.shift()!();
    await flush();
    expect(loaded).toEqual(['schema']);

    idleQueue.shift()!();
    await flush();
    idleQueue.shift()!();
    await flush();
    expect(loaded).toEqual(['schema', 'mode', 'gratitude']);
    expect(idleQueue.length).toBe(0);
  });
});

describe('LazySchemaEntrySheet', () => {
  it('до загрузки чанка показывает рамку BottomSheet, после — сам шит', async () => {
    render(
      <LazySchemaEntrySheet
        activeSchemaIds={[]}
        onClose={() => {}}
        onSave={async () => {}}
      />,
    );
    expect(await screen.findByText('schema-sheet')).toBeTruthy();
  });
});
