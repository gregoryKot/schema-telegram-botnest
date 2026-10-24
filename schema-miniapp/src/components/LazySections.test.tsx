// @vitest-environment jsdom
// Мгновенный отклик на тап по вкладке (жалоба владельца 2026-08-23: «жму
// кнопку — экран меняется через секунду-полторы; если бы менялся сразу и
// потом загружался — ок»). Когда чанк предзагружен и данные в тёплом кеше,
// React строил полный экран одним синхронным коммитом — старый экран висел
// всё это время. Гарантия этого файла: ПЕРВЫЙ кадр после маунта секции —
// всегда дешёвый скелетон (смена экрана видна мгновенно), реальное дерево
// монтируется только после того, как скелетон успел отрисоваться (два rAF).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from 'react';

vi.mock('../sections/TodaySection', () => ({
  TodaySection: () => <div>today-real</div>,
}));
vi.mock('../sections/SchemasSection', () => ({
  SchemasSection: () => <div>schemas-real</div>,
}));
vi.mock('../sections/HelpSection', () => ({
  HelpSection: () => <div>help-real</div>,
}));
vi.mock('../sections/ProfileSection', () => ({
  ProfileSection: () => <div>profile-real</div>,
}));

import { LazySchemasSection } from './LazySections';

let rafQueue: FrameRequestCallback[] = [];

beforeEach(() => {
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const runFrame = async () => {
  const cbs = rafQueue;
  rafQueue = [];
  await act(async () => {
    cbs.forEach((cb) => cb(performance.now()));
  });
};

// Пропсы секций тут не важны — реальные компоненты замоканы заглушками.
const props = {} as never;

describe('первый кадр — скелетон, тяжёлое дерево — кадром позже', () => {
  it('до первого кадра рендерится только силуэт, без реальной секции', () => {
    render(<LazySchemasSection {...props} />);
    expect(screen.queryByText('schemas-real')).toBeNull();
    // Силуэт — плашки .skel (Skeleton.tsx), их больше одной.
    expect(document.querySelectorAll('.skel').length).toBeGreaterThan(0);
  });

  it('после двух кадров монтируется реальная секция', async () => {
    render(<LazySchemasSection {...props} />);
    await runFrame(); // rAF №1 — скелетон уже на экране
    expect(screen.queryByText('schemas-real')).toBeNull();
    await runFrame(); // rAF №2 — можно строить тяжёлое дерево
    expect(await screen.findByText('schemas-real')).toBeTruthy();
  });
});
