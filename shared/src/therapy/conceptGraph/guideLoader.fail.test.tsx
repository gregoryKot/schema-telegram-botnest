// @vitest-environment jsdom
// Чанк с текстами подсказок не доехал (#995): компонент получает null —
// плашка остаётся строкой группы, а не висит пустой; следующий вызов
// loadGuide пробует загрузить снова, а не отдаёт тот же отказ.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../schemaTherapy/guide', () => {
  throw new Error('chunk failed');
});

import { loadGuide, useGuide } from './guideLoader';

function Probe() {
  const g = useGuide();
  return (
    <div>{g === undefined ? 'грузится' : g === null ? 'нет' : 'есть'}</div>
  );
}

describe('guideLoader: сбой загрузки', () => {
  it('null вместо вечного «грузится»; повторный вызов — новый промис', async () => {
    render(<Probe />);
    expect(await screen.findByText('нет')).toBeTruthy();
    const first = loadGuide();
    await expect(first).rejects.toThrow();
    const second = loadGuide();
    expect(second).not.toBe(first);
    await expect(second).rejects.toThrow();
  });
});
